//! Registered note-only windows. Main owns auth/repository; Rust owns scope and OS flags.
use std::{collections::HashMap, sync::{Arc,Mutex}, time::{Duration,Instant}};
use serde::{Deserialize,Serialize};
use serde_json::{json,Value};
use tauri::{AppHandle,Emitter,Manager,PhysicalPosition,PhysicalSize,WebviewWindow,WebviewWindowBuilder,WebviewUrl,WindowEvent};
use tauri_plugin_global_shortcut::{GlobalShortcutExt,Shortcut,ShortcutState};
use crate::note_journal;

#[derive(Clone,Serialize,Deserialize,PartialEq)]
#[serde(rename_all="camelCase")]
pub struct Identity { user_id:String, workspace_id:Option<String> }
#[derive(Clone,Serialize,Deserialize)]
#[serde(rename_all="camelCase")]
pub struct Context { user_id:String, workspace_id:Option<String>, note_id:String, local:bool }
#[derive(Clone,Serialize,Deserialize)]
struct Bounds { x:i32,y:i32,width:u32,height:u32,scale:f64 }
impl Default for Bounds { fn default()->Self { Self{x:120,y:100,width:360,height:460,scale:1.0} } }
#[derive(Clone,Serialize,Deserialize)]
struct Placement { expanded:Bounds,bubble:Bounds,always_on_top:bool,#[serde(default="default_opacity")]opacity:f64,#[serde(default)]opened:bool,#[serde(default)]hidden:bool,#[serde(default)]collapsed:bool,#[serde(default)]local:bool }
fn default_opacity()->f64{0.96}
impl Default for Placement { fn default()->Self {Self{expanded:Bounds::default(),bubble:Bounds{width:64,height:64,..Bounds::default()},always_on_top:true,opacity:default_opacity(),opened:false,hidden:false,collapsed:false,local:false}} }
struct Entry { context:Context,placement:Placement,collapsed:bool,ghost:bool,peek:bool,shake:Option<Shake>,ignore_move_until:Instant,save_generation:u64,operation:Arc<tokio::sync::Mutex<()>>,edit_writer:String,edit_version:u64,edit_settled:u64,close_nonce:String,close_ready:bool }
fn reset_frame_writer(entry:&mut Entry){entry.edit_writer=uuid::Uuid::new_v4().to_string();entry.edit_version=0;entry.edit_settled=0;entry.close_ready=false;}
struct Shake { started:Instant,last_x:i32,last_y:i32,direction:i32,turns:u32,travel:i32 }
#[derive(Default)]
struct Inner { identity:Option<Identity>,entries:HashMap<String,Entry>,pending:HashMap<String,(String,Instant)>,shortcut:Option<Shortcut>,capture_pending:bool,shortcut_down:bool,quit_generation:u64 }
#[derive(Default,Clone)]
pub struct NativeNotes {inner:Arc<Mutex<Inner>>,journal:Arc<Mutex<()>>,shortcut_operation:Arc<tokio::sync::Mutex<()>>,window_operation:Arc<tokio::sync::Mutex<()>>}
fn lock(state:&NativeNotes)->Result<std::sync::MutexGuard<'_,Inner>,String>{state.inner.lock().map_err(|_|"Notes controller is unavailable".into())}
fn main_only(window:&WebviewWindow)->Result<(),String>{if window.label()!="main" {Err("Only the main repository owner can call this command".into())}else{Ok(())}}
fn root(app:&AppHandle)->Result<std::path::PathBuf,String>{Ok(app.path().app_local_data_dir().map_err(|_|"Notes storage directory is unavailable")?.join("notes"))}
fn check_scope(identity:&Option<Identity>,context:&Context)->Result<(),String>{
    let current=identity.as_ref().ok_or("Sign in before opening Notes")?;
    if current.user_id!=context.user_id || context.workspace_id.is_some() && current.workspace_id!=context.workspace_id {return Err("The note account or workspace changed".into());} Ok(())
}
fn context_for(state:&NativeNotes,label:&str)->Result<Context,String>{let inner=lock(state)?;let context=inner.entries.get(label).ok_or("This note window is no longer registered")?.context.clone();check_scope(&inner.identity,&context)?;Ok(context)}
fn placement_path(app:&AppHandle,context:&Context)->Result<std::path::PathBuf,String>{
    uuid::Uuid::parse_str(&context.note_id).map_err(|_|"Invalid note identity")?;
    for segment in [context.user_id.as_str(),context.workspace_id.as_deref().unwrap_or("personal")] {if !safe_segment(segment){return Err("Invalid note scope".into());}}
    Ok(root(app)?.join(&context.user_id).join(context.workspace_id.as_deref().unwrap_or("personal")).join(format!("{}.placement",context.note_id)))
}
fn safe_segment(value:&str)->bool{!value.is_empty()&&value.len()<=80&&value.bytes().all(|byte|byte.is_ascii_alphanumeric()||byte==b'-'||byte==b'_')}
fn catalog(app:&AppHandle,identity:&Identity)->Result<Value,String>{catalog_directory(&root(app)?,identity)}
fn catalog_directory(root:&std::path::Path,identity:&Identity)->Result<Value,String>{
    if !safe_segment(&identity.user_id){return Err("Invalid Notes actor".into());}let mut contexts=vec![];let mut retained_errors=0;
    for scope in std::iter::once("personal").chain(identity.workspace_id.as_deref()){
        if !safe_segment(scope){return Err("Invalid Notes workspace".into());}let directory=root.join(&identity.user_id).join(scope);if !directory.exists(){continue;}
        for item in std::fs::read_dir(directory).map_err(|_|"Note placement catalog is unavailable")?{let path=match item{Ok(item)=>item.path(),Err(_)=>{retained_errors+=1;continue;}};if path.extension().and_then(|value|value.to_str())!=Some("placement"){continue;}let id=path.file_stem().and_then(|value|value.to_str()).unwrap_or("");if uuid::Uuid::parse_str(id).is_err(){retained_errors+=1;continue;}match std::fs::read(&path).ok().and_then(|bytes|serde_json::from_slice::<Placement>(&bytes).ok()){Some(placement) if placement.opened=>contexts.push(Context{user_id:identity.user_id.clone(),workspace_id:if scope=="personal"{None}else{Some(scope.into())},note_id:id.into(),local:placement.local}),Some(_)=>{},None=>retained_errors+=1}}
    }Ok(json!({"contexts":contexts,"retainedErrors":retained_errors}))
}
fn clamp_bounds(window:&WebviewWindow,saved:&Bounds,bubble:bool)->Result<Bounds,String>{
    let monitors=window.available_monitors().map_err(|_|"Display inventory is unavailable")?;
    let monitor=monitors.iter().find(|monitor|{let area=monitor.work_area();saved.x>=area.position.x&&saved.x<area.position.x+area.size.width as i32&&saved.y>=area.position.y&&saved.y<area.position.y+area.size.height as i32}).or(monitors.first()).ok_or("No display is available")?;
    let area=monitor.work_area();let scale=monitor.scale_factor();let previous=if saved.scale.is_finite()&&saved.scale>0.0{saved.scale}else{1.0};
    let width=if bubble{(64.0*scale) as u32}else{((saved.width as f64/previous*scale) as u32).max((280.0*scale) as u32)}.min(area.size.width);
    let height=if bubble{(64.0*scale) as u32}else{((saved.height as f64/previous*scale) as u32).max((280.0*scale) as u32)}.min(area.size.height);
    Ok(Bounds{x:saved.x.clamp(area.position.x,area.position.x+(area.size.width-width) as i32),y:saved.y.clamp(area.position.y,area.position.y+(area.size.height-height) as i32),width,height,scale})
}
fn apply_bounds(window:&WebviewWindow,bounds:&Bounds)->Result<(),String>{window.set_size(PhysicalSize::new(bounds.width,bounds.height)).map_err(|e|e.to_string())?;window.set_position(PhysicalPosition::new(bounds.x,bounds.y)).map_err(|e|e.to_string())}
fn flags_payload(entry:&Entry)->Value{json!({"alwaysOnTop":entry.placement.always_on_top,"opacity":entry.placement.opacity,"collapsed":entry.collapsed,"ghost":entry.ghost,"peek":entry.peek})}
fn persist_placement(app:&AppHandle,state:&NativeNotes,label:&str,generation:Option<u64>)->Result<(),String>{
    let _serial=state.journal.lock().map_err(|_|"Placement storage is unavailable")?;
    let snapshot={let inner=lock(state)?;let Some(entry)=inner.entries.get(label)else{return Ok(())};if generation.is_some_and(|generation|generation!=entry.save_generation){return Ok(());} (entry.context.clone(),entry.placement.clone())};
    note_journal::atomic_write(&placement_path(app,&snapshot.0)?,&serde_json::to_vec(&snapshot.1).map_err(|_|"Placement serialization failed")?)
}
async fn update_flags(app:&AppHandle,state:&NativeNotes,label:&str,payload:Value,restore:bool)->Result<Value,String>{
    let operation={let inner=lock(state)?;inner.entries.get(label).ok_or("Note window is unavailable")?.operation.clone()};
    let _operation=operation.lock().await;
    let context=context_for(state,label)?;
    let (placement,collapsed,ghost,resize)={let mut inner=lock(state)?;let entry=inner.entries.get_mut(label).ok_or("Note window is unavailable")?;
        let previous=entry.collapsed;
        if let Some(opacity)=payload.get("opacity"){let value=opacity.as_f64().filter(|value|value.is_finite()&&(0.3..=1.0).contains(value)).ok_or("Opacity must be between 30% and 100%")?;entry.placement.opacity=value;}
        if let Some(pin)=payload["alwaysOnTop"].as_bool(){entry.placement.always_on_top=pin;}
        if let Some(ghost)=payload["ghost"].as_bool(){entry.ghost=ghost;entry.peek=payload["peek"].as_bool().unwrap_or(false);}
        if let Some(collapsed)=payload["collapsed"].as_bool(){entry.collapsed=collapsed;entry.placement.collapsed=collapsed;if collapsed!=previous{entry.ghost=false;entry.peek=false;}}
        if restore{entry.ghost=false;entry.peek=false;entry.placement.hidden=false;}
        entry.shake=None;entry.ignore_move_until=Instant::now()+Duration::from_millis(600);entry.save_generation+=1;
        (entry.placement.clone(),entry.collapsed,entry.ghost,restore||previous!=entry.collapsed)
    };
    let window=app.get_webview_window(label).ok_or("Note window is unavailable")?;
    window.set_always_on_top(placement.always_on_top).map_err(|e|e.to_string())?;
    window.set_ignore_cursor_events(ghost).map_err(|e|e.to_string())?;
    if resize{window.set_min_size(Some(tauri::LogicalSize::new(if collapsed{64.0}else{280.0},if collapsed{64.0}else{280.0}))).map_err(|e|e.to_string())?;let bounds=clamp_bounds(&window,if collapsed{&placement.bubble}else{&placement.expanded},collapsed)?;apply_bounds(&window,&bounds)?;}
    if restore{window.show().map_err(|e|e.to_string())?;}
    context_for(state,label).and_then(|current|if current.user_id==context.user_id{Ok(())}else{Err("Note identity changed".into())})?;
    let flags={let inner=lock(state)?;flags_payload(inner.entries.get(label).ok_or("Note window closed")?)};
    window.emit_to(window.label(),"kora-note-flags",&flags).map_err(|e|e.to_string())?;persist_placement(app,state,label,None)?;Ok(flags)
}
async fn hide_window(app:&AppHandle,state:&NativeNotes,label:&str)->Result<(),String>{
    let operation={let inner=lock(state)?;inner.entries.get(label).ok_or("Note window is unavailable")?.operation.clone()};let _operation=operation.lock().await;context_for(state,label)?;
    {let mut inner=lock(state)?;inner.entries.get_mut(label).ok_or("Note window closed")?.placement.hidden=true;}
    app.get_webview_window(label).ok_or("Note window closed")?.hide().map_err(|error|error.to_string())?;persist_placement(app,state,label,None)
}
pub async fn restore_all(app:&AppHandle)->Result<(),String>{
    let state=app.state::<NativeNotes>();let labels={let inner=lock(&state)?;inner.entries.keys().cloned().collect::<Vec<_>>()};
    for label in labels{update_flags(app,&state,&label,json!({}),true).await?;}
    app.emit_to("main","kora-notes-command",json!({"action":"restore_catalog"})).map_err(|error|error.to_string())?;Ok(())
}
fn unregister_window(inner:&mut Inner,label:&str)->bool{inner.pending.retain(|_,(owner,_)|owner!=label);inner.entries.remove(label).is_some()}
pub fn capture(app:&AppHandle){
    let state=app.state::<NativeNotes>();let send={let Ok(mut inner)=lock(&state)else{return};if inner.identity.is_none()||inner.capture_pending{false}else{inner.capture_pending=true;true}};if send{let _=app.emit_to("main","kora-notes-command",json!({"action":"capture"}));}
}
pub fn setup(app:&AppHandle)->Result<(),Box<dyn std::error::Error>>{
    use tauri::{menu::{Menu,MenuItem},tray::TrayIconBuilder};
    let capture_item=MenuItem::with_id(app,"notes-capture","New Quick Note",true,None::<&str>)?;
    let restore_item=MenuItem::with_id(app,"notes-restore","Restore Notes · leave Ghost",true,None::<&str>)?;
    let manager_item=MenuItem::with_id(app,"notes-manager","Notes Manager",true,None::<&str>)?;
    let quit_item=MenuItem::with_id(app,"notes-quit","Quit Kora",true,None::<&str>)?;
    let menu=Menu::with_items(app,&[&capture_item,&restore_item,&manager_item,&quit_item])?;
    let mut tray=TrayIconBuilder::with_id("kora-notes").tooltip("Kora · Quick Notes").menu(&menu).show_menu_on_left_click(true).on_menu_event(|app,event|match event.id.as_ref(){
        "notes-capture"=>capture(app),"notes-restore"=>{let app=app.clone();tauri::async_runtime::spawn(async move{let _=restore_all(&app).await;});},
        "notes-manager"=>{if let Some(main)=app.get_webview_window("main"){let _=main.unminimize();let _=main.show();let _=main.set_focus();let _=main.emit_to("main","kora-notes-command",json!({"action":"manager"}));}},
        "notes-quit"=>request_quit(app),_=>{}
    });
    if let Some(icon)=app.default_window_icon(){tray=tray.icon(icon.clone());}tray.build(app)?;
    if let Some(main)=app.get_webview_window("main"){let handle=app.clone();main.on_window_event(move|event|{if let WindowEvent::CloseRequested{api,..}=event{api.prevent_close();request_quit(&handle);}});}
    Ok(())
}
fn cancel_close(app:&AppHandle,state:&NativeNotes)->Result<(),String>{
    let labels={let mut inner=lock(state)?;inner.entries.iter_mut().map(|(label,entry)|{entry.close_nonce.clear();entry.close_ready=false;label.clone()}).collect::<Vec<_>>()};
    for label in labels{let _=app.emit_to(&label,"kora-note-close-cancel",());}Ok(())
}
fn request_quit(app:&AppHandle){
    let state=app.state::<NativeNotes>();let generation={let Ok(mut inner)=lock(&state)else{return};inner.quit_generation+=1;inner.quit_generation};
    let _=app.emit_to("main","kora-notes-command",json!({"action":"quit"}));let handle=app.clone();
    tauri::async_runtime::spawn(async move{
        tokio::time::sleep(Duration::from_secs(7)).await;let state=handle.state::<NativeNotes>();
        if !lock(&state).map(|inner|inner.quit_generation==generation).unwrap_or(false){return;}
        if let Some(main)=handle.get_webview_window("main"){let _=main.show();let _=main.unminimize();let _=main.emit_to("main","kora-notes-command",json!({"action":"quit_blocked"}));}
    });
}
fn open_window(app:&AppHandle,state:&NativeNotes,context:Context,focus:bool,preserve_hidden:bool)->Result<String,String>{
    let label={let inner=lock(state)?;check_scope(&inner.identity,&context)?;inner.entries.iter().find(|(_,entry)|entry.context.user_id==context.user_id&&entry.context.note_id==context.note_id&&entry.context.workspace_id==context.workspace_id&&entry.context.local==context.local).map(|(label,_)|label.clone())};
    if let Some(label)=label {if let Some(window)=app.get_webview_window(&label){if !preserve_hidden{{let mut inner=lock(state)?;let entry=inner.entries.get_mut(&label).ok_or("Note window closed")?;entry.placement.hidden=false;entry.ghost=false;entry.peek=false;}window.set_ignore_cursor_events(false).map_err(|e|e.to_string())?;window.show().map_err(|e|e.to_string())?;let flags={let inner=lock(state)?;flags_payload(inner.entries.get(&label).ok_or("Note window closed")?)};window.emit_to(window.label(),"kora-note-flags",flags).map_err(|e|e.to_string())?;persist_placement(app,state,&label,None)?;}if focus{window.set_focus().map_err(|e|e.to_string())?;}return Ok(label);}}
    let path=placement_path(app,&context)?;
    let data_directory=root(app)?.join("webviews").join(&context.user_id);
    let mut placement=std::fs::read(path).ok().and_then(|bytes|serde_json::from_slice::<Placement>(&bytes).ok()).unwrap_or_default();placement.opened=true;placement.local=context.local;if !preserve_hidden{placement.hidden=false;}placement.opacity=placement.opacity.clamp(0.3,1.0);
    let label=format!("note-{}",uuid::Uuid::new_v4());
    {let mut inner=lock(state)?;check_scope(&inner.identity,&context)?;inner.entries.insert(label.clone(),Entry{context,placement:placement.clone(),collapsed:placement.collapsed,ghost:false,peek:false,shake:None,ignore_move_until:Instant::now()+Duration::from_millis(700),save_generation:0,operation:Arc::new(tokio::sync::Mutex::new(())),edit_writer:uuid::Uuid::new_v4().to_string(),edit_version:0,edit_settled:0,close_nonce:String::new(),close_ready:false});}
    let result=WebviewWindowBuilder::new(app,&label,WebviewUrl::App("index.html#/native-note".into())).data_directory(data_directory).title("Kora Note").decorations(false).transparent(true).shadow(false).resizable(true).always_on_top(placement.always_on_top).focused(false).visible(false).inner_size(360.0,460.0).build();
    let window=match result{Ok(window)=>window,Err(error)=>{lock(state)?.entries.remove(&label);return Err(error.to_string());}};
    let configure=||->Result<(),String>{window.set_min_size(Some(tauri::LogicalSize::new(if placement.collapsed{64.0}else{280.0},if placement.collapsed{64.0}else{280.0}))).map_err(|e|e.to_string())?;let bounds=clamp_bounds(&window,if placement.collapsed{&placement.bubble}else{&placement.expanded},placement.collapsed)?;apply_bounds(&window,&bounds)?;let handle=app.clone();let event_label=label.clone();window.on_window_event(move|event|on_window_event(&handle,&event_label,event));persist_placement(app,state,&label,None)?;if !placement.hidden{window.show().map_err(|e|e.to_string())?;}if focus{window.set_focus().map_err(|e|e.to_string())?;}Ok(())};
    if let Err(error)=configure(){lock(state)?.entries.remove(&label);let _=window.destroy();return Err(error);}Ok(label)
}
fn on_window_event(app:&AppHandle,label:&str,event:&WindowEvent){
    if matches!(event,WindowEvent::Destroyed){let state=app.state::<NativeNotes>();let removed=lock(&state).map(|mut inner|unregister_window(&mut inner,label)).unwrap_or(false);if removed{let _=app.emit_to("main","kora-notes-command",json!({"action":"window_closed","label":label}));}return;}
    let Some(window)=app.get_webview_window(label)else{return};
    if let WindowEvent::CloseRequested{api,..}=event{api.prevent_close();let handle=app.clone();let label=label.to_owned();tauri::async_runtime::spawn(async move{let state=handle.state::<NativeNotes>();let _=hide_window(&handle,&state,&label).await;});return;}
    let scale=window.scale_factor().unwrap_or(1.0);
    let state=app.state::<NativeNotes>();
    let (generation,peek)={
        let Ok(mut inner)=lock(&state)else{return};let Some(entry)=inner.entries.get_mut(label)else{return};let mut changed=false;let mut peek=false;
        match event{
            WindowEvent::Moved(position)=>{
                if Instant::now()>entry.ignore_move_until&&!entry.collapsed&&!entry.ghost{
                    let now=Instant::now();let gesture=entry.shake.get_or_insert(Shake{started:now,last_x:position.x,last_y:position.y,direction:0,turns:0,travel:0});
                    let dx=((position.x-gesture.last_x)as f64/scale)as i32;
                    if now.duration_since(gesture.started)>Duration::from_millis(1200)||((position.y-gesture.last_y)as f64/scale).abs()>48.0{*gesture=Shake{started:now,last_x:position.x,last_y:position.y,direction:0,turns:0,travel:0};}
                    else if dx.abs()>=16{let direction=dx.signum();if gesture.direction!=0&&direction!=gesture.direction{gesture.turns+=1;}gesture.travel+=dx.abs();gesture.last_x=position.x;gesture.direction=direction;if gesture.turns>=4&&gesture.travel>=130{peek=true;entry.shake=None;entry.ignore_move_until=now+Duration::from_millis(600);}}
                }
                let bounds=if entry.collapsed{&mut entry.placement.bubble}else{&mut entry.placement.expanded};bounds.x=position.x;bounds.y=position.y;changed=true;
            },
            WindowEvent::Resized(size)=>{let bounds=if entry.collapsed{&mut entry.placement.bubble}else{&mut entry.placement.expanded};bounds.width=size.width;bounds.height=size.height;bounds.scale=scale;entry.shake=None;entry.ignore_move_until=Instant::now()+Duration::from_millis(500);changed=true;},
            WindowEvent::ScaleFactorChanged{..}=>{entry.shake=None;entry.ignore_move_until=Instant::now()+Duration::from_millis(500);},_=>{}
        }
        if changed{entry.save_generation+=1;}(if changed{Some(entry.save_generation)}else{None},peek)
    };
    if peek{let handle=app.clone();let label=label.to_owned();tauri::async_runtime::spawn(async move{let state=handle.state::<NativeNotes>();let _=update_flags(&handle,&state,&label,json!({"ghost":true,"peek":true}),false).await;});}
    if let Some(generation)=generation{let handle=app.clone();let label=label.to_owned();tauri::async_runtime::spawn(async move{tokio::time::sleep(Duration::from_millis(250)).await;let state=handle.state::<NativeNotes>();let _=persist_placement(&handle,&state,&label,Some(generation));});}
}

#[tauri::command]
pub async fn native_notes_control(window:WebviewWindow,app:AppHandle,state:tauri::State<'_,NativeNotes>,action:String,payload:Value)->Result<Value,String>{
    main_only(&window)?;if payload.to_string().len()>3_000_000{return Err("Notes request exceeds its size limit".into());}
    match action.as_str(){
        "identity"=>{
            let _windows=state.window_operation.lock().await;
            let _operation=state.shortcut_operation.lock().await;
            let identity=if payload.is_null(){None}else{Some(serde_json::from_value::<Identity>(payload).map_err(|_|"Invalid identity context")?)};
            let (labels,old)={let mut inner=lock(&state)?;if inner.identity==identity{return Ok(Value::Null);}let old=inner.shortcut.take();inner.shortcut_down=false;inner.identity=identity;inner.capture_pending=false;inner.pending.clear();(inner.entries.drain().map(|(label,_)|label).collect::<Vec<_>>(),old)};
            if let Some(old)=old{let _=app.global_shortcut().unregister(old);}for label in labels{if let Some(note)=app.get_webview_window(&label){let _=note.destroy();}}Ok(Value::Null)
        },
        "open"=>{let _windows=state.window_operation.lock().await;let context:Context=serde_json::from_value(payload["context"].clone()).map_err(|_|"Invalid note context")?;Ok(json!(open_window(&app,&state,context,payload["focus"].as_bool().unwrap_or(false),payload["preserveHidden"].as_bool().unwrap_or(false))?))},
        "catalog"=>{let _serial=state.journal.lock().map_err(|_|"Placement storage is unavailable")?;let identity=lock(&state)?.identity.clone().ok_or("Sign in before restoring Notes")?;catalog(&app,&identity)},
        "restore"=>{restore_all(&app).await?;Ok(Value::Null)},
        "await_settled"=>{
            let nonce=uuid::Uuid::new_v4().to_string();let labels={let mut inner=lock(&state)?;inner.entries.iter_mut().map(|(label,entry)|{entry.close_nonce=nonce.clone();entry.close_ready=false;label.clone()}).collect::<Vec<_>>()};
            for label in &labels{app.emit_to(label,"kora-note-prepare-close",json!({"nonce":nonce})).map_err(|_|"An external note could not confirm its saved state")?;}
            for _ in 0..50{let settled={let inner=lock(&state)?;inner.entries.values().all(|entry|entry.close_nonce==nonce&&entry.close_ready&&entry.edit_settled>=entry.edit_version)};if settled{return Ok(Value::Null);}tokio::time::sleep(Duration::from_millis(100)).await;}
            cancel_close(&app,&state)?;Err("An external note still has an unsaved edit or did not respond. Retry or export it before leaving.".into())
        },
        "cancel_close"=>{cancel_close(&app,&state)?;Ok(Value::Null)},
        "windows"=>{let inner=lock(&state)?;Ok(json!(inner.entries.iter().map(|(label,entry)|json!({"label":label,"context":entry.context})).collect::<Vec<_>>()))},
        "close"=>{let _windows=state.window_operation.lock().await;let label=payload["label"].as_str().ok_or("Missing window identity")?;context_for(&state,label)?;{let mut inner=lock(&state)?;inner.entries.get_mut(label).ok_or("Note window closed")?.placement.opened=false;}persist_placement(&app,&state,label,None)?;{lock(&state)?.entries.remove(label);}if let Some(note)=app.get_webview_window(label){note.destroy().map_err(|e|e.to_string())?;}Ok(Value::Null)},
        "capture_finished"=>{lock(&state)?.capture_pending=false;Ok(Value::Null)},
        "local_read"|"local_save"|"local_history"|"local_drafts"|"local_draft_write"|"local_draft_remove"=>{
            let _serial=state.journal.lock().map_err(|_|"Device storage is unavailable")?;let identity={lock(&state)?.identity.clone().ok_or("Sign in before editing device Notes")?};
            let scope=payload["scope"].as_str().unwrap_or("personal");if scope!="personal"&&identity.workspace_id.as_deref()!=Some(scope){return Err("Device Notes workspace changed".into());}
            let directory=root(&app)?.join("device");
            if action=="local_history"{return note_journal::local_history(&directory,&identity.user_id,scope,payload["id"].as_str().ok_or("Missing note identity")?);}
            if action.starts_with("local_draft"){return note_journal::local_drafts(&directory,&identity.user_id,scope,&action,&payload);}
            note_journal::local_notes(&directory,&identity.user_id,scope,&payload["seed"],if action=="local_save"{Some(&payload)}else{None})
        },
        "shortcut"=>{
            let _operation=state.shortcut_operation.lock().await;let value=payload["value"].as_str().unwrap_or("");
            let (old,identity)={let mut inner=lock(&state)?;(inner.shortcut.take(),inner.identity.clone().ok_or("Sign in before enabling Quick Notes")?)};
            if let Some(old)=old{app.global_shortcut().unregister(old).map_err(|e|e.to_string())?;}
            if !value.is_empty(){let shortcut:Shortcut=value.parse().map_err(|_|"Choose a valid modifier/key shortcut")?;
                app.global_shortcut().on_shortcut(shortcut,move|app,_,event|{
                    let state=app.state::<NativeNotes>();let pressed={let Ok(mut inner)=lock(&state)else{return};if inner.identity.as_ref()!=Some(&identity){false}else{let pressed=event.state()==ShortcutState::Pressed;let trigger=pressed&&!inner.shortcut_down;inner.shortcut_down=pressed;trigger}};if pressed{capture(app);}
                }).map_err(|_|"That shortcut is already in use. Choose another; the app shortcut and tray still work.")?;
                lock(&state)?.shortcut=Some(shortcut);
            }Ok(Value::Null)
        },
        "journal_read"|"journal_write"|"journal_remove"=>{
            let _serial=state.journal.lock().map_err(|_|"Draft storage is unavailable")?;let identity={lock(&state)?.identity.clone().ok_or("Sign in before reading drafts")?};let directory=root(&app)?.join("drafts");
            if action=="journal_read"{let scope=payload["scope"].as_str().unwrap_or("personal");if scope!="personal"&&identity.workspace_id.as_deref()!=Some(scope){return Err("Draft workspace changed".into());}return serde_json::to_value(note_journal::read_scope(&directory,&identity.user_id,scope)?).map_err(|_|"Draft serialization failed".into());}
            let key=payload["key"].as_str().ok_or("Missing draft identity")?;let(actor,scope,_)=note_journal::components(key)?;if actor!=identity.user_id||scope!="personal"&&identity.workspace_id.as_deref()!=Some(scope.as_str()){return Err("Draft scope changed".into());}
            if action=="journal_write"{note_journal::write(&directory,key,payload["value"].as_str().ok_or("Missing draft")?)?;Ok(json!({"durable":true}))}else{let retired=note_journal::remove(&directory,key,payload["expected"].as_str().ok_or("Missing confirmed draft")?)?;Ok(json!({"retired":retired}))}
        },
        "reply"=>{let nonce=payload["nonce"].as_str().ok_or("Missing request identity")?;let label={let mut inner=lock(&state)?;inner.pending.retain(|_,(_,at)|at.elapsed()<Duration::from_secs(60));inner.pending.remove(nonce).map(|(label,_)|label).ok_or("This request expired")?};context_for(&state,&label)?;app.emit_to(&label,"kora-note-reply",json!({"nonce":nonce,"result":payload["result"],"error":payload["error"]})).map_err(|e|e.to_string())?;Ok(Value::Null)},
        "snapshot"=>{let label=payload["label"].as_str().ok_or("Missing window identity")?;context_for(&state,label)?;app.emit_to(label,"kora-note-snapshot",&payload["snapshot"]).map_err(|e|e.to_string())?;Ok(Value::Null)},
        "quit_cancel"=>{lock(&state)?.quit_generation+=1;Ok(Value::Null)},
        "quit"=>{let _=app.global_shortcut().unregister_all();app.exit(0);Ok(Value::Null)},
        _=>Err("Unsupported Notes controller operation".into())
    }
}
#[tauri::command]
pub async fn native_note_request(window:WebviewWindow,app:AppHandle,state:tauri::State<'_,NativeNotes>,action:String,payload:Value)->Result<Value,String>{
    let context=context_for(&state,window.label())?;if payload.to_string().len()>3_000_000{return Err("Note request exceeds its size limit".into());}
    match action.as_str(){
        "context"=>{let mut inner=lock(&state)?;let entry=inner.entries.get_mut(window.label()).ok_or("Note is unavailable")?;reset_frame_writer(entry);let mut flags=flags_payload(entry);flags["context"]=serde_json::to_value(context).map_err(|_|"Invalid note context")?;flags["writerId"]=json!(entry.edit_writer);flags["closeNonce"]=json!(entry.close_nonce);Ok(flags)},
        "edit_state"=>{let mut inner=lock(&state)?;let entry=inner.entries.get_mut(window.label()).ok_or("Note is unavailable")?;if payload["writerId"].as_str()!=Some(entry.edit_writer.as_str()){return Err("This note frame was replaced".into());}let version=payload["version"].as_u64().ok_or("Invalid frame revision")?;if payload["settled"].as_bool().unwrap_or(false){entry.edit_settled=entry.edit_settled.max(version.min(entry.edit_version));}else{entry.edit_version=entry.edit_version.max(version);entry.close_ready=false;}Ok(Value::Null)},
        "close_ready"=>{let mut inner=lock(&state)?;let entry=inner.entries.get_mut(window.label()).ok_or("Note is unavailable")?;if payload["writerId"].as_str()!=Some(entry.edit_writer.as_str())||payload["nonce"].as_str()!=Some(entry.close_nonce.as_str()){return Err("The note close request was replaced".into());}entry.close_ready=true;Ok(Value::Null)},
        "drag"=>{window.start_dragging().map_err(|e|e.to_string())?;Ok(Value::Null)},
        "resize"=>{window.as_ref().window().start_resize_dragging(tauri_runtime::ResizeDirection::SouthEast).map_err(|e|e.to_string())?;Ok(Value::Null)},
        "hide"=>{hide_window(&app,&state,window.label()).await?;Ok(Value::Null)},
        "flags"=>update_flags(&app,&state,window.label(),payload,false).await,
        "read"|"change"|"retry"|"media_upload"|"media_download"|"media_list"|"open_task"|"recover"=>{
            let nonce=uuid::Uuid::new_v4().to_string();{let mut inner=lock(&state)?;inner.pending.retain(|_,(_,at)|at.elapsed()<Duration::from_secs(60));if inner.pending.values().filter(|(label,_)|label==window.label()).count()>=20{return Err("Wait for pending note operations".into());}inner.pending.insert(nonce.clone(),(window.label().into(),Instant::now()));}
            app.emit_to("main","kora-note-request",json!({"nonce":nonce,"label":window.label(),"context":context,"action":action,"payload":payload})).map_err(|e|e.to_string())?;Ok(json!({"nonce":nonce}))
        },_=>Err("Unsupported note operation".into())
    }
}

#[cfg(test)]
mod tests{
    use super::*;
    fn entry()->Entry{Entry{context:Context{user_id:"actor".into(),workspace_id:None,note_id:uuid::Uuid::new_v4().to_string(),local:true},placement:Placement{opened:true,..Placement::default()},collapsed:false,ghost:false,peek:false,shake:None,ignore_move_until:Instant::now(),save_generation:0,operation:Arc::new(tokio::sync::Mutex::new(())),edit_writer:uuid::Uuid::new_v4().to_string(),edit_version:1,edit_settled:0,close_nonce:String::new(),close_ready:false}}
    #[test]
    fn replacement_writer_invalidates_acknowledgement_but_retains_pending_close(){
        let mut replacement=entry();replacement.close_nonce="active-close".into();replacement.close_ready=true;replacement.edit_settled=1;let old_writer=replacement.edit_writer.clone();reset_frame_writer(&mut replacement);assert_ne!(replacement.edit_writer,old_writer);assert!(!replacement.close_ready);assert_eq!(replacement.close_nonce,"active-close");assert_eq!(replacement.edit_version,0);assert_eq!(replacement.edit_settled,0);
    }
    #[test]
    fn destroyed_frame_drops_only_its_registry_and_pending_requests(){
        let mut inner=Inner::default();inner.entries.insert("note-a".into(),entry());inner.entries.insert("note-b".into(),entry());inner.pending.insert("nonce-a".into(),("note-a".into(),Instant::now()));inner.pending.insert("nonce-b".into(),("note-b".into(),Instant::now()));
        assert!(unregister_window(&mut inner,"note-a"));assert!(!unregister_window(&mut inner,"note-a"));assert_eq!(inner.entries.len(),1);assert!(inner.entries["note-b"].placement.opened);assert_eq!(inner.pending.len(),1);assert_eq!(inner.pending["nonce-b"].0,"note-b");
    }
    #[test]
    fn reopen_catalog_preserves_corrupt_records_and_excludes_other_accounts_and_workspaces(){
        let root=std::env::temp_dir().join(format!("kora-placement-catalog-{}",uuid::Uuid::new_v4()));
        let id=uuid::Uuid::new_v4().to_string();
        for (actor,scope,opened) in [("actor-a","personal",true),("actor-a","workspace-a",true),("actor-a","workspace-b",true),("actor-b","personal",true)]{
            let directory=root.join(actor).join(scope);std::fs::create_dir_all(&directory).unwrap();
            std::fs::write(directory.join(format!("{id}.placement")),serde_json::to_vec(&Placement{opened,hidden:true,collapsed:true,local:true,..Placement::default()}).unwrap()).unwrap();
        }
        let personal=root.join("actor-a").join("personal");let corrupt=personal.join(format!("{}.placement",uuid::Uuid::new_v4()));std::fs::write(&corrupt,b"broken placement").unwrap();
        std::fs::write(personal.join(format!("{}.placement",uuid::Uuid::new_v4())),serde_json::to_vec(&Placement::default()).unwrap()).unwrap();
        let result=catalog_directory(&root,&Identity{user_id:"actor-a".into(),workspace_id:Some("workspace-a".into())}).unwrap();
        assert_eq!(result["retainedErrors"],1);let contexts=result["contexts"].as_array().unwrap();assert_eq!(contexts.len(),2);
        assert!(contexts.iter().all(|context|context["userId"]=="actor-a"&&context["local"]==true));
        assert!(contexts.iter().any(|context|context["workspaceId"].is_null()));assert!(contexts.iter().any(|context|context["workspaceId"]=="workspace-a"));
        assert!(corrupt.exists());assert!(catalog_directory(&root,&Identity{user_id:"../actor-a".into(),workspace_id:None}).is_err());
        std::fs::remove_dir_all(root).unwrap();
    }
}
