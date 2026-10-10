"""Frozen private Lead evaluation: saved regressions and previously unused ranges."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time
import numpy as np
import soundfile as sf

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'src-tauri/target/lead-pulse'
DOWNLOADS=Path.home()/'Downloads'
HOLDOUTS=[
 ('rap','A$AP Rocky - Praise The Lord (Da Shine) (Official Video) ft. Skepta.mp3',105,'rhythmic rap'),
 ('rhythmic-vocal','Lil Uzi Vert - XO Tour Llif3 (Official Lyric Video).mp3',120,'rhythmic singing'),
 ('guitar','Coldplay - Yellow (Official Video).mp3',150,'guitar / competing vocal'),
 ('jazz','Dave Brubeck, The Dave Brubeck Quartet - Take Five (Audio).mp3',180,'changing jazz lead'),
 ('quiet','Marconi Union - Weightless (Official Video).mp3',120,'quiet sustained / ambiguous'),
 ('electronic','D#m - No More Goodbye - LDA x Zik Remix 2026 (FIX BUILD UP).wav',180,'dense electronic'),
 ('piano','Erik Satie - Gymnopédie No.1.mp3',60,'polyphonic piano'),
 ('language-pop','[Engsub Vietsub PinYin] 爱人错过 - 告五人 Vụt Mất Người Yêu - Cáo Ngũ Nhân.mp3',150,'language / vocal pop'),
]
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def url(path):return '/'+path.relative_to(ROOT).as_posix()
def linux(path):return '/mnt/'+path.drive[0].lower()+'/'+path.as_posix()[3:]
def run(args):subprocess.run([str(a) for a in args],check=True,timeout=1200,creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)

def main():
 OUT.mkdir(parents=True,exist_ok=True)
 policy=sha(ROOT/'server/audio-analysis/lead-pulse.py')
 lock={'policySha256':policy,'holdouts':[{'id':i,'file':f,'start':s,'end':s+15,'category':c} for i,f,s,c in HOLDOUTS],
       'limitation':'Unused time ranges; several recording families were exposed in prior experiments. No claim of independent population accuracy.'}
 locked=OUT/'locked-evaluation.json'
 if locked.exists() and json.loads(locked.read_text())!=lock:raise ValueError('locked_policy_or_holdouts_changed')
 locked.write_text(json.dumps(lock,indent=2))
 cases=json.loads((ROOT/'src-tauri/target/generalized-melody/melodia-report.json').read_text())['cases']
 inputs=[]
 for identity in ['gymnopedie','lee_hi_hskt','nujabes','levels']:
  case=next(c for c in cases if c['id']==identity)
  original=Path(case['savedOriginal']);archive=original.parent/'stems-0.0.npz'
  data,rate=sf.read(original,dtype='float32',always_2d=True)
  with np.load(archive,allow_pickle=False) as a:
   if int(a['rate'])!=rate or float(a['offset'])!=0 or len(a['vocals'])!=len(data):raise ValueError('unaligned_regression')
  inputs.append((identity,'regression',case.get('category','regression'),original,archive,0))
 separator=None
 for identity,name,start,category in HOLDOUTS:
  folder=OUT/identity;folder.mkdir(exist_ok=True)
  original=folder/'original.wav';archive=folder/'stems.npz';began=time.perf_counter()
  if not original.exists():
   import imageio_ffmpeg
   run([imageio_ffmpeg.get_ffmpeg_exe(),'-nostdin','-v','error','-y','-ss',start,'-i',DOWNLOADS/name,'-t',15,'-ar',44100,'-ac',2,'-c:a','pcm_f32le',original])
  data,rate=sf.read(original,dtype='float32',always_2d=True)
  if not archive.exists():
   import torch
   from demucs.pretrained import get_model
   from demucs.apply import apply_model
   torch.set_num_threads(2)
   if separator is None:separator=get_model('htdemucs_6s').cpu().eval()
   wave=torch.from_numpy(data.T.copy());ref=wave.mean(0);mean,std=ref.mean(),ref.std()
   with torch.no_grad():stems=(apply_model(separator,((wave-mean)/std)[None],device='cpu',shifts=0,split=True,overlap=.25,progress=False)[0]*std+mean).numpy()
   np.savez(archive,rate=rate,offset=0.,core=np.array([0.,len(data)/rate]),**{n:stems[i].T for i,n in enumerate(separator.sources)})
   (folder/'preparation.json').write_text(json.dumps({'seconds':time.perf_counter()-began,'sourceFileSha256':sha(DOWNLOADS/name),'originalPosition':start,'alignment':'separator preserves sample count; no shift applied'}))
  inputs.append((identity,'unused-range-holdout',category,original,archive,start))
 fixtures=[];summaries=[]
 for identity,split,category,original,archive,position in inputs:
  folder=OUT/identity;folder.mkdir(exist_ok=True);result=folder/'lead.json'
  if not result.exists():run(['wsl','-d','Ubuntu','--exec',linux(ROOT/'src-tauri/target/melodia-venv/bin/python'),linux(ROOT/'scripts/analyze-lead-stems.py'),'--stems',linux(archive),'--output',linux(result)])
  lead=json.loads(result.read_text())
  if lead['policySha256']!=policy or lead['stemArchiveSha256']!=sha(archive):raise ValueError('cached_analysis_identity_changed')
  duration=lead['duration'];asset={'provider':'soundcloud','id':'private-local/lead-'+identity}
  job={'analysisVersion':'server-lead-pulse-range-v1','duration':duration,'asset':asset,'requestedRange':{'start':0,'end':duration}}
  analysis=folder/'export.json';analysis.write_text(json.dumps({'job':job,'offset':0,'duration':duration,'candidates':[],'onsets':[],'leadTrack':lead}))
  key=hashlib.sha256(('1:'+asset['provider']+':'+asset['id']).encode()).hexdigest();cache=OUT/'cache'/key
  run(['node',ROOT/'scripts/export-beat-range.mjs',analysis,cache])
  exported=json.loads((cache/'result.json').read_text());manifest={'schemaVersion':2,'asset':asset,'analysisVersion':job['analysisVersion'],'timelineId':'vod','duration':duration,'chunkSeconds':30,'melodyPolicy':'dominant-monophonic','requestedRange':job['requestedRange'],'chunks':[{'index':c['index'],'revision':c['revision']} for c in exported['chunks']]}
  (cache/'manifest.json').write_text(json.dumps(manifest))
  notes=[{**n,'pitch':n.get('pitch'),'amp':n['confidence'],'experimental':True,'verified':False,'analysisAudioSha256':n['inputSha256']} for n in lead['events']]
  fixtures.append({'id':'lead-'+identity,'label':identity+' · '+category+' · '+split,'audioSha256':sha(original),'analysisAudioSha256':sha(archive),'originalUrl':url(original),'inputUrl':url(original),'rawPitchUrl':url(original),'inputLabel':'automatic passage selection; no manual stem','start':0,'end':duration,'version':lead['version'],'baseline':[],'basicPitch':[],'frames':[],'lead':notes,'sections':lead['sections'],'asset':asset,'provenance':{'split':split,'originalPosition':position,'policySha256':policy,'stemArchiveSha256':sha(archive),'humanListening':'pending','runtimeSeconds':lead['runtimeSeconds']}})
  summaries.append({'id':identity,'split':split,'category':category,'events':len(notes),'pitchEvents':sum(n['kind']=='pitched-note' for n in notes),'vocalArticulations':sum(n['kind']=='vocal-articulation' for n in notes),'abstainSeconds':sum(s['end']-s['start'] for s in lead['sections'] if s['source'] is None),'owners':sorted(set(n['source'] for n in notes)),'runtimeSeconds':lead['runtimeSeconds'],'seconds':duration})
  print(json.dumps(summaries[-1]),flush=True)
 if policy!=sha(ROOT/'server/audio-analysis/lead-pulse.py'):raise ValueError('policy_changed_during_evaluation')
 (OUT/'fixtures.json').write_text(json.dumps({'fixtures':fixtures}))
 (OUT/'report.json').write_text(json.dumps({'locked':lock,'cases':summaries,'musicalAccuracy':'not established; requires human listening'},indent=2))

if __name__=='__main__':main()
