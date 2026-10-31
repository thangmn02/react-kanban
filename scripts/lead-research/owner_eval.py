"""Owner clips (owner-reviewed drafts, not yet human-verified): Levels 30–60 s, Praise The Lord 30–54 s.
Levels refs = owner's added notes lag-corrected by the measured 46 ms; Praise refs = accepted + uncertain markers."""
import json, sys
sys.path.insert(0, 'scratch/lead-backend')
import policy_eval as pe
def refs(path, lagfix):
    d = json.load(open(path, encoding='utf-8')); a, b = d['region']['start'], d['region']['end']
    if lagfix: return a, b, sorted(m['time'] - .046 for m in d['markers'] if m['origin'] == 'manual')
    return a, b, sorted(m['time'] for m in d['markers'] if m['status'] in ('accepted', 'uncertain'))
cases = [('Levels', 'scratch/lead-backend/stems/Levels-full', 'C:/Users/thang/Downloads/Avicii - Levels.30.0-60.0.lead-annotation.json', True),
         ('Praise', 'scratch/lead-backend/stems/Praise-full', 'C:/Users/thang/Downloads/A$AP Rocky - Praise The Lord (Da Shine) (Official Video) ft. Skepta.30.0-54.0.lead-annotation.json', False)]
for name, d, ann, lag in cases:
    a, b, r = refs(ann, lag); tr = json.load(open(d + '/tracks.json'))
    out = {'refs': len(r)}
    def sc(ev): ev = [t for t in ev if a <= t < b]; tp = pe.match(r, ev, .05); return {'events': len(ev), 'precision': round(tp / max(1, len(ev)), 2), 'recall': round(tp / len(r), 2), 'f1': round(2 * tp / (len(ev) + len(r)), 2)}
    out['c5 mix'] = sc([e['t'] for e in tr['mix']['events']]); out['c6A mix'] = sc(tr['mixC6'])
    for pol in ('dom', 'inst'):
        _, _, ev, owner = pe.evaluate(None, d, pol, .3, .2)
        win = [o for i, o in enumerate(owner) if a <= i * pe.STEP < b]
        out['stems ' + pol] = {**sc(ev), 'ownerShare': {k: round(win.count(k) / len(win), 2) for k in ('other', 'vocals', None)}}
    print(name, json.dumps(out))
