"""Freeze corpus/reference and replay-trace identities before viewing quality scores."""
import hashlib,json
from pathlib import Path
root=Path('scratch/beat-grid-v2');manifest=root/'corpus-manifest.json'
sha=lambda path:hashlib.sha256(Path(path).read_bytes()).hexdigest()
items=json.loads(manifest.read_text())['items'];bindings={}
for item in items:
    assert sha(item['path'])==item['sha256']
    files={item['path']:item['sha256']}
    if item.get('baselineReuse'):
        trace=item['baselineReuse']['trace'];files[trace]=sha(trace)
    if item.get('sourceFilename'):
        source=Path.home()/'Downloads'/item['sourceFilename'];files[str(source)]=item['sourceSha256'];assert sha(source)==item['sourceSha256']
    if item['kind']=='independent-natural-reference':
        track=item['splitGroup'];domain='drum_only' if item['domain']=='drum-only' else 'full_mix'
        suffix='_Drum.wav' if item['domain']=='drum-only' else '_MIX.wav'
        source=root/'reference-data/audio'/domain/(track+suffix)
        label=root/'reference-data/annotations/class'/(track+'_class.txt')
        assert sha(source)==item['sourceSha256'] and sha(label)==item['annotationSha256']
        files.update({str(source):item['sourceSha256'],str(label):item['annotationSha256']})
    bindings[item['id']]={'files':files,'referencePayloadSha256':hashlib.sha256(json.dumps(item['references'],sort_keys=True).encode()).hexdigest()}
receipt={'manifestSha256':sha(manifest),'inputs':len(items),'bindings':bindings,
  'policy':'Fixed before scoring; changes to source, labels, partitions, eligibility or replay traces fail closed.'}
target=root/'round-corpus-freeze.json'
if target.exists():assert json.loads(target.read_text())==receipt,'Frozen round changed'
else:target.write_text(json.dumps(receipt,indent=2))
print(json.dumps({'frozenInputs':len(items),'manifestSha256':receipt['manifestSha256']}))
