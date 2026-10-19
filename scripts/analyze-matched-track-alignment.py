"""Analytical source association; never adjusts emitted event timestamps."""
import json
import subprocess
from pathlib import Path
import numpy as np
import soundfile as sf

root=Path('scratch/matched-track-quality-gap')
identity=json.loads((root/'source-identity.json').read_text(encoding='utf-8'))
y,sr=sf.read(Path(identity['retainedOriginal']).parent/'canonical.wav',dtype='float32',always_2d=True)
packet=subprocess.run(['node','scripts/beat-v2-baseline-bridge.mjs','features'],
                      input=y[:70*sr].astype('<f4').tobytes(),capture_output=True,check=True)
frames=json.loads(packet.stdout)['frames']
times=np.asarray([f['time'] for f in frames])
reference=np.asarray([f['data'] for f in frames])
np.savez_compressed(root/'canonical-features-70s.npz',times=times,features=reference)
result={}
for name in ['live-L0-bounded','live-L1-bounded']:
    data=json.loads((root/name/'controlled-diagnostics.json').read_text())
    audit=json.loads((root/name/'controlled-parity.json').read_text())
    blocks=sorted(data['features'],key=lambda b:b['times'][0])
    observed_times=np.asarray([v for b in blocks for v in b['times']])
    observed=np.asarray([b['data'][i*84:(i+1)*84] for b in blocks for i in range(5)])
    mapped=observed_times+audit['pcm']['sourceOriginSeconds']-audit['pcm']['captureStartAudioTime']
    rows=[]
    for target in [20,30,40,49]:
        index=int(np.argmin(abs(mapped-target)))
        query=observed[index:index+75]
        centered=query-query.mean(0)
        center=int(np.argmin(abs(times-mapped[index])))
        candidates=[]
        for k in range(max(0,center-100),min(len(reference)-len(query),center+101)):
            window=reference[k:k+len(query)]
            value=window-window.mean(0)
            score=np.sum(centered*value)/np.sqrt(np.sum(centered*centered)*np.sum(value*value))
            candidates.append((float(score),k))
        score,k=max(candidates)
        rows.append({'nominalSourceStart':float(mapped[index]),'bestCanonicalFeatureStart':float(times[k]),
                     'alignmentResidualMs':float((times[k]-mapped[index])*1000),'centeredFeatureCorrelation':score})
    result[name]=rows
(root/'source-feature-alignment.json').write_text(json.dumps({
    'scope':'Temporal association of unchanged production features against exact canonical source; analytical comparison only, not timestamp correction or bit equivalence. 750ms descriptors, +/-1s search, 10ms reference lattice.',
    'runs':result},indent=2))
print(json.dumps(result))
