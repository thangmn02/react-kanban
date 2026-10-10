"""Private installed-Essentia stage inspection; guessed pitches never become events."""
import csv
import hashlib
import json
from pathlib import Path
import wave

import essentia.standard as es
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "src-tauri/target/generalized-melody/gymnopedie/input-ab"
OUTPUT = ROOT / "src-tauri/target/gymnopedie-upstream-f0"
LOCATIONS = [0.360, 1.138, 5.074, 7.634]
RATE, HOP = 44100, 128


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def frozen():
    record = json.loads((ROOT / "src-tauri/target/gymnopedie-missing-attacks/preservation.json").read_text())["after"]
    for name, expected in record.items():
        if sha(ROOT / name) != expected:
            raise ValueError("protected_baseline_changed: " + name)
    return record


def params(algorithm, values):
    return {name: values[name] for name in algorithm.parameterNames() if name in values}


def hz(bins, p):
    return p["referenceFrequency"] * 2**(np.asarray(bins)*p["binResolution"]/1200)


def inspect(signal, p, saved):
    # Use exposed installed components in the documented composite chain.
    window = es.Windowing(size=p["frameSize"], zeroPadding=3*p["frameSize"], type="hann")
    spectrum = es.Spectrum(size=4*p["frameSize"])
    spectral = es.SpectralPeaks(minFrequency=1, maxFrequency=20000, maxPeaks=100,
                               sampleRate=RATE, magnitudeThreshold=0, orderBy="magnitude")
    salience = es.PitchSalienceFunction(**params(es.PitchSalienceFunction(),p))
    peaks = es.PitchSalienceFunctionPeaks(binResolution=p["binResolution"], referenceFrequency=p["referenceFrequency"],
                                         minFrequency=1,maxFrequency=20000)
    bins, values, nearby = [], [], {str(t):[] for t in LOCATIONS}
    for index, frame in enumerate(es.FrameGenerator(signal,frameSize=p["frameSize"],hopSize=HOP,startFromZero=False)):
        frequencies,magnitudes = spectral(spectrum(window(frame)))
        function = salience(frequencies,magnitudes)
        pitch_bins,pitch_values = peaks(function)
        bins.append(pitch_bins); values.append(pitch_values)
        time = index*HOP/RATE
        for point in LOCATIONS:
            if point <= time < point+.15:
                # Top candidates are evidence, never class/lead labels.
                order = np.argsort(pitch_values)[-5:][::-1]
                nearby[str(point)].append({"time":time,
                    "spectralPeaks":[{"hz":float(f),"magnitude":float(m)} for f,m in zip(frequencies[:12],magnitudes[:12])],
                    "saliencePeaks":[{"bin":float(pitch_bins[i]),"hz":float(hz(pitch_bins[i],p)),"salience":float(pitch_values[i])} for i in order]})
    contour_algorithm = es.PitchContours()
    contour_algorithm.configure(**params(contour_algorithm,p))
    contours, strengths, starts, duration = contour_algorithm(bins,values)
    melody = es.PitchContoursMelody()
    melody.configure(**params(melody,p))
    pitch, confidence = melody(contours,strengths,starts,duration)
    count = len(saved["frames"])
    expected_pitch = np.array([f["hz"] for f in saved["frames"]])
    expected_confidence = np.array([f["pitchConfidence"] for f in saved["frames"]])
    if not np.array_equal(pitch[:count],expected_pitch) or not np.array_equal(confidence[:count],expected_confidence):
        raise ValueError("exposed_stages_do_not_reproduce_baseline")
    return {"baselineReproducedExactly":True,"nearbyFrames":nearby,
            "contours":[{"index":i,"start":float(start),"end":float(start+len(b)*HOP/RATE),
                         "hz":hz(b,p).tolist(),"salience":[float(v) for v in s],"meanSalience":float(np.mean(s))}
                        for i,(b,s,start) in enumerate(zip(contours,strengths,starts))]}


def write_wav(path, samples):
    # Audition only: same gain and time interval, bounded PCM conversion.
    with wave.open(str(path),"wb") as output:
        output.setnchannels(samples.shape[1]);output.setsampwidth(2);output.setframerate(RATE)
        output.writeframes((np.clip(samples,-1,1)*32767).astype("<i2").tobytes())


