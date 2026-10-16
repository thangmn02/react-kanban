"""Prove byte-different WAV headers contain exactly the already-tested PCM."""
import hashlib,io,json,struct
from pathlib import Path
import soundfile as sf
root=Path('scratch/beat-grid-v2')
manifest=json.loads((root/'corpus-manifest.json').read_text(encoding='utf-8'))
aliases={}
existing=json.loads((root/'decoded-pcm-aliases.json').read_text()) if (root/'decoded-pcm-aliases.json').exists() else {}
for item in manifest['items']:
    if item['kind']!='independent-natural-reference':continue
    source=Path(item['path']);pcm,sr=sf.read(source,dtype='float32',always_2d=True)
    # Rebuild the old libsndfile container even after the canonical writer removes PEAK.
    buffer=io.BytesIO();sf.write(buffer,pcm,sr,format='WAV',subtype='FLOAT');data=buffer.getvalue();peak=data.find(b'PEAK')
    assert peak>=0
    prior=json.loads((root/'results/BASE'/(item['id']+'.json')).read_text())
    expected=prior['inputSha256'];matches=[]
    timestamps=([existing[item['id']]['reconstructedPeakTimestamp']] if item['id'] in existing else
      range(int(source.stat().st_birthtime)-5,int(source.stat().st_birthtime)+6))
    for timestamp in timestamps:
        candidate=data[:peak+12]+struct.pack('<I',timestamp)+data[peak+16:]
        if hashlib.sha256(candidate).hexdigest()==expected:matches.append(timestamp)
    assert len(matches)==1,('Cannot prove old PCM identity',item['id'])
    aliases[item['id']]={'executedContainerSha256':expected,
      'canonicalContainerSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
      'decodedPcmSha256':hashlib.sha256(pcm.astype('<f4').tobytes()).hexdigest(),
      'originalSourceSha256':item['sourceSha256'],'reconstructedPeakTimestamp':matches[0],
      'proof':'Restoring only libsndfile PEAK timestamp reproduces the exact recorded input SHA; all PCM bytes are unchanged.'}
    assert aliases[item['id']]['decodedPcmSha256']==item['decodedPcmSha256']
(root/'decoded-pcm-aliases.json').write_text(json.dumps(aliases,indent=2))
print(f'Proved {len(aliases)} existing MDB input containers differ only in PEAK timestamp; no inference repetition is needed.')
