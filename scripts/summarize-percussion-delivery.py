"""Separate real-media capture boundary and learned/transport/DOM delay."""
import argparse
import json
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import correlate, correlation_lags


def distribution(values):
    return {"count": len(values), "medianMs": float(np.median(values)) if values else None,
            "p95Ms": float(np.percentile(values, 95)) if values else None}


def summarize(trace, audio=None):
    batches = trace["diagnostics"]
    decisions = [(batch, frame, event) for batch in batches for frame in batch.get("diagnostics", []) for event in frame["events"]]
    timings = {
        "inference": distribution([b["durationMs"] for b in batches]),
        "workerQueue": distribution([b["inferenceStartedAt"]-b["workerReceivedAt"] for b in batches]),
        "featureToWorkerTransport": distribution([b["workerReceivedAt"]-b["postedAt"] for b in batches]),
        "workerToMainTransport": distribution([b["mainThreadReceivedAt"]-b["inferenceEndedAt"] for b in batches]),
        "peakConfirmation": distribution([(e["decisionAudioTime"]-e["audioTime"])*1000 for _,_,e in decisions]),
    }
    for stage in ("EVENT_RECEIVED", "EVENT_ACCEPTED", "EVENT_COMMITTED", "EVENT_RENDERED"):
        timings[stage] = distribution([r["offsetMs"] for r in trace["ui"] if r["stage"]==stage and r.get("source")=="onset"
                                       and r.get("type") in ("kick", "snare", "hat") and "offsetMs" in r])
    semantic = [r for r in trace["ui"] if r.get("source")=="onset" and r.get("type") in ("kick", "snare", "hat")]
    by_id = {}
    for record in semantic:
        by_id.setdefault(record["id"], {}).setdefault(record["stage"], record)
    timings["EVENT_RECEIVED"]["count"] = sum("EVENT_RECEIVED" in records for records in by_id.values())
    timings["EVENT_RECEIVED"]["clock"] = "producer audio seconds; no epoch offset at this stage"
    detected={r["id"]:r for r in trace["capture"] if r.get("component")=="percussion-classifier"
              and r["stage"]=="EVENT_DETECTED" and "id" in r}
    timings["producerToBridge"] = distribution([records["EVENT_RECEIVED"]["at"]-detected[event_id]["at"]
        for event_id, records in by_id.items() if event_id in detected and "EVENT_RECEIVED" in records])
    # Received records still use the producer audio clock. Compare stages by
    # identity instead of treating missing epoch offsets as missing deliveries.
    for left,right in (("EVENT_RECEIVED","EVENT_ACCEPTED"), ("EVENT_ACCEPTED","EVENT_STATE_COMMITTED"),
                       ("EVENT_STATE_COMMITTED","EVENT_COMMITTED"), ("EVENT_COMMITTED","EVENT_RENDERED")):
        timings[f"{left}_to_{right}"] = distribution([records[right]["at"]-records[left]["at"]
                                                    for records in by_id.values() if left in records and right in records])
    stages=("EVENT_RECEIVED","EVENT_ACCEPTED","EVENT_STATE_COMMITTED","EVENT_COMMITTED","EVENT_RENDERED")
    counts={row:{stage:sum(stage in records and records[stage]["type"]==row for records in by_id.values())
                 for stage in stages} for row in ("kick","snare","hat")}
    visual=trace.get("visual",{})
    missing=[]
    for event_id, records in by_id.items():
        if "EVENT_COMMITTED" not in records or "EVENT_RENDERED" in records:
            continue
        committed=records["EVENT_COMMITTED"]
        removed=next((m for m in visual.get("mutations",[]) if m["id"]==event_id and m["at"]>=committed["at"]),None)
        painted=any(event_id in frame["ids"] for frame in visual.get("frames",[]))
        missing.append({"id":event_id,"type":committed["type"],"domAt":committed["at"],
                        "removedAfterMs":removed["at"]-committed["at"] if removed else None,
                        "presentAtAnimationFrame":painted})
    capture = trace.get("capturedPCM")
    if capture and audio:
        reference, rate = sf.read(audio, dtype="float32", always_2d=True)
        if rate != 44100:
            raise ValueError("Timing fixture must use 44.1 kHz")
        reference = reference.mean(axis=1)
        observed = np.asarray(capture["data"], dtype=np.float32)
        lag = correlation_lags(len(observed), len(reference))
        expected = trace["startClock"]["audioTime"]-trace["startClock"]["mediaTime"]-capture["start"]
        valid = (lag/rate >= expected-.05) & (lag/rate <= expected+.5)
        candidates = np.where(valid)[0]
        correlation = correlate(observed, reference, method="fft")
        winner = candidates[np.argmax(correlation[candidates])]
        shift = int(lag[winner])
        a, b = max(0,shift), max(0,-shift)
        n = min(len(observed)-a,len(reference)-b)
        x,y=observed[a:a+n],reference[b:b+n]
        similarity=float(np.dot(x,y)/(np.linalg.norm(x)*np.linalg.norm(y)))
        timings["captureBoundary"]={"estimatedMs": (shift/rate-expected)*1000,"signalSimilarity":similarity,
                                    "validated":False,"limitation":"Signal alignment estimate only; HTML clock sampling and capture resampling are not independently calibrated",
                                    "method":"Known fixture PCM cross-correlation against HTML media/audio clock anchor; not physical speaker latency"}
    return {"summary":trace["summary"],"stages":timings,"rowStageCounts":counts,"missingAnimation":missing,
            "producerDrops":{reason:sum(r.get("reason")==reason for r in trace["capture"] if r["stage"]=="EVENT_DROPPED")
                             for reason in {r.get("reason") for r in trace["capture"] if r["stage"]=="EVENT_DROPPED"}},
            "drops":{reason:sum(r.get("reason")==reason for r in trace["ui"] if r["stage"]=="EVENT_DROPPED")
                     for reason in {r.get("reason") for r in trace["ui"] if r["stage"]=="EVENT_DROPPED"}}}


if __name__ == "__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--input",required=True)
    parser.add_argument("--audio")
    parser.add_argument("--output",required=True)
    args=parser.parse_args()
    result=summarize(json.loads(Path(args.input).read_text()),args.audio)
    Path(args.output).write_text(json.dumps(result,indent=2))
    print(json.dumps({"summary":result["summary"],"rowStageCounts":result["rowStageCounts"],
                      "missingAnimations":len(result["missingAnimation"]),"producerDrops":result["producerDrops"]}))
