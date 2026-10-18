"""Register exact existing private Lead recordings without any model inference."""
import hashlib,importlib.util,json,os,time
from pathlib import Path
ROOT=Path('scratch/acoustic-visual-lab/full-songs')
def read(path):return json.loads(Path(path).read_text(encoding='utf-8'))
def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def write(path,value):Path(path).write_text(json.dumps(value,ensure_ascii=True),encoding='utf-8')
def run():
    index_path=ROOT/'songs.json';index=read(index_path);backup=Path('scratch/hybrid-beta')/('songs-before-lead-'+str(time.time_ns())+'.json');backup.write_bytes(index_path.read_bytes())
    manifest_path=Path('src-tauri/target/lead-pulse/fixtures.json');fixtures=read(manifest_path)['fixtures'];manifest_sha=sha(manifest_path)
    baseline=ROOT/'edb26dbb975d54ac8fba7f649363772588a1c8ebd1a2d2da5a4a6332332b673a';contract=read(baseline/'A.json')['contract'];revision=read(baseline/'source.json')['analysisRevision']
    spec=importlib.util.spec_from_file_location('frozen_full_song','scripts/full-song-numerics.py');numerics=importlib.util.module_from_spec(spec);spec.loader.exec_module(numerics)
    registered=[]
    for f in fixtures:
        source=Path(f['originalUrl'].lstrip('/')).resolve();source_sha=sha(source)
        if source_sha!=f['audioSha256']:raise ValueError('Saved Lead original audio changed: '+f['id'])
        notes=f.get('lead',[]);last_end=-1
        for n in notes:
            if not 0<=n['start']<n['end']<=f['end'] or n['start']<last_end:raise ValueError('Non-monophonic saved Lead input')
            last_end=n['end']
        folder=ROOT/source_sha;folder.mkdir(parents=True,exist_ok=True)
        if not (folder/'source.json').exists():
            *_,identity=numerics.canonical_audio(source,folder,'Saved Lead reference - '+f['id']+'.wav',source_sha,contract,revision,write)
            write(folder/'status.json',{'version':1,'state':'PARTIAL','sourceSha256':source_sha,'contractSha256':revision,'source':identity,'models':{m:{'state':'UNAVAILABLE','error':'No saved percussion predictions for this exact Lead reference recording; no substitution.'} for m in ['A','B','C']}})
        identity=read(folder/'source.json')
        binding={'version':1,'bindingVersion':'saved-lead-local-binding-v1','sourceSha256':source_sha,'canonicalWavSha256':identity['canonicalWavSha256'],'decodedPcmSha256':identity['decodedPcmSha256'],'duration':identity['duration'],'fixtureId':f['id'],'manifestSha256':manifest_sha,'policyVersion':f['version'],'provenance':f['provenance'],'events':[{'id':f"saved-lead:{source_sha[:20]}:{i}",'time':n['start'],'duration':n['end']-n['start'],'confidence':n.get('confidence',n.get('amp',0)),'lead':{'policyVersion':n['policyVersion'],'source':n['source'],'kind':n['kind'],'detector':n['detector'],'inputSha256':n['inputSha256'],**({'midiPitch':n['pitch']} if n.get('pitch') is not None else {})}} for i,n in enumerate(notes)],'scope':'Exact saved private Lead reference recording only; not the similarly titled full-song recording. Generating analysis stack is absent; no new inference or independent accuracy claim.'}
        binding['revision']=hashlib.sha256(json.dumps(binding,sort_keys=True).encode()).hexdigest();write(folder/'lead-cache.json',binding)
        if source_sha not in index['sources']:index['sources'][source_sha]={'id':source_sha,'filename':'Saved Lead reference - '+f['label']+'.wav','source':str(source),'createdAt':time.time()}
        registered.append({'id':source_sha,'fixtureId':f['id'],'events':len(notes),'duration':identity['duration'],'revision':binding['revision'],'recordSha256':sha(folder/'lead-cache.json')})
    temporary=index_path.with_suffix('.pending.json');write(temporary,index);os.replace(temporary,index_path)
    write('scratch/hybrid-beta/saved-lead-registry.json',{'version':1,'manifestSha256':manifest_sha,'entries':registered,'inferenceRun':False,'slotsUnchanged':read(backup)['slots']==index['slots']});print(json.dumps({'registered':len(registered),'inferenceRun':False}))
if __name__=='__main__':run()
