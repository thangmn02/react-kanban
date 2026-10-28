/** Dedicated browser visual/token evidence against an already-built local site. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { resolve,extname,sep } from 'node:path';
import { chromium,expect } from '@playwright/test';

const arg=name=>process.argv.find(value=>value.startsWith(`--${name}=`))?.slice(name.length+3);
const source=arg('site'),output=arg('output');
assert.match(source??'',/^scratch\/[a-z0-9/_-]+$/);assert.match(output??'',/^scratch\/[a-z0-9/_-]+$/);
const site=resolve(source),root=resolve(output);await mkdir(root,{recursive:true});
const server=createServer(async(request,response)=>{try{const pathname=new URL(request.url,'http://127.0.0.1').pathname,file=resolve(site,'.'+(extname(pathname)?decodeURIComponent(pathname):'/index.html'));if(!file.startsWith(site+sep))throw Error('Outside site');const bytes=await readFile(file);response.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'})[extname(file)]??'application/octet-stream'});response.end(bytes);}catch{response.writeHead(404);response.end();}});
let browser;const results=[];
try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(1438,'127.0.0.1',resolve);});
  await writeFile(`${root}/process.json`,JSON.stringify({command:process.argv,pid:process.pid,port:1438,startedAt:new Date().toISOString(),worktree:process.cwd()},null,2));
  browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  for(const[name,route]of[['home','/home'],['today','/today'],['tasks','/tasks'],['notes','/notes'],['focus','/focus'],['beat-grid','/beat-grid']]){
    await page.goto(`http://127.0.0.1:1438${route}`);await expect(page.getByRole('button',{name:'Open user menu',exact:true})).toBeVisible({timeout:20000});
    await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:`${root}/${name}.png`,fullPage:true,animations:'disabled'});
    results.push({name,route,...await page.evaluate(()=>{const root=getComputedStyle(document.documentElement),heading=document.querySelector('h1'),button=document.querySelector('button');return{theme:document.documentElement.dataset.astryxTheme,mode:document.documentElement.dataset.theme,colorScheme:root.colorScheme,tokens:Object.fromEntries(['--color-background-body','--color-background-surface','--color-text-primary','--color-accent','--app-bg','--app-surface'].map(name=>[name,root.getPropertyValue(name).trim()])),astryxControls:document.querySelectorAll('.astryx-button,.astryx-popover').length,heading:heading?{size:getComputedStyle(heading).fontSize,color:getComputedStyle(heading).color}:null,firstButton:button?{padding:getComputedStyle(button).padding,minHeight:getComputedStyle(button).minHeight}:null};})});
  }
  const task=await page.evaluate(()=>JSON.parse(localStorage.getItem('kanban:mock-user:local-mock-workspace:board_store:v1')).tasks.find(task=>!task.deleted_at&&!task.archived_at));
  await page.goto(`http://127.0.0.1:1438/tasks?task=${encodeURIComponent(task.id)}&taskBoard=${encodeURIComponent(task.board_id)}`);await expect(page.getByRole('button',{name:'Save changes',exact:true})).toBeVisible();
  const adopted=page.locator('[data-kora-button="astryx"]');const adoptedCount=await adopted.count();assert.ok(adoptedCount>=2,'The real task dialog must render the Astryx-backed shared buttons.');
  const taskDialog=page.getByRole('dialog',{name:'Edit task',exact:true});await page.getByRole('button',{name:'Save changes',exact:true}).focus();await page.keyboard.press('Tab');assert.equal(await taskDialog.evaluate(dialog=>dialog.contains(document.activeElement)),true,'Task keyboard focus must remain inside the drawer.');
  results.push({name:'task-dialog',astryxControls:adoptedCount,keyboardFocusContained:true});await page.screenshot({path:`${root}/task-dialog.png`,fullPage:true,animations:'disabled'});await page.keyboard.press('Escape');await expect(taskDialog).toHaveCount(0);
  await page.getByRole('button',{name:'Open user menu',exact:true}).click();await expect(page.getByTestId('identity-profile')).toBeVisible({timeout:10000});await page.screenshot({path:`${root}/identity.png`,fullPage:true,animations:'disabled'});await page.keyboard.press('Escape');
  await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:1438/today');await expect(page.getByRole('button',{name:'Open user menu',exact:true})).toBeVisible();await page.screenshot({path:`${root}/today-mobile.png`,fullPage:true,animations:'disabled'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Mobile shell must not overflow horizontally.');
  await page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});await page.reload();await expect(page.getByRole('button',{name:'Open user menu',exact:true})).toBeVisible();
  const supportedMode=await page.evaluate(()=>({mode:document.documentElement.dataset.theme,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches}));assert.equal(supportedMode.mode,'light','Kora keeps its supported light product theme under a dark OS preference.');assert.equal(supportedMode.reducedMotion,true);
  assert.deepEqual(errors,[],'Representative routes must have no runtime errors.');
  await writeFile(`${root}/surfaces.json`,JSON.stringify({at:new Date().toISOString(),source,results,supportedMode,runtimeErrors:errors},null,2));console.log(JSON.stringify({surfaces:results.length,identity:true,mobile:true,supportedMode,runtimeErrors:errors.length}));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
