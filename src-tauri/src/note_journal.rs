//! Actor-scoped encrypted journal. Atomic replace plus sync precedes acknowledgement.
use std::{fs::{self, OpenOptions}, io::Write, path::{Path, PathBuf}};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Serialize, Deserialize)]
pub struct JournalRecord { pub key: String, pub value: String }
#[derive(Default,Serialize)]
pub struct JournalRead { pub records:Vec<JournalRecord>, pub retained_errors:usize }

pub fn components(key: &str) -> Result<(String,String,String),String> {
    let parts: Vec<_> = key.split(':').collect();
    if parts.len()!=6 || parts[0]!="kora" || parts[1]!="notes-draft" { return Err("Invalid draft scope".into()); }
    uuid::Uuid::parse_str(parts[2]).map_err(|_|"Invalid draft actor")?;
    if parts[3]!="personal" { uuid::Uuid::parse_str(parts[3]).map_err(|_|"Invalid draft workspace")?; }
    uuid::Uuid::parse_str(parts[4]).map_err(|_|"Invalid draft note")?;
    uuid::Uuid::parse_str(parts[5]).map_err(|_|"Invalid draft writer")?;
    Ok((parts[2].into(),parts[3].into(),format!("{}-{}.draft",parts[4],parts[5])))
}
fn record_path(root: &Path,key: &str) -> Result<PathBuf,String> { let (actor,scope,file)=components(key)?; Ok(root.join(actor).join(scope).join(file)) }

#[cfg(windows)]
fn crypt(bytes: &[u8], encrypt: bool) -> Result<Vec<u8>,String> {
    use windows_sys::Win32::{Foundation::LocalFree, Security::Cryptography::{CryptProtectData,CryptUnprotectData,CRYPT_INTEGER_BLOB,CRYPTPROTECT_UI_FORBIDDEN}};
    let input=CRYPT_INTEGER_BLOB { cbData: bytes.len() as u32, pbData: bytes.as_ptr() as *mut u8 };
    let mut output=CRYPT_INTEGER_BLOB {cbData:0,pbData:std::ptr::null_mut()};
    let success=unsafe { if encrypt { CryptProtectData(&input,std::ptr::null(),std::ptr::null(),std::ptr::null(),std::ptr::null(),CRYPTPROTECT_UI_FORBIDDEN,&mut output) } else { CryptUnprotectData(&input,std::ptr::null_mut(),std::ptr::null(),std::ptr::null(),std::ptr::null(),CRYPTPROTECT_UI_FORBIDDEN,&mut output) } };
    if success==0 { return Err("Windows draft encryption is unavailable".into()); }
    let result=unsafe { std::slice::from_raw_parts(output.pbData,output.cbData as usize).to_vec() };
    unsafe { LocalFree(output.pbData as _); } Ok(result)
}
#[cfg(not(windows))]
fn crypt(_bytes: &[u8], _encrypt: bool) -> Result<Vec<u8>,String> { Err("Durable native Notes require Windows protected storage".into()) }