def describe_gates(result):
    p = result["baselineParameters"]
    contours = result["stages"]["contours"]
    means = np.array([c["meanSalience"] for c in contours])
    gate = float(np.mean(means)-p["voicingTolerance"]*np.std(means))
    minimum = max(0,np.floor(1200/p["binResolution"]*np.log2(p["minFrequency"]/p["referenceFrequency"])+.5))
    maximum = min(np.floor(6000/p["binResolution"])-1,np.floor(1200/p["binResolution"]*np.log2(p["maxFrequency"]/p["referenceFrequency"])+.5))
    for contour in contours:
        bins = np.rint(1200/p["binResolution"]*np.log2(np.array(contour["hz"])/p["referenceFrequency"]))
        contour["pitchStdCents"] = float(np.std(bins)*p["binResolution"])
        contour["withinPitchRange"] = bool(min(bins)>=minimum and max(bins)<=maximum)
        contour["initialVoicingPass"] = bool(contour["withinPitchRange"] and (
            contour["meanSalience"]>=gate or contour["pitchStdCents"]>40))
        contour["binsForAudit"] = bins.tolist()
    # Source-derived statistics explain initial voicing, not a new classifier.
    result["voicingGateAudit"] = {"approximateSalienceThreshold":gate,"voiceVibrato":p["voiceVibrato"],
                                  "source":"Essentia PitchContoursMelody voicingDetection; no parameter changed"}
    for contour in contours:
        duplicates = []
        if contour["initialVoicingPass"]:
            for other in contours:
                if other["index"] == contour["index"] or not other["initialVoicingPass"]:
                    continue
                a0,b0 = round(contour["start"]*RATE/HOP),round(other["start"]*RATE/HOP)
                left,right = max(a0,b0),min(a0+len(contour["hz"])-1,b0+len(other["hz"])-1)
                if right < left:
                    continue
                distance = abs(np.mean(np.array(contour["binsForAudit"])[left-a0:right-a0+1]-
                    np.array(other["binsForAudit"])[left-b0:right-b0+1]))*p["binResolution"]
                if 1150 < distance < 1250:
                    duplicates.append(other["index"])
        contour["initialVoicedOctaveDuplicates"] = duplicates
    for row in result["rows"]:
        chosen = []
        for frame in result["guessedFrames"]:
            if not row["time"] <= frame["time"] < row["time"]+.15 or frame["signedConfidence"]>=0:
                continue
            index = round(frame["time"]*RATE/HOP)
            for contour in contours:
                shift = index-round(contour["start"]*RATE/HOP)
                # Float32 cent-to-Hz conversion differs slightly between components.
                if 0<=shift<len(contour["hz"]) and abs(1200*np.log2(contour["hz"][shift]/frame["hz"])) < .2 and abs(
                        contour["meanSalience"]+frame["signedConfidence"]) < 1e-7:
                    chosen.append(contour["index"])
        row["guessedContourIds"] = sorted(set(chosen))
        row["candidateGateEvidence"] = [{k:contours[i][k] for k in ["index","start","end","meanSalience","pitchStdCents","withinPitchRange","initialVoicingPass","initialVoicedOctaveDuplicates"]} for i in row["guessedContourIds"]]
    return result


