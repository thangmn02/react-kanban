import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const observations=[];
try {
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/src-tauri/target/percussion-closure/listen.html?musicDebug=1&musicFourRows=1');
  await page.locator('select[aria-label="Excerpt"]').selectOption('6');
  await page.getByText('ready — press Play',{exact:false}).waitFor();
  await page.evaluate(()=>document.querySelector('audio').play());
  await page.waitForTimeout(4000);
  const snapshot=async(label)=>observations.push({label,...await page.evaluate(()=>({time:document.querySelector('audio').currentTime,
    playing:!document.querySelector('audio').paused,records:window.__privateListeningTrace()}))});
  await snapshot('cache-playing');
  await page.evaluate(()=>document.querySelector('audio').pause());await page.waitForTimeout(300);await snapshot('paused');
  await page.waitForTimeout(500);await snapshot('still-paused');
  await page.evaluate(()=>{document.querySelector('audio').currentTime=9;return document.querySelector('audio').play();});
  await page.waitForTimeout(1800);await snapshot('seek-resume');
  await page.locator('select[aria-label="Inference path"]').selectOption('causal');await page.getByText('ready — press Play',{exact:false}).waitFor();
  await page.evaluate(()=>document.querySelector('audio').play());await page.waitForTimeout(3000);await snapshot('causal-playing');
  await page.locator('select[aria-label="Excerpt"]').selectOption('20');await page.getByText('ready — press Play',{exact:false}).waitFor();
  await page.evaluate(()=>document.querySelector('audio').play());await page.waitForTimeout(2500);await snapshot('source-switch');
  await page.getByRole('button',{name:'Mark current time',exact:true}).first().click();
  if(!await page.getByRole('textbox',{name:'kick timestamps'}).inputValue())throw new Error('Real-time annotation failed');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export human annotations'}).click();
  await (await download).saveAs('src-tauri/target/percussion-closure/annotation-check.json');
  const a=observations.find(o=>o.label==='paused').records.filter(r=>r.stage==='EVENT_RENDERED').length;
  const b=observations.find(o=>o.label==='still-paused').records.filter(r=>r.stage==='EVENT_RENDERED').length;
  const cache=observations[0].records.filter(r=>r.stage==='EVENT_RENDERED'&&r.eventSource==='cache'&&['kick','snare','hat'].includes(r.type)).length;
  await writeFile('src-tauri/target/percussion-closure/listening-check.json',JSON.stringify({errors,observations,pausedNewFlashes:b-a,cacheRendered:cache}));
  console.log(JSON.stringify({errors,pausedNewFlashes:b-a,cacheRendered:cache,sources:observations.map(o=>({label:o.label,time:o.time}))}));
  if(errors.length||b!==a||!cache)throw new Error('Private listening lifecycle failed');
} finally {await browser.close();}
