"""Private A/B evidence only. Never uploads audio or publishes cache events."""
import argparse
import csv
from dataclasses import asdict
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import time

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'server/audio-analysis'))
from analyze import analyze_audio

spec = importlib.util.spec_from_file_location('melody_bus', ROOT / 'server/audio-analysis/melody-bus.py')
bus = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = bus
spec.loader.exec_module(bus)


def matches(expected, observed, tolerance=.08):
    pairs = sorted((abs(a-b), i, j) for i, a in enumerate(expected)
                   for j, b in enumerate(observed) if abs(a-b) <= tolerance)
    used_a, used_b, offsets = set(), set(), []
    for distance, i, j in pairs:
        if i not in used_a and j not in used_b:
            used_a.add(i); used_b.add(j); offsets.append(observed[j]-expected[i])
    return {'matched': len(offsets), 'unmatchedExpected': len(expected)-len(offsets),
            'unmatchedObserved': len(observed)-len(offsets),
            'medianOffsetMs': round(float(np.median(offsets))*1000, 2) if offsets else None}


def activity(events, duration):
    times = [event['playbackTime'] for event in events]
    gaps = np.diff([0, *times, duration])
    return {'events': len(events), 'eventsPerMinute': round(len(events)*60/duration, 2),
            'longestGapSeconds': round(float(max(gaps)), 3),
            'medianInterEventSeconds': round(float(np.median(np.diff(times))), 3) if len(times)>1 else None}


def annotated_metrics(annotation, events, duration):
    if annotation is None:
        return {'status': 'listening-required', 'perceptualLeadAlignment': None,
                'obviousFalseFlashes': None, 'obviousMisses': None}
    times = annotation.get('leadOnsets')
    if annotation.get('complete') is not True or not isinstance(times, list) or len(times)>10000:
        raise ValueError('Expected explicitly complete human lead-onset annotation')
    if any(not isinstance(t, (float,int)) or isinstance(t,bool) or not np.isfinite(t) or not 0<=t<duration for t in times):
        raise ValueError('Invalid human lead-onset annotation')
    result = matches(times, [event['playbackTime'] for event in events])
    return {'status': 'human-timestamp-comparison', 'perceptualLeadAlignment': result,
            'obviousFalseFlashes': result['unmatchedObserved'], 'obviousMisses': result['unmatchedExpected']}