pub fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(),String> {
    let parent=path.parent().ok_or("Invalid journal directory")?; fs::create_dir_all(parent).map_err(|_|"Draft directory is unavailable")?;
    let temporary=parent.join(format!("{}.tmp",uuid::Uuid::new_v4()));
    let write=|| -> Result<(),String> {
        let mut file=OpenOptions::new().write(true).create_new(true).open(&temporary).map_err(|_|"Draft file is unavailable")?;
        file.write_all(bytes).and_then(|_|file.sync_all()).map_err(|_|"Draft flush failed")?;
        #[cfg(windows)] { use std::os::windows::ffi::OsStrExt; use windows_sys::Win32::Storage::FileSystem::{MoveFileExW,MOVEFILE_REPLACE_EXISTING,MOVEFILE_WRITE_THROUGH};
            let from:Vec<u16>=temporary.as_os_str().encode_wide().chain(Some(0)).collect(); let to:Vec<u16>=path.as_os_str().encode_wide().chain(Some(0)).collect();
            if unsafe { MoveFileExW(from.as_ptr(),to.as_ptr(),MOVEFILE_REPLACE_EXISTING|MOVEFILE_WRITE_THROUGH) }==0 { return Err("Atomic draft replacement failed".into()); }
        }
        #[cfg(not(windows))] fs::rename(&temporary,path).map_err(|_|"Atomic draft replacement failed")?;
        Ok(())
    };
    let result=write(); if result.is_err() { let _=fs::remove_file(temporary); } result
}
pub fn write(root: &Path,key: &str,value: &str) -> Result<(),String> {
    if value.len()>300_000 { return Err("Draft exceeds the note limit".into()); }
    let parsed:Value=serde_json::from_str(value).map_err(|_|"Invalid draft document")?;
    let note_id=key.split(':').nth(4).ok_or("Invalid draft identity")?;
    if parsed["note"]["id"].as_str()!=Some(note_id) { return Err("Draft identity mismatch".into()); }
    let record=JournalRecord{key:key.into(),value:value.into()};
    atomic_write(&record_path(root,key)?,&crypt(&serde_json::to_vec(&record).map_err(|_|"Draft serialization failed")?,true)?)
}
pub fn remove(root: &Path,key: &str,expected: &str) -> Result<bool,String> {
    let path=record_path(root,key)?; if !path.exists() {return Ok(true);}
    let record:JournalRecord=serde_json::from_slice(&crypt(&fs::read(&path).map_err(|_|"Draft read failed")?,false)?).map_err(|_|"Draft is damaged; retain it for recovery")?;
    if record.key==key && record.value==expected { fs::remove_file(path).map_err(|_|"Draft retirement failed")?;return Ok(true); } Ok(false)
}
pub fn read_scope(root: &Path,actor: &str,scope: &str) -> Result<JournalRead,String> {
    uuid::Uuid::parse_str(actor).map_err(|_|"Invalid actor")?; if scope!="personal" {uuid::Uuid::parse_str(scope).map_err(|_|"Invalid workspace")?;}
    let directory=root.join(actor).join(scope); if !directory.exists() {return Ok(JournalRead::default());}
    let mut result=JournalRead::default();
    for item in fs::read_dir(directory).map_err(|_|"Draft directory cannot be read")? {
        let item=match item{Ok(item)=>item,Err(_)=>{result.retained_errors+=1;continue;}};
        if item.path().extension().and_then(|value|value.to_str())!=Some("draft") {continue;}
        let read=||->Result<JournalRecord,String>{let record:JournalRecord=serde_json::from_slice(&crypt(&fs::read(item.path()).map_err(|_|"Draft read failed")?,false)?).map_err(|_|"Draft parse failed")?;let(owner,destination,_)=components(&record.key)?;if owner!=actor||destination!=scope{return Err("Draft scope mismatch".into());}Ok(record)};
        match read(){Ok(record)=>result.records.push(record),Err(_)=>result.retained_errors+=1}
    } Ok(result)
}

