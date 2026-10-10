"""Private matching-input Basic Pitch sidecars; no separation or baseline changes."""
import hashlib
import importlib
import json
from pathlib import Path
import sys
import time

import numpy as np
import soundfile as sf

ROOT=Path(__file__).resolve().parents[1]
PAGE=ROOT/'src-tauri/target/generalized-melody'
OUTPUT=ROOT/'src-tauri/target/melody-detector-demo'
sys.path.insert(0,str(ROOT/'scripts'))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def url(path):
    return '/'+str(path.relative_to(ROOT)).replace('\\','/')


def freeze():
    saved=json.loads((ROOT/'src-tauri/target/gymnopedie-polyphonic-evidence/preservation.json').read_text())['after']
    # Only this private adapter's metadata contract is intentionally extended.
    allowed={'src/features/music/diagnostics/melody-fixture-clock.ts',
             'src/features/music/diagnostics/melody-fixture-clock.test.tsx',
             'src/features/music/MusicPlayer.tsx','src/components/focus/FloatingFocus.tsx'}
    for name,value in saved.items():
        if name not in allowed and sha(ROOT/name)!=value:
            raise ValueError('protected_baseline_changed: '+name)
    return {name:value for name,value in saved.items() if name not in allowed}


def main():
    before=freeze();OUTPUT.mkdir(exist_ok=True)
    cases=json.loads((PAGE/'melodia-input-ab-report.json').read_text())['cases']
    result=[];model=None;new_runs=[]
    for identity in ['gymnopedie','lee_hi_hskt','nujabes']:
        case=next(c for c in cases if c['id']==identity)
        folder=PAGE/identity;original=folder/'original.wav'
        signal,rate=sf.read(original,dtype='float32',always_2d=True)
        assert sha(original)==case['audioSha256'] and rate==44100
        local=OUTPUT/identity;local.mkdir(exist_ok=True)
        bp_file=local/'full-mix-basic-pitch.json'
        if not bp_file.exists():
            from basic_pitch.inference import Model,predict
            import basic_pitch
            weights=Path(basic_pitch.__file__).parent/'saved_models/icassp_2022/nmp.onnx'
            if model is None:model=Model(weights)
            began=time.perf_counter()
            _,_,notes=predict(original,model,onset_threshold=.50,frame_threshold=.30,minimum_note_length=100)
            record={'audioSha256':sha(original),'modelSha256':sha(weights),'seconds':time.perf_counter()-began,
                'parameters':{'onsetThreshold':.5,'frameThreshold':.3,'minimumNoteLengthMs':100},
                'notes':[{'start':float(a),'end':min(float(b),len(signal)/rate),'pitch':int(p),'amp':float(amp),
                          'source':'basic-pitch-original-mixture'} for a,b,p,amp,_ in notes if 0<=a<len(signal)/rate and min(b,len(signal)/rate)>a]}
            bp_file.write_text(json.dumps(record,indent=2),encoding='utf-8');new_runs.append(identity)
        full=json.loads(bp_file.read_text());assert full['audioSha256']==sha(original)
        configs=[]
        if case.get('inputAb'):
            pair=case['inputAb'];stem=pair['manualStem'];start,end=pair['start'],pair['end']
            packed=Path(case['savedOriginal']).parent/'stems-0.0.npz'
            with np.load(packed,allow_pickle=False) as npz:
                assert int(npz['rate'])==rate and float(npz['offset'])==0
                samples=npz[stem]
                crop,_=sf.read(folder/'input-ab/stem-input.wav',dtype='float32',always_2d=True)
                assert np.array_equal(samples[round(start*rate):round(end*rate)],crop)
            candidates=json.loads((folder/'candidates.json').read_text())
            assert candidates['audioHash']==hashlib.sha256(signal.tobytes()).hexdigest()
            raw=next(c for c in candidates['candidates'] if c['source']==stem)['notes']
            # Preserve attacks at original timestamps; never invent a crop-boundary onset.
            notes=[{**n,'end':min(n['end'],end),'source':'basic-pitch-saved-'+stem}
                   for n in raw if start<=n['start']<end and min(n['end'],end)>n['start']]
            configs.append(('stem',stem,start,end,pair['stem'],notes,folder/'input-ab/stem-audio.wav',
                {'savedCandidateSha256':sha(folder/'candidates.json'),'stemArchiveSha256':sha(packed),
                 'sameDecodedStemCrop':True,'basicPitchAnalyzedContext':'saved full 30-second stem; original crop timestamps retained'}))
        configs.append(('mix','original mix',0,30,case['melodia'],full['notes'],original,
                        {'basicPitchFileSha256':sha(bp_file),'modelSha256':full['modelSha256'],'sameInputAudioSha256':sha(original),'parameters':full['parameters']}))
        for mode,input_name,start,end,baseline,notes,input_path,provenance in configs:
            target=local/mode;target.mkdir(exist_ok=True)
            raw_file=target/'selected-pitches.wav'
            if not raw_file.exists():
                importlib.import_module('prepare-melody-closure').listen_audio(signal,rate,notes,target)
            analysis_sha=baseline.get('analysisAudioSha256',baseline['audioSha256'])
            base=[{**n,'detector':'melodia','experimental':True,'verified':False,'analysisAudioSha256':analysis_sha}
                  for n in baseline['notes']]
            bp=[{**n,'detector':'basic-pitch','experimental':True,'verified':False,'analysisAudioSha256':analysis_sha} for n in notes]
            result.append({'id':identity+'-'+mode,'label':case['label']+' · '+input_name+f' · {start}–{end} s',
                'audioSha256':case['audioSha256'],'analysisAudioSha256':analysis_sha,'originalUrl':url(original),
                'inputUrl':url(input_path),'rawPitchUrl':url(raw_file),'inputLabel':input_name,'start':start,'end':end,
                'version':baseline['version'],'baseline':base,'basicPitch':bp,'frames':baseline['frames'],
                'provenance':provenance})
            print(json.dumps({'fixture':identity+'-'+mode,'baseline':len(base),'rawBP':len(bp)}),flush=True)
    (OUTPUT/'fixtures.json').write_text(json.dumps({'version':'private-melody-detector-comparison-v1','fixtures':result},indent=2),encoding='utf-8')
    assert before==freeze()
    (OUTPUT/'preservation.json').write_text(json.dumps({'before':before,'after':freeze(),'unchanged':True,'intentionalPrivateAdapterChange':'metadata only'},indent=2),encoding='utf-8')
    (OUTPUT/'preparation.json').write_text(json.dumps({'newBasicPitchRuns':new_runs,'sourceSeparationRuns':0,'melodiaRuns':0,
        'protectedFiles':len(before),'fixtures':[{'id':f['id'],'baseline':len(f['baseline']),'rawBasicPitch':len(f['basicPitch'])} for f in result]},indent=2),encoding='utf-8')


if __name__=='__main__':main()
