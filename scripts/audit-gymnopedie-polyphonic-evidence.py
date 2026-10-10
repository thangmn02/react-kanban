"""Read saved contours and aligned audio; observations never become MusicEvents."""
import csv
import hashlib
import json
from pathlib import Path
from xml.etree import ElementTree

import numpy as np
import soundfile as sf
from scipy.signal import fftconvolve, find_peaks

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "src-tauri/target/generalized-melody/gymnopedie/input-ab"
SAVED = ROOT / "src-tauri/target/gymnopedie-upstream-f0"
OUTPUT = ROOT / "src-tauri/target/gymnopedie-polyphonic-evidence"
RATE, HOP = 44100, 128
# Observed partials from the prior saved spectra, not estimated note identities.
CASES = [
    (.360, 0., 4., [147.5, 193., 245., 298., 493., 596., 745., 884.,1490.,2235.]),
    (1.138, 0., 4., [147.5, 194., 246., 296., 490., 744., 884.,1768.,2652.,3536.]),
    (5.074, 3.074, 7.074, [98., 194., 245., 278.,301., 491., 558., 605., 1116.,1674.]),
    (7.634, 5.634, 9.634, [74., 149., 220., 278., 387., 441., 556., 664.,834.,1112.]),
]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def frozen():
    expected = json.loads((ROOT / "src-tauri/target/gymnopedie-missing-attacks/preservation.json").read_text())["after"]
    for name, value in expected.items():
        if sha(ROOT / name) != value:
            raise ValueError("baseline_changed: " + name)
    return {**expected, **{str(p.relative_to(ROOT)).replace("\\", "/"): sha(p) for p in SAVED.rglob("*") if p.is_file()}}


def contour_summary(c, point):
    times = c["start"] + np.arange(len(c["hz"]))*HOP/RATE
    mask = (times >= point-.12) & (times <= point+.20)
    subset = np.asarray(c["hz"])[mask]
    return {"id": c["index"], "start": c["start"], "end": c["end"],
            "localHzMedian": float(np.median(subset)) if len(subset) else None,
            "meanSalience": c["meanSalience"], "initialVoicingPass": c["initialVoicingPass"],
            "withinPitchRange": c["withinPitchRange"],
            "initialVoicedOctaveDuplicates": c["initialVoicedOctaveDuplicates"]}


def spectrum(signal, point):
    # One fixed 186 ms window. Zero padding interpolates peaks, not resolution.
    start = round((point+.055)*RATE)-4096
    segment = np.pad(signal, (8192,8192))[start+8192:start+16384]
    mag = abs(np.fft.rfft(segment*np.hanning(8192), n=65536))
    frequencies = np.fft.rfftfreq(65536, 1/RATE)
    peaks, _ = find_peaks(mag)
    peaks = [i for i in peaks if 60 <= frequencies[i] <= 4200]
    selected = sorted(peaks, key=lambda i: mag[i], reverse=True)[:40]
    return [{"hz": float(frequencies[i]), "amplitude": float(mag[i])} for i in selected]


def envelopes(signal, frequencies):
    # Complex demodulation: sigma 20 ms, Gaussian support +/-80 ms.
    # This distinguishes separated bands but cannot resolve close simultaneous attacks.
    times = np.arange(len(signal))/RATE
    values = {}
    offsets = np.arange(-round(.080*RATE),round(.080*RATE)+1)
    kernel = np.exp(-.5*(offsets/(.020*RATE))**2)
    kernel /= kernel.sum()
    for frequency in frequencies:
        demodulated = signal*np.exp(-2j*np.pi*frequency*times)
        smooth = fftconvolve(demodulated,kernel,mode="same")
        values[frequency] = 2*abs(smooth)[::HOP]
    return times[::HOP], values


def attack_evidence(times, envelope, point):
    change = np.diff(envelope, prepend=envelope[0])/(HOP/RATE)
    mask = (times >= point-.20) & (times <= point+.20)
    indices = np.flatnonzero(mask)
    best = indices[np.argmax(change[mask])]
    before = envelope[(times >= point-.18) & (times <= point-.08)]
    after = envelope[(times >= point+.03) & (times <= point+.13)]
    return {"largestLocalEnvelopeRiseTime": float(times[best]),
            "positiveRisePerSecond": max(0.,float(change[best])),
            "preAmplitude": float(np.median(before)), "postAmplitude": float(np.median(after)),
            "postPreRatio": float(np.median(after)/max(np.median(before),1e-12)),
            "contextRisePeaks": [{"time":float(times[i]),"risePerSecond":float(change[i])}
                 for i in find_peaks(change,distance=round(.1/(HOP/RATE)))[0]
                 if max(0,point-2)<=times[i]<=min(10,point+2) and change[i]>.1*max(change[mask].max(),1e-12)]}