pub fn local_notes(root:&Path,actor:&str,scope:&str,seed:&Value,change:Option<&Value>)->Result<Value,String>{
    for segment in [actor,scope]{if segment.is_empty()||segment.len()>80||!segment.bytes().all(|b|b.is_ascii_alphanumeric()||b==b'-'||b==b'_'){return Err("Invalid device Notes scope".into());}}
    let path=root.join(actor).join(scope).join("device-notes");
    let mut value:Value=if path.exists(){serde_json::from_slice(&crypt(&fs::read(&path).map_err(|_|"Device Notes read failed")?,false)?).map_err(|_|"Device Notes are damaged; originals are retained")?}else{seed.clone()};
    let rows=value.as_array_mut().ok_or("Invalid device Notes format")?;
    if rows.len()>500||serde_json::to_vec(&*rows).map(|bytes|bytes.len()).unwrap_or(usize::MAX)>4_000_000{return Err("Device Notes storage limit reached".into());}
    let mut retained_revision:Option<(PathBuf,Value)>=None;
    if let Some(change)=change{
        let note=&change["note"];let id=note["id"].as_str().ok_or("Missing note identity")?;uuid::Uuid::parse_str(id).map_err(|_|"Invalid note identity")?;
        if note["title"].as_str().map(str::len).unwrap_or(1000)>160||note["html"].as_str().map(str::len).unwrap_or(100_000)>60_000||note["checklist"].as_array().map(Vec::len).unwrap_or(1000)>100{return Err("Invalid device note document".into());}
        let existing=rows.iter().position(|row|row["id"].as_str()==Some(id));
        if let Some(index)=existing{
            if rows[index]["writeToken"]==note["writeToken"]&&note["writeToken"]!=change["expectedToken"]{return Ok(value);}
            if rows[index]["revision"]!=change["expectedRevision"]||rows[index]["writeToken"]!=change["expectedToken"]{return Err("This note changed in another window. Your draft is retained for recovery.".into());}
            if rows[index]["title"]!=note["title"]||rows[index]["html"]!=note["html"]||rows[index]["checklist"]!=note["checklist"]{
                let token=rows[index]["writeToken"].as_str().ok_or("Missing predecessor token")?;if token.len()>80||!token.bytes().all(|b|b.is_ascii_alphanumeric()||b==b'-'||b==b':'){return Err("Invalid predecessor token".into());}
                let revision=rows[index]["revision"].as_u64().ok_or("Invalid predecessor revision")?;
                let history=root.join(actor).join(scope).join("revisions").join(id).join(format!("{revision}-{}.revision",token.replace(':',"_")));
                retained_revision=Some((history,rows[index].clone()));
            }
            let mut next=note.clone();next["revision"]=Value::Number((rows[index]["revision"].as_u64().unwrap_or(0)+1).into());if next["writeToken"]==rows[index]["writeToken"]{next["writeToken"]=Value::String(uuid::Uuid::new_v4().to_string());}rows[index]=next;
        }else{if change["expectedRevision"].as_u64().unwrap_or(0)>0{return Err("The note changed or is unavailable".into());}let mut next=note.clone();next["revision"]=Value::Number(1.into());rows.push(next);}
    }
    let serialized=serde_json::to_vec(&value).map_err(|_|"Device Notes serialization failed")?;
    if value.as_array().map(Vec::len).unwrap_or(usize::MAX)>500||serialized.len()>4_000_000{return Err("Device Notes storage limit reached. Your draft is retained.".into());}
    if let Some((history,note))=retained_revision{atomic_write(&history,&crypt(&serde_json::to_vec(&note).map_err(|_|"Revision serialization failed")?,true)?)?;}
    atomic_write(&path,&crypt(&serialized,true)?)?;Ok(value)
}

