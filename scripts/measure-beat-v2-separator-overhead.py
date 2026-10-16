"""Measure previously untimed separator preparation/output stages, without neural reruns."""
import hashlib,json,os,tempfile,time
from pathlib import Path
import psutil
import soundfile as sf
import torch
root=Path('scratch/beat-grid-v2').resolve();torch.set_num_threads(4)
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
scriptSha=sha(__file__);process=psutil.Process()
for item in json.loads((root/'corpus-manifest.json').read_text())['items']:
    if item['domain']!='full-mix':continue
    path=root/'first-separator-cache'/(item['id']+'.json');record=json.loads(path.read_text())
    if record.get('overheadMeasurement'):
        measurement=record['overheadMeasurement']
        assert measurement['scriptSha256']==scriptSha and measurement['canonicalInputSha256']==item['sha256']
        assert measurement['outputSha256']==record['sha256'] and sha(record['path'])==record['sha256']
        continue
    cpu0=process.cpu_times();start=time.perf_counter()
    assert sha(item['path'])==item['sha256']
    y,sr=sf.read(item['path'],dtype='float32',always_2d=True)
    wave=torch.from_numpy(y.T.copy());ref=wave.mean(0);std=ref.std();mean=ref.mean()
    normalized=(wave-mean)/std if float(std)>1e-8 else wave-mean
    prepare=time.perf_counter()-start;cpu1=process.cpu_times()
    # Existing FLOAT stem supplies the same output sample representation. Reading
    # it is a measurement fixture and is excluded; actual serialization is timed.
    assert sha(record['path'])==record['sha256']
    drums,rate=sf.read(record['path'],dtype='float32',always_2d=True)
    handle,temp=tempfile.mkstemp(suffix='.wav',dir=root);os.close(handle)
    try:
        start=time.perf_counter();cpu2=process.cpu_times();sf.write(temp,drums,rate,subtype='FLOAT')
        serialize=time.perf_counter()-start;cpu3=process.cpu_times()
    finally:
        target=Path(temp).resolve();assert target.parent==root;target.unlink()
    overheadCpu=cpu1.user+cpu1.system-cpu0.user-cpu0.system+cpu3.user+cpu3.system-cpu2.user-cpu2.system
    record['overheadMeasurement']={'scriptSha256':scriptSha,'canonicalInputSha256':item['sha256'],
      'outputSha256':record['sha256'],'preparationSeconds':prepare,'outputSerializationSeconds':serialize,
      'cpuSeconds':overheadCpu,'residentBytes':process.memory_info().rss,
      'scope':'Separately measured once: source SHA/read, tensor/normalization preparation and intermediate WAV serialization. No neural execution. Sum with original timed apply/denormalization; not an interleaved end-to-end rerun.'}
    path.write_text(json.dumps(record),encoding='utf-8')
    print(json.dumps({'id':item['id'],'previouslyUntimedSeconds':prepare+serialize}),flush=True)