def figure(point, start, end, times, bands, diagnostics, analyses):
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="800" viewBox="0 0 1080 800">',
             '<rect width="1080" height="800" fill="#111827"/>',
             '<style>text{font:13px sans-serif;fill:#edf1fa}</style>',
             f'<text x="80" y="25">Gymnopédie {point:.3f} s — 4-second context; no primary/accompaniment labels</text>']
    x = lambda t: 80+(t-start)/(end-start)*930
    for name, top in [("mix",65),("stem",350)]:
        parts.append(f'<text x="80" y="{top-12}">{name}: saved pre-selection contours (gray), saved accepted F0 (green)</text>')
        y = lambda hz: top+160-(np.log2(hz/60)/np.log2(1200/60))*150
        for hz in [75,150,300,600,1200]:
            parts.append(f'<text x="30" y="{y(hz):.1f}">{hz}</text><path d="M80 {y(hz):.1f}H1010" stroke="#334155"/>')
        for c in diagnostics[name]["stages"]["contours"]:
            ct = c["start"]+np.arange(len(c["hz"]))*HOP/RATE
            mask=(ct>=start)&(ct<=end)
            coords=[f'{x(t):.2f},{y(h):.2f}' for t,h in zip(ct[mask],np.asarray(c["hz"])[mask]) if h>=60]
            if coords:
                parts.append(f'<polyline points="{" ".join(coords)}" fill="none" stroke="#94a3b8" stroke-width="1.2"/>')
        frames=analyses[name]["frames"]
        # Separate voiced runs so no plotted line bridges an unvoiced gap.
        coords=[]
        for f in frames:
            if start<=f["time"]<=end and f["voiced"] and f["hz"]>=60:
                coords.append(f'{x(f["time"]):.2f},{y(f["hz"]):.2f}')
            elif coords:
                parts.append(f'<polyline points="{" ".join(coords)}" fill="none" stroke="#6ee7b7" stroke-width="2.5"/>');coords=[]
        if coords:
            parts.append(f'<polyline points="{" ".join(coords)}" fill="none" stroke="#6ee7b7" stroke-width="2.5"/>')
        parts.append(f'<path d="M{x(point):.1f} {top}V{top+160}" stroke="#fb7185"/>')
    top=575
    parts.append('<text x="80" y="560">Piano partial envelopes: each normalized independently for timing only (not loudness/lead rank)</text>')
    mask=(times>=start)&(times<=end)
    palette=['#fb7185','#fbbf24','#a78bfa','#38bdf8','#6ee7b7','#f472b6','#cbd5e1','#fb923c']
    for index,(frequency,values) in enumerate(bands.items()):
        vals=values[mask]; normalized=vals/max(vals.max(),1e-12)
        coords=' '.join(f'{x(t):.2f},{top+150-v*145:.2f}' for t,v in zip(times[mask][::3],normalized[::3]))
        color=palette[index%len(palette)]
        parts.append(f'<polyline points="{coords}" fill="none" stroke="{color}" stroke-width="1"/>')
        parts.append(f'<text x="{80+index*90}" y="750" style="fill:{color}">{frequency:g} Hz</text>')
    parts.append(f'<path d="M{x(point):.1f} {top}V725" stroke="#fb7185"/>')
    for t in np.arange(start,end+.01,.5):
        parts.append(f'<text x="{x(t):.1f}" y="780">{t:.2f}s</text>')
    parts.append('</svg>')
    text=''.join(parts);ElementTree.fromstring(text)
    (OUTPUT/f'{point:.3f}-context.svg').write_text(text,encoding='utf-8')


