import { expect,test,type Page } from '@playwright/test';
const boardPath='/workspaces/local-mock-workspace/boards/local-mock-board';
async function openSettings(page:Page){await page.getByRole('button',{name:'Open user menu'}).click();await page.getByRole('button',{name:'Settings',exact:true}).click();await expect(page.getByRole('dialog',{name:'Settings',exact:true})).toBeVisible();}
async function image(page:Page,width:number,height:number){return Buffer.from(await page.evaluate(({width,height})=>{const c=document.createElement('canvas');c.width=width;c.height=height;const x=c.getContext('2d')!;x.fillStyle='#2563eb';x.fillRect(0,0,width,height);x.fillStyle='#f97316';x.fillRect(width/3,0,width/3,height);return c.toDataURL('image/png').split(',')[1];},{width,height}),'base64');}
async function storedTask(page:Page,title:string){return page.evaluate(title=>{const key=Object.keys(localStorage).find(k=>k.endsWith(':board_store:v1'))!;const state=JSON.parse(localStorage.getItem(key)!);const task=state.tasks.find((t:{title:string})=>t.title===title);return {task,lists:state.lists,activities:state.activities.filter((a:{task_id:string})=>a.task_id===task?.id)};},title);}

test('canonical workflow agrees across Board, Task Detail, Focus, Today and drag with persistence',async({page})=>{
 test.setTimeout(60000);
 await page.goto(boardPath);await page.getByRole('button',{name:'Add board',exact:true}).click();await page.getByRole('textbox',{name:'Board title',exact:true}).fill('Canonical workflow');
 await page.getByRole('radio',{name:/Simple Kora/}).check();await page.getByRole('button',{name:'Create board',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Create new board'})).toBeHidden();
 await page.getByRole('button',{name:'Add task',exact:true}).first().click();await page.getByRole('textbox',{name:'Title',exact:true}).fill('Workflow proof');await page.getByRole('button',{name:'Add task',exact:true}).last().click();
 const doing=(await storedTask(page,'Workflow proof')).lists.find((l:{title:string})=>l.title.toLowerCase()==='doing');
 const done=(await storedTask(page,'Workflow proof')).lists.find((l:{title:string})=>l.title.toLowerCase()==='done');
 await page.getByRole('button',{name:'Mark done: Workflow proof',exact:true}).click();await expect.poll(async()=> (await storedTask(page,'Workflow proof')).task.is_done).toBe(true);
 let row=await storedTask(page,'Workflow proof');expect(row.task.list_id).toBe(done.id);expect(row.task.completed_at).toBeTruthy();expect(row.activities.filter((a:{action:string})=>a.action==='status_change')).toHaveLength(1);
 await page.reload();await page.getByRole('button',{name:'Open task: Workflow proof',exact:true}).click();await page.getByRole('dialog',{name:'Edit task'}).getByRole('button',{name:'Mark not done',exact:true}).click();await expect(page.getByRole('dialog',{name:'Edit task'})).toBeHidden();
 row=await storedTask(page,'Workflow proof');expect(row.task.is_done).toBe(false);expect(row.task.completed_at).toBeNull();expect(row.task.list_id).not.toBe(done.id);
 const handle=page.getByRole('button',{name:'Move task: Workflow proof',exact:true});await handle.focus();await page.keyboard.press('Space');await expect(page.locator('[id^="DndLiveRegion"]')).toContainText(/picked up|moved over/);await page.keyboard.press('ArrowRight');await expect(page.locator('[id^="DndLiveRegion"]')).toContainText(`task-list-${doing.id}`);await page.keyboard.press('ArrowRight');await expect(page.locator('[id^="DndLiveRegion"]')).toContainText(`task-list-${done.id}`);await page.keyboard.press('Space');
 await expect.poll(async()=> (await storedTask(page,'Workflow proof')).task.list_id).toBe(done.id);expect((await storedTask(page,'Workflow proof')).task.is_done).toBe(true);
 await page.reload();await expect(page.getByRole('button',{name:'Open task: Workflow proof',exact:true})).toBeVisible();await expect(page.locator('[inert]')).toHaveCount(0);await handle.focus();await page.keyboard.press('Space');await expect(page.locator('[data-task-id="'+row.task.id+'"]')).toHaveCount(2);await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));await page.keyboard.press('ArrowLeft');await expect(page.locator('[id^="DndLiveRegion"]')).toContainText(`task-list-${doing.id}`);await page.keyboard.press('Space');await expect.poll(async()=> (await storedTask(page,'Workflow proof')).task.is_done).toBe(false);
 await page.reload();expect((await storedTask(page,'Workflow proof')).task.completed_at).toBeNull();
 await page.getByRole('button',{name:'Open task: Workflow proof',exact:true}).click();
 const editor=page.getByRole('dialog',{name:'Edit task'});
 await editor.getByRole('button',{name:'Assign members',exact:true}).click();await editor.getByRole('button',{name:/Bonnie Green/}).click();
 await editor.locator('div.fixed.inset-0.z-10').click({position:{x:5,y:5}});
 await editor.getByLabel('Due date',{exact:true}).fill(await page.evaluate(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}));
 const rich=editor.locator('[contenteditable="true"]');await rich.fill('First paragraph');await rich.press('Enter');await rich.pressSequentially('Second paragraph');
 await editor.getByRole('button',{name:'Save changes',exact:true}).click();await expect(editor).toBeHidden();
 await page.getByRole('button',{name:'Start focus session: Workflow proof',exact:true}).click();await page.getByRole('button',{name:'Start without intention',exact:true}).click();
 const canonicalUrl=page.url();await page.getByRole('navigation',{name:'Main navigation'}).filter({visible:true}).getByRole('button',{name:'Focus',exact:true}).click();const dock=page.getByRole('main',{name:'Floating Focus'});await dock.getByRole('button',{name:'Complete & next',exact:true}).click();
 await expect.poll(async()=> (await storedTask(page,'Workflow proof')).task.is_done).toBe(true);expect((await storedTask(page,'Workflow proof')).task.list_id).toBe(done.id);
 await page.goto(canonicalUrl);await page.getByRole('button',{name:'Open task: Workflow proof',exact:true}).click();await editor.getByRole('button',{name:'Mark not done',exact:true}).click();await expect(editor).toBeHidden();
 await page.goto('/today');await expect(page.getByRole('button',{name:'Mark done: Workflow proof',exact:true}).first()).toBeVisible();
 await expect(page.getByText('First paragraph Second paragraph',{exact:true}).first()).toBeVisible();
 await page.getByRole('button',{name:'Mark done: Workflow proof',exact:true}).first().click();await expect.poll(async()=> (await storedTask(page,'Workflow proof')).task.is_done).toBe(true);expect((await storedTask(page,'Workflow proof')).task.list_id).toBe(done.id);
 await page.reload();await expect(page.getByRole('button',{name:'Mark done: Workflow proof',exact:true})).toHaveCount(0);
});

