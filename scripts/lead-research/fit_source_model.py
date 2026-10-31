"""Gaussian source model over timbral cues, evaluated leave-one-track-out (LOTO).

Labels come from MedleyDB INTERVALS + stem metadata (which stem carries MELODY1) and, for piano, the
Gymnopedie solo-piano recording (source identity known; its note labels are not used). Only frames where
candidate-6's owner sat on the annotated melody contribute, so the cues describe the true melodic source.
"""
import json, math, collections
import numpy as np

FEATURES = ['attackMs', 'decayDbPerSecond', 'vibratoSemitones', 'glideSemitones']
CLASSES = ['piano', 'guitar', 'other', 'vocal']
rows = json.load(open('scratch/live-lead-261031/cues.json')) + json.load(open('scratch/live-lead-261031/cues-piano.json'))
rows = [r for r in rows if all(isinstance(r.get(f), (int, float)) and math.isfinite(r[f]) for f in FEATURES)]


def fit(train):
    model = {'features': FEATURES, 'minNotes': 3, 'temperature': 1.0, 'classes': []}
    for c in CLASSES:
        x = np.array([[r[f] for f in FEATURES] for r in train if r['class'] == c])
        if len(x) < 5: continue
        # Each track counts once in the prior so long excerpts do not dominate.
        tracks = {r['track'] for r in train if r['class'] == c}
        model['classes'].append({'source': c, 'prior': len(tracks), 'mean': x.mean(0).tolist(), 'sd': np.maximum(x.std(0), [3, 2, .02, .05]).tolist()})
    total = sum(c['prior'] for c in model['classes'])
    for c in model['classes']: c['prior'] /= total
    return model


def posterior(model, r, temperature):
    v = np.array([r[f] for f in FEATURES])
    logs = np.array([math.log(c['prior']) + float(np.sum(-.5 * ((v - c['mean']) / c['sd']) ** 2 - np.log(c['sd']))) for c in model['classes']])
    w = np.exp((logs - logs.max()) * temperature); w /= w.sum()
    return [c['source'] for c in model['classes']], w


tracks = sorted({r['track'] for r in rows})
loto = []
for t in tracks:
    model = fit([r for r in rows if r['track'] != t])
    for r in rows:
        if r['track'] == t: loto.append((r, model))


def evaluate(temperature, threshold=.6):
    confusion = collections.Counter(); nll = 0; covered = correct = 0
    for r, model in loto:
        names, w = posterior(model, r, temperature)
        p_true = w[names.index(r['class'])] if r['class'] in names else 1e-6
        nll -= math.log(max(p_true, 1e-6))
        best = names[int(w.argmax())]; conf = float(w.max())
        guess = best if conf >= threshold else 'unknown'
        confusion[(r['class'], guess)] += 1
        if guess != 'unknown': covered += 1; correct += guess == r['class']
    return nll / len(loto), confusion, covered / len(loto), (correct / covered if covered else None)


temperatures = [.25, .5, .75, 1.0]
best_t = min(temperatures, key=lambda t: evaluate(t)[0])
nll, confusion, coverage, accuracy = evaluate(best_t)
per_class = {c: {g: confusion[(c, g)] for g in CLASSES + ['unknown'] if confusion[(c, g)]} for c in CLASSES}
majority = max(collections.Counter(r['class'] for r in rows).values()) / len(rows)
final = fit(rows); final['temperature'] = best_t
report = {'samples': len(rows), 'tracks': len(tracks), 'perClassSamples': dict(collections.Counter(r['class'] for r in rows)),
          'temperature': best_t, 'lotoLogLoss': round(nll, 3), 'confidenceThreshold': .6,
          'lotoCoverageAtThreshold': round(coverage, 3), 'lotoAccuracyWhenConfident': None if accuracy is None else round(accuracy, 3),
          'majorityClassBaseline': round(majority, 3), 'lotoConfusion': per_class,
          'pianoNote': 'Piano cues come from one solo recording; leaving it out removes the piano class, so piano LOTO is not measurable.'}
json.dump(final, open('scratch/live-lead-261031/source-model.json', 'w'), indent=1)
json.dump(report, open('scratch/live-lead-261031/source-model-report.json', 'w'), indent=1)
print(json.dumps(report, indent=1))