def main():
    before=frozen();OUTPUT.mkdir(parents=True,exist_ok=True)
    diagnostics={name:json.loads((SAVED/f'{name}-diagnostic.json').read_text()) for name in ['mix','stem']}
    analyses={name:json.loads((BASE/name/'analysis.json').read_text()) for name in ['mix','stem']}
    audio={}
    for name in ['mix','stem']:
        samples,rate=sf.read(BASE/f'{name}-input.wav',dtype='float32',always_2d=True)
        assert rate==RATE and len(samples)==RATE*10
        audio[name]=samples.mean(axis=1)
        assert diagnostics[name]['inputSha256']==sha(BASE/f'{name}-input.wav')
    frequencies=sorted(set(f for *_,fs in CASES for f in fs))
    signals={name:envelopes(signal,frequencies) for name,signal in audio.items()}
    rows=[]
    for point,start,end,partials in CASES:
        row={'location':point,'contextStart':start,'contextEnd':end,'semantic':False,'inputs':{}}
        for name in ['mix','stem']:
            times,bands=signals[name]
            candidates=[c for c in diagnostics[name]['stages']['contours'] if c['start']<point+.20 and c['end']>point-.12]
            row['inputs'][name]={'spectralPeaks':spectrum(audio[name],point),
                'contours':[contour_summary(c,point) for c in candidates],
                'partialEnvelopes':{str(f):attack_evidence(times,bands[f],point) for f in partials}}
            subset={f:bands[f] for f in partials}
            with (OUTPUT/f'{point:.3f}-{name}-envelopes.csv').open('w',newline='') as file:
                writer=csv.writer(file);writer.writerow(['time']+[f'{f:g}Hz' for f in partials])
                mask=(times>=start)&(times<=end)
                writer.writerows(zip(times[mask],*(v[mask] for v in subset.values())))
            sf.write(OUTPUT/f'{point:.3f}-{name}-context.wav',audio[name][round(start*RATE):round(end*RATE)],RATE,subtype='PCM_16')
        sf.write(OUTPUT/f'{point:.3f}-pair-context.wav',np.c_[audio['mix'],audio['stem']][round(start*RATE):round(end*RATE)],RATE,subtype='PCM_16')
        figure(point,start,end,signals['stem'][0],{f:signals['stem'][1][f] for f in partials},diagnostics,analyses)
        rows.append(row)
    result={'scope':'Read-only polyphonic evidence; frequencies are partials, not assigned primary notes.',
        'method':{'envelopeSigmaSeconds':.020,'envelopeSupportSecondsEachSide':.080,'hopSeconds':HOP/RATE,
            'spectrumWindowSeconds':8192/RATE,'warning':'Largest envelope rise is not a validated note onset. Differences under 80 ms are unresolved; independent band normalization is only for display.'},
        'cases':rows,'acceptedStemEvents':[n['start'] for n in analyses['stem']['notes']],
        'semanticEventsProduced':0,'newModelRuns':0,'protectedFiles':len(before)}
    (OUTPUT/'audit.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    clips=[{'time':p,'start':s,'end':e} for p,s,e,_ in CASES]
    page='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Gymnopédie polyphonic context audit</title>
<style>body{font:16px system-ui;background:#111827;color:#edf1fa;max-width:1080px;margin:32px auto;padding:16px}button,select{font:inherit;margin:8px 8px 8px 0;padding:9px}audio,img{width:100%}</style>
<h1>Gymnopédie — overlapping pitch evidence</h1><p>Four seconds of aligned context. Higher/lower components remain unlabeled. No inferred pitches, new note events or Grid changes.</p>
<select aria-label="Diagnostic location"></select><p id="range"></p><button data-mode="mix">Original mix</button><button data-mode="stem">Saved piano</button><button data-mode="pair">Mix left / piano right</button>
<audio controls></audio><p id="position"></p><img alt="Saved internal contours and observed partial envelopes"><p>Gray contours are alternatives, not independently confirmed notes. Green is the saved accepted F0. Envelope lines have separate display scaling; they do not rank melody ownership. All clips retain equal input gain.</p>
<script>const clips=__CLIPS__,select=document.querySelector('select'),audio=document.querySelector('audio');let mode='mix',generation=0;
clips.forEach((c,i)=>{const o=document.createElement('option');o.value=i;o.textContent=c.time.toFixed(3)+' s';select.append(o)});
function load(time=0,playing=false){const ticket=++generation,c=clips[Number(select.value)];audio.pause();audio.src=c.time.toFixed(3)+'-'+mode+'-context.wav';audio.onloadedmetadata=()=>{if(ticket!==generation)return;audio.currentTime=time>=audio.duration?0:time;if(playing)audio.play()};document.querySelector('#range').textContent='Original interval '+c.start.toFixed(3)+'–'+c.end.toFixed(3)+' s; diagnostic location '+(c.time-c.start).toFixed(3)+' s into clip';document.querySelector('img').src=c.time.toFixed(3)+'-context.svg';}
select.onchange=()=>load();document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{const time=audio.currentTime,playing=!audio.paused;mode=b.dataset.mode;load(time,playing)});
audio.ontimeupdate=()=>document.querySelector('#position').textContent='Original position '+(clips[Number(select.value)].start+audio.currentTime).toFixed(3)+' s · '+mode;load();</script></html>'''
    (OUTPUT/'listen.html').write_text(page.replace('__CLIPS__',json.dumps(clips)),encoding='utf-8')
    after=frozen();assert before==after
    (OUTPUT/'preservation.json').write_text(json.dumps({'before':before,'after':after,'unchanged':True},indent=2),encoding='utf-8')
    print(json.dumps({'protectedFiles':len(before),'semanticEventsProduced':0,'newModelRuns':0,'cases':len(rows),'acceptedStemEvents':result['acceptedStemEvents']}))


if __name__=='__main__':
    main()