def main():
    before = frozen(); OUTPUT.mkdir(exist_ok=True)
    inputs, results = {}, {}
    for name in ["mix","stem"]:
        path = BASE / f"{name}-input.wav"
        saved = json.loads((BASE / name / "analysis.json").read_text())
        if sha(path) != saved["audioSha256"]:
            raise ValueError("analysis_input_hash_mismatch")
        raw, rate, *_ = es.AudioLoader(filename=str(path))()
        signal = es.EqloudLoader(filename=str(path),sampleRate=RATE)()
        if rate != RATE or len(signal) != len(raw) or len(raw) != RATE*10:
            raise ValueError("input_clock_mismatch")
        inputs[name] = np.mean(raw,axis=1)
        p = saved["parameters"]
        cached = OUTPUT / f"{name}-diagnostic.json"
        if cached.exists():
            value = json.loads(cached.read_text())
            if value["inputSha256"] != sha(path) or value["baselineParameters"] != p:
                raise ValueError("cached_diagnostic_input_changed")
            results[name] = describe_gates(value)
            cached.write_text(json.dumps(results[name],indent=2),encoding="utf-8")
            continue
        stages = inspect(signal,p,saved)
        guessed = es.PredominantPitchMelodia(**{**p,"guessUnvoiced":True})
        guessed_pitch,guessed_confidence = guessed(signal)
        actual = {k:guessed.paramValue(k) for k in guessed.parameterNames()}
        if [k for k in actual if actual[k] != p[k]] != ["guessUnvoiced"]:
            raise ValueError("more_than_one_parameter_changed")
        frames = [{"time":i*HOP/RATE,"hz":float(f),"signedConfidence":float(c),"semantic":False}
                  for i,(f,c) in enumerate(zip(guessed_pitch,guessed_confidence)) if i*HOP/RATE<10]
        rows = []
        for point in LOCATIONS:
            subset = [f for f in frames if point <= f["time"] < point+.15]
            inferred = [f for f in subset if f["signedConfidence"] < 0 and f["hz"] > 0]
            old = [f for f in saved["frames"] if point <= f["time"] < point+.15]
            candidates = [c for c in stages["contours"] if c["start"] < point+.15 and c["end"] > point]
            rows.append({"time":point,"baselineVoicedFrames":sum(f["voiced"] for f in old),"frames":len(old),
                         "guessedNegativeConfidenceFrames":len(inferred),"guessedPositiveConfidenceFrames":sum(f["signedConfidence"]>0 for f in subset),
                         "guessedZeroFrames":sum(f["hz"]==0 for f in subset),
                         "guessedHzMedian":float(np.median([f["hz"] for f in inferred])) if inferred else None,
                         "guessedHzRange":[min(f["hz"] for f in inferred),max(f["hz"] for f in inferred)] if inferred else None,
                         "guessedConfidenceMedian":float(np.median([f["signedConfidence"] for f in inferred])) if inferred else None,
                         "overlappingContourIds":[c["index"] for c in candidates]})
        results[name] = describe_gates({"inputSha256":sha(path),"baselineParameters":p,"diagnosticParameters":actual,
                         "rows":rows,"stages":stages,"guessedFrames":frames,"semantic":False})
        (OUTPUT / f"{name}-diagnostic.json").write_text(json.dumps(results[name],indent=2),encoding="utf-8")
        with (OUTPUT / f"{name}-guessed-contour.csv").open("w",newline="") as output:
            writer=csv.DictWriter(output,fieldnames=list(frames[0]));writer.writeheader();writer.writerows(frames)
    audio = []
    for point in LOCATIONS:
        start,end = point-.20,point+.60
        a,b = round(start*RATE),round(end*RATE)
        pair = np.c_[inputs["mix"][a:b],inputs["stem"][a:b]]
        filename = f"{point:.3f}-mix-left-piano-right.wav"
        write_wav(OUTPUT / filename,pair)
        write_wav(OUTPUT / f"{point:.3f}-mix.wav",pair[:,:1])
        write_wav(OUTPUT / f"{point:.3f}-piano.wav",pair[:,1:])
        audio.append({"time":point,"start":a/RATE,"end":b/RATE,"frames":b-a,"file":filename})
    after = frozen()
    if before != after:
        raise ValueError("baseline_mutated")
    report = {"locations":LOCATIONS,"audio":audio,"semanticEventsProduced":0,
              "protectedFiles":len(before),"preserved":True,"inputs":{k:v["rows"] for k,v in results.items()}}
    (OUTPUT / "report.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
    (OUTPUT / "preservation.json").write_text(json.dumps({"before":before,"after":after}),encoding="utf-8")
    # Audio-only comparison; existing Grid and fixture page are not changed.
    page = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Gymnopédie upstream F0 diagnostic</title><style>body{font:17px system-ui;background:#121724;color:#edf1fa;max-width:850px;margin:40px auto;padding:20px}button,select{font:inherit;padding:10px;margin:6px}audio{width:100%}</style>
<h1>Four aligned input comparisons</h1><p>Diagnostic waveform peaks, not confirmed melody notes. No guessed pitches or note events are played. The existing Beat Grid is unchanged.</p>
<select aria-label="Diagnostic location"></select><p id="range"></p>
<button data-mode="mix">Original mix</button><button data-mode="piano">Saved piano</button><button data-mode="mix-left-piano-right">Mix left / piano right</button>
<audio controls></audio><p id="status"></p><p>Each clip is 0.8 seconds at equal input gain. The investigated peak is 0.2 seconds into the clip. Channel switching preserves clip position and playback state. Use headphones for the stereo pair.</p>
<script>const clips=__CLIPS__,select=document.querySelector('select'),audio=document.querySelector('audio');let mode='mix',generation=0;
clips.forEach((c,i)=>{const option=document.createElement('option');option.value=i;option.textContent=c.time.toFixed(3)+' s';select.append(option)});
function load(time=0,playing=false){const ticket=++generation,c=clips[Number(select.value)];audio.pause();audio.src=c.time.toFixed(3)+'-'+mode+'.wav';audio.onloadedmetadata=()=>{if(ticket!==generation)return;audio.currentTime=time>=audio.duration?0:time;if(playing)audio.play()};document.querySelector('#range').textContent='Original interval: '+c.start.toFixed(3)+'–'+c.end.toFixed(3)+' s';}
select.onchange=()=>load();document.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>{const time=audio.currentTime,playing=!audio.paused;mode=button.dataset.mode;load(time,playing)});
audio.ontimeupdate=()=>document.querySelector('#status').textContent='Original position '+(clips[Number(select.value)].start+audio.currentTime).toFixed(3)+' s · '+mode;load();</script></html>'''
    (OUTPUT / "listen.html").write_text(page.replace("__CLIPS__",json.dumps(audio)),encoding="utf-8")
    print(json.dumps(report,indent=2),flush=True)


if __name__ == "__main__":
    main()