pub fn local_history(root:&Path,actor:&str,scope:&str,note_id:&str)->Result<Value,String>{
    validate_device_scope(actor,scope)?;uuid::Uuid::parse_str(note_id).map_err(|_|"Invalid note identity")?;
    let directory=root.join(actor).join(scope).join("revisions").join(note_id);let mut result=vec![];
    if directory.exists(){for item in fs::read_dir(directory).map_err(|_|"Revision history is unavailable")?{let path=item.map_err(|_|"Revision history is unavailable")?.path();if path.extension().and_then(|value|value.to_str())!=Some("revision"){continue;}let note:Value=serde_json::from_slice(&crypt(&fs::read(path).map_err(|_|"Revision read failed")?,false)?).map_err(|_|"A revision is damaged; its original is retained")?;if note["id"].as_str()!=Some(note_id){return Err("Revision identity mismatch".into());}result.push(note);}}
    result.sort_by_key(|note|std::cmp::Reverse(note["revision"].as_u64().unwrap_or(0)));Ok(Value::Array(result))
}
fn validate_device_scope(actor:&str,scope:&str)->Result<(),String>{for segment in [actor,scope]{if segment.is_empty()||segment.len()>80||!segment.bytes().all(|byte|byte.is_ascii_alphanumeric()||byte==b'-'||byte==b'_'){return Err("Invalid device Notes scope".into());}}Ok(())}
pub fn local_drafts(root:&Path,actor:&str,scope:&str,action:&str,payload:&Value)->Result<Value,String>{
    validate_device_scope(actor,scope)?;let directory=root.join(actor).join(scope).join("drafts");let namespace=if scope=="personal"{"global"}else{scope};let prefix=format!("kora:device-notes-draft:kanban:{actor}:{namespace}:notes-preview:v1:");
    if action=="local_drafts"{let mut records=vec![];let mut damaged=0;if directory.exists(){for item in fs::read_dir(directory).map_err(|_|"Device drafts are unavailable")?{let path=item.map_err(|_|"Device draft directory is unavailable")?.path();if path.extension().and_then(|value|value.to_str())!=Some("draft"){continue;}let read=||->Result<JournalRecord,String>{let record:JournalRecord=serde_json::from_slice(&crypt(&fs::read(path).map_err(|_|"Draft read failed")?,false)?).map_err(|_|"Draft is damaged")?;if !record.key.starts_with(&prefix){return Err("Draft identity mismatch".into());}Ok(record)};match read(){Ok(record)=>records.push(record),Err(_)=>damaged+=1}}}return Ok(serde_json::json!({"records":records,"retained_errors":damaged}));}
    let key=payload["key"].as_str().ok_or("Missing draft identity")?;let suffix=key.strip_prefix(&prefix).ok_or("Device draft scope changed")?;let parts:Vec<_>=suffix.split(':').collect();if parts.len()!=2{return Err("Invalid device draft identity".into());}for part in &parts{uuid::Uuid::parse_str(part).map_err(|_|"Invalid device draft identity")?;}let path=directory.join(format!("{}-{}.draft",parts[0],parts[1]));
    if action=="local_draft_write"{let value=payload["value"].as_str().ok_or("Missing draft document")?;if value.len()>300_000{return Err("Device draft exceeds its limit".into());}let note:Value=serde_json::from_str(value).map_err(|_|"Invalid draft document")?;if note["note"]["id"].as_str()!=Some(parts[0]){return Err("Device draft identity mismatch".into());}let record=JournalRecord{key:key.into(),value:value.into()};atomic_write(&path,&crypt(&serde_json::to_vec(&record).map_err(|_|"Draft serialization failed")?,true)?)?;return Ok(Value::Bool(true));}
    if !path.exists(){return Ok(Value::Bool(true));}let record:JournalRecord=serde_json::from_slice(&crypt(&fs::read(&path).map_err(|_|"Device draft read failed")?,false)?).map_err(|_|"Device draft is damaged; original retained")?;let matched=record.key==key&&Some(record.value.as_str())==payload["expected"].as_str();if matched{fs::remove_file(path).map_err(|_|"Device draft retirement failed")?;}Ok(Value::Bool(matched))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn scoped_paths_reject_traversal() {assert!(components("kora:notes-draft:../other:personal:note:writer").is_err());}
    #[cfg(windows)]
    #[test] fn prospective_device_limits_never_acknowledge_an_unreadable_scope(){
        let root=std::env::temp_dir().join(format!("kora-device-limits-{}",uuid::Uuid::new_v4()));let actor="mock-user";let scope="personal";let seed=Value::Array((0..66).map(|_|serde_json::json!({"id":uuid::Uuid::new_v4().to_string(),"title":"Generated limit fixture","html":"x".repeat(60_000),"checklist":[],"revision":1,"writeToken":uuid::Uuid::new_v4().to_string()})).collect());
        let baseline=local_notes(&root,actor,scope,&seed,None).unwrap();let note=serde_json::json!({"id":uuid::Uuid::new_v4().to_string(),"title":"Must remain a draft","html":"y".repeat(60_000),"checklist":[],"writeToken":uuid::Uuid::new_v4().to_string()});assert!(local_notes(&root,actor,scope,&Value::Null,Some(&serde_json::json!({"note":note,"expectedRevision":null,"expectedToken":note["writeToken"]}))).is_err());assert_eq!(local_notes(&root,actor,scope,&Value::Null,None).unwrap(),baseline);fs::remove_dir_all(root).unwrap();
    }
    #[cfg(windows)]
    #[test] fn device_revisions_and_drafts_survive_reopen_and_retries(){
        let root=std::env::temp_dir().join(format!("kora-device-journal-{}",uuid::Uuid::new_v4()));let actor="mock-user";let scope="personal";let id=uuid::Uuid::new_v4().to_string();let seed=serde_json::json!([]);let first=serde_json::json!({"id":id,"title":"Original","html":"private original","checklist":[],"revision":0,"writeToken":uuid::Uuid::new_v4().to_string()});
        let created=local_notes(&root,actor,scope,&seed,Some(&serde_json::json!({"note":first,"expectedRevision":null,"expectedToken":first["writeToken"]}))).unwrap();let mut next=created[0].clone();next["title"]=Value::String("Durable edit".into());next["writeToken"]=Value::String(uuid::Uuid::new_v4().to_string());let change=serde_json::json!({"note":next,"expectedRevision":1,"expectedToken":created[0]["writeToken"]});
        let saved=local_notes(&root,actor,scope,&seed,Some(&change)).unwrap();assert_eq!(saved[0]["revision"],2);assert_eq!(local_notes(&root,actor,scope,&seed,Some(&change)).unwrap()[0]["revision"],2);assert_eq!(local_notes(&root,actor,scope,&seed,None).unwrap()[0]["title"],"Durable edit");assert_eq!(local_history(&root,actor,scope,&id).unwrap()[0]["title"],"Original");
        let key=format!("kora:device-notes-draft:kanban:{actor}:global:notes-preview:v1:{id}:{}",uuid::Uuid::new_v4());let raw=serde_json::json!({"note":next}).to_string();local_drafts(&root,actor,scope,"local_draft_write",&serde_json::json!({"key":key,"value":raw})).unwrap();assert_eq!(local_drafts(&root,actor,scope,"local_drafts",&Value::Null).unwrap()["records"][0]["value"],raw);assert_eq!(local_drafts(&root,actor,scope,"local_draft_remove",&serde_json::json!({"key":key,"expected":"stale"})).unwrap(),false);assert_eq!(local_drafts(&root,"another-user",scope,"local_drafts",&Value::Null).unwrap()["records"],serde_json::json!([]));assert_eq!(local_drafts(&root,actor,scope,"local_draft_remove",&serde_json::json!({"key":key,"expected":raw})).unwrap(),true);
        fs::remove_dir_all(root).unwrap();
    }
    #[cfg(windows)]
    #[test] fn acknowledged_journal_is_encrypted_recoverable_and_conditionally_retired() {
        let root=std::env::temp_dir().join(format!("kora-note-journal-{}",uuid::Uuid::new_v4())); let actor=uuid::Uuid::new_v4().to_string(); let note=uuid::Uuid::new_v4(); let key=format!("kora:notes-draft:{actor}:personal:{note}:{}",uuid::Uuid::new_v4());
        let first=format!(r#"{{"note":{{"id":"{note}","html":"private draft"}}}}"#); let second=first.replace("private draft","latest draft");
        write(&root,&key,&first).unwrap(); let path=record_path(&root,&key).unwrap(); assert!(!String::from_utf8_lossy(&fs::read(path).unwrap()).contains("private draft"));
        write(&root,&key,&second).unwrap(); remove(&root,&key,&first).unwrap(); assert_eq!(read_scope(&root,&actor,"personal").unwrap().records[0].value,second);
        let corrupt=root.join(&actor).join("personal").join("damaged.draft");fs::write(&corrupt,b"damaged private draft").unwrap();let recovered=read_scope(&root,&actor,"personal").unwrap();assert_eq!(recovered.records.len(),1);assert_eq!(recovered.retained_errors,1);assert!(corrupt.exists());
        assert!(read_scope(&root,&uuid::Uuid::new_v4().to_string(),"personal").unwrap().records.is_empty()); remove(&root,&key,&second).unwrap(); assert!(read_scope(&root,&actor,"personal").unwrap().records.is_empty()); fs::remove_dir_all(root).unwrap();
    }
}