for(const [shape,width,height]of [['landscape',800,400],['portrait',400,800],['square',600,600]] as const)test(`identity ${shape} crop saves and reloads without stretching`,async({page})=>{
 await page.goto(boardPath);await openSettings(page);await page.getByRole('textbox',{name:'Display name',exact:true}).fill(`Kora ${shape}`);
 await page.getByLabel('Choose an image').setInputFiles({name:`${shape}.png`,mimeType:'image/png',buffer:await image(page,width,height)});await expect(page.getByRole('slider',{name:'Zoom',exact:true})).toBeVisible();
 await page.getByRole('slider',{name:'Zoom',exact:true}).fill('1.5');await page.getByRole('slider',{name:'Horizontal position',exact:true}).fill('0.5');
 const crop=await page.getByAltText('Profile image preview').evaluate((el:HTMLImageElement)=>({width:el.width,height:el.height}));expect(crop.width/crop.height).toBeCloseTo(width/height,2);
 await page.getByRole('button',{name:'Save profile',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Profile saved.'})).toBeVisible();
 const size=await page.evaluate(async()=>{const key=Object.keys(localStorage).find(k=>k.endsWith(':profile:v1'))!;const saved=JSON.parse(localStorage.getItem(key)!);const img=new Image();img.src=saved.avatarUrl;await img.decode();return {width:img.naturalWidth,height:img.naturalHeight,name:saved.name};});expect(size).toEqual({width:512,height:512,name:`Kora ${shape}`});
 await page.getByRole('button',{name:'Close settings',exact:true}).click();await page.reload();await page.getByRole('button',{name:'Open user menu'}).click();await expect(page.getByRole('dialog',{name:'Your Kora identity'})).toContainText(`Kora ${shape}`);await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Open user menu'})).toBeFocused();
});

test('mobile identity keyboard, cancel, invalid file, language, default and reduced motion',async({page})=>{
 await page.setViewportSize({width:320,height:740});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/home');await openSettings(page);await page.getByRole('textbox',{name:'Display name',exact:true}).fill('Cancelled name');await page.getByRole('button',{name:'Cancel',exact:true}).click();await openSettings(page);await expect(page.getByRole('textbox',{name:'Display name',exact:true})).not.toHaveValue('Cancelled name');
 await page.getByLabel('Choose an image').setInputFiles({name:'bad.png',mimeType:'image/png',buffer:Buffer.from('not an image')});await expect(page.getByRole('alert')).toContainText('cannot be processed');
 await page.getByRole('button',{name:'Restore Kora image',exact:true}).click();await page.getByRole('button',{name:'Save profile',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Profile saved.'})).toBeVisible();
 await page.getByLabel('Language',{exact:true}).selectOption('vi');await expect(page.getByRole('dialog',{name:'Cài đặt',exact:true})).toBeVisible();await page.reload();await page.getByRole('button',{name:'Open user menu'}).click();await expect(page.getByLabel('Ngôn ngữ',{exact:true})).toHaveValue('vi');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'scratch/p0-261026-2311/identity-mobile.png'});await page.keyboard.press('Escape');
});