def click_mix(audio, rate, events, destination):
    output = audio.copy() * .7
    samples = np.arange(round(rate * .025)) / rate
    click = .10 * np.sin(2*np.pi*1600*samples) * np.hanning(len(samples))
    for event in events:
        start = round(event['playbackTime']*rate)
        count = min(len(click), len(output)-start)
        if count>0:
            output[start:start+count] += click[:count,None]
    sf.write(str(destination), np.clip(output, -1, 1), rate)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cases', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--config', help='Private JSON MelodyBusConfig override')
    parser.add_argument('--annotations', help='Complete human lead-onset annotations keyed by case label')
    parser.add_argument('--reuse', action='store_true', help='Reuse saved separation/candidates; recompute detector and comparison')
    args = parser.parse_args()
    cases = json.loads(Path(args.cases).read_text(encoding='utf-8-sig'))
    if not isinstance(cases,list) or not 1<=len(cases)<=30:
        raise ValueError('Expected 1-30 private cases')
    output = Path(args.output).resolve(); output.mkdir(parents=True,exist_ok=True)
    if any(Path(case['audio']).resolve().is_relative_to(output) for case in cases):
        raise ValueError('Output cannot contain source fixture inputs')
    config = bus.MelodyBusConfig(**(json.loads(Path(args.config).read_text()) if args.config else {}))
    annotations = json.loads(Path(args.annotations).read_text()) if args.annotations else {}
    reports = []
    for index, case in enumerate(cases):
        path = output / str(index); path.mkdir(exist_ok=True)
        saved = path/'analysis.json'
        audio, rate = sf.read(case['audio'], dtype='float32',always_2d=True)
        if rate!=44100 or len(audio)>rate*300 or not len(audio):
            raise ValueError('Benchmark requires bounded 44.1 kHz private excerpts')
        identity = hashlib.sha256(audio.tobytes()).hexdigest()
        detector = bus.SpectralMelodyBusDetector(config)
        experiment_events, detector_seconds, detector_cpu_seconds = [], 0, 0
        def observe(stems, sample_rate, offset, core):
            nonlocal detector_seconds, detector_cpu_seconds
            started = time.perf_counter()
            cpu_started = time.process_time()
            events = detector.detect(stems, sample_rate, offset, core)
            detector_seconds += time.perf_counter()-started
            detector_cpu_seconds += time.process_time()-cpu_started
            for event in events:
                if experiment_events:
                    previous = experiment_events[-1]
                    gap = event['playbackTime']-previous['playbackTime']
                    if gap<config.min_spacing:
                        continue
                    previous['duration'] = min(previous['duration'],gap)
                experiment_events.append(event)
            # Private measured stems enable parameter comparisons without rerunning
            # source separation or silently changing the accepted baseline.
            np.savez(path/f'stems-{core[0]}.npz', rate=sample_rate, offset=offset, core=core, **stems)
        if args.reuse and saved.exists():
            result = json.loads(saved.read_text())
            if result.get('audioHash')!=identity:
                raise ValueError('Saved experiment does not match audio')
            stem_paths = sorted(path.glob('stems-*.npz'),key=lambda p:float(p.stem.split('-')[1]))
            if not stem_paths:
                raise ValueError('Saved experiment has no stems')
            for stem_path in stem_paths:
                with np.load(stem_path,allow_pickle=False) as data:
                    observe({name:data[name] for name in bus.MELODIC_SOURCES if name in data},
                            int(data['rate']),float(data['offset']),tuple(data['core']))
            pipeline_seconds = result['pipelineSeconds']
            baseline_seconds = result['acceptedPipelineSeconds']
        else:
            started = time.perf_counter()
            result = analyze_audio(Path(case['audio']), {'provider':'youtube','id':identity[:11]},path,melodic_observer=observe)
            pipeline_seconds = time.perf_counter()-started
            baseline_seconds = pipeline_seconds-detector_seconds
            result.update(audioHash=identity,pipelineSeconds=pipeline_seconds,acceptedPipelineSeconds=baseline_seconds)
            saved.write_text(json.dumps(result))
        node = os.environ.get('NODE_BINARY','node')
        subprocess.run([node,str(ROOT/'scripts/compare-melody-paths.mjs'),str(saved),str(path/'accepted.json')],check=True,timeout=30)
        accepted = json.loads((path/'accepted.json').read_text())
        a,b = accepted['events'],experiment_events
        for event in b:
            event['eventId'] = hashlib.sha256((identity+event['eventId']).encode()).hexdigest()
        eligible = accepted['decision']['confidence'] < .6
        # The opt-in policy is exercised on measured B output; production never
        # calls it. High-confidence A always wins, and empty B cannot erase A.
        class MeasuredDetector:
            def detect(self, *arguments, **timing): return b
        policy = bus.ExperimentalMelodyFallback(MeasuredDetector(),enabled=True).choose(a,accepted['decision'],{},rate)
        report = {'label':case['label'],'duration':len(audio)/rate,'decision':accepted['decision'],
                  'fallbackEligible':eligible,'optInPath':policy['path'],
                  'A':activity(a,len(audio)/rate),'B':activity(b,len(audio)/rate),
                  'agreementNotAccuracy':matches([e['playbackTime'] for e in a],[e['playbackTime'] for e in b]),
                  'listening':{'A':annotated_metrics(annotations.get(case['label']),a,len(audio)/rate),
                               'B':annotated_metrics(annotations.get(case['label']),b,len(audio)/rate)},
                  'runtime':{'acceptedPipelineSeconds':round(baseline_seconds,3),'busOnlySeconds':round(detector_seconds,3),
                             'busCpuSeconds':round(detector_cpu_seconds,3),
                             'sharedPipelineSeconds':round(pipeline_seconds,3),'reusedSeparation':bool(args.reuse)}}
        (path/'experimental.json').write_text(json.dumps({'config':asdict(config),'events':b,'decision':report},indent=2))
        sf.write(str(path/'original.wav'),audio,rate)
        click_mix(audio,rate,a,path/'A.wav'); click_mix(audio,rate,b,path/'B.wav')
        with (path/'review.csv').open('w',newline='') as destination:
            writer=csv.writer(destination); writer.writerow(['path','playbackTime','confidence','mainLeadAttackYesNo','comment'])
            for name, events in [('A',a),('B',b)]:
                writer.writerows((name,e['playbackTime'],e['confidence'],'','') for e in events)
        reports.append(report)
        (output/'report.json').write_text(json.dumps({'config':asdict(config),'cases':reports},indent=2))
        print(json.dumps(report),flush=True)
    items=[{'label':case['label'],'directory':str(i),'events':{
        'A':json.loads((output/str(i)/'accepted.json').read_text())['events'],
        'B':json.loads((output/str(i)/'experimental.json').read_text())['events']}} for i,case in enumerate(cases)]
    data=json.dumps(items).replace('<','\\u003c')
    (output/'listen.html').write_text('''<!doctype html><meta charset="utf-8"><title>Private Melody A/B</title>
<style>body{font:16px system-ui;background:#172033;color:#f8fafc;max-width:950px;margin:32px auto}button,select{padding:10px;margin:4px}canvas{width:100%;height:120px;background:#243149}</style>
<h1>Private Melody A/B listening</h1><p>A: accepted one-lead path. B: experimental spectral activity, not proof of a main lead. Same click sound in both. Audio stays in this private directory.</p>
<select id="track"></select><button data-mode="original">Original</button><button data-mode="A">A + attack clicks</button><button data-mode="B">B + attack clicks</button>
<p><audio id="audio" controls></audio></p><canvas width="950" height="120"></canvas><p id="status"></p>
<p>Use each case's review.csv to label attacks. A/B agreement is not ground truth.</p><script>
const cases='''+data+''';const select=document.querySelector('#track'),audio=document.querySelector('audio'),canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');let mode='original';
cases.forEach((item,i)=>{const option=document.createElement('option');option.value=i;option.textContent=item.label;select.append(option)});
function load(){audio.src=cases[select.value||0].directory+'/'+mode+'.wav';document.querySelector('#status').textContent=cases[select.value||0].label+' · '+mode;}
select.onchange=load;document.querySelectorAll('button').forEach(button=>button.onclick=()=>{const time=audio.currentTime;mode=button.dataset.mode;load();audio.onloadedmetadata=()=>{audio.currentTime=Math.min(time,audio.duration);};});
function draw(){ctx.clearRect(0,0,950,120);const item=cases[select.value||0],duration=audio.duration||30;['A','B'].forEach((key,i)=>{ctx.fillStyle=i?'#66dfb6':'#b1a1ff';ctx.fillText(key,4,30+i*50);item.events[key].forEach(event=>ctx.fillRect(30+event.playbackTime/duration*900,15+i*50,2,30))});ctx.fillStyle='#fff';ctx.fillRect(30+audio.currentTime/duration*900,0,2,120);requestAnimationFrame(draw)}load();draw();</script>''',encoding='utf-8')


if __name__=='__main__': main()
