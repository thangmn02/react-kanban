"""Lead-selection policies over Spleeter stems, scored on MusicDelta (MELODY2 + INTERVALS source labels).

Policies (per 1 s window, 0.25 s step, 0.5 s switching hysteresis):
  inst  — owner's rule: the instrument ("other") stem leads whenever it carries a clear melodic line, else vocals.
  dom   — whichever stem's melodic line is clearer and louder.
Baselines on the full mix: candidate-5 (salience tracker) and candidate-6A (onsets only).
"""
import json, sys, glob, os, itertools
import numpy as np, soundfile as sf

ROOT = 'scratch/lead-backend/stems/'
ANN = 'scratch/live-lead-261031/annotations/'
labels = json.load(open('scratch/live-lead-261031/source-labels.json'))
manifest = json.load(open('C:/Users/thang/OneDrive/Documents/react-kanban/react-kanban/scratch/beat-grid-v2/corpus-manifest.json'))
partition = {i['id'].replace('-full-mix', ''): i['partition'] for i in manifest['items'] if i['id'].endswith('-full-mix')}
WIN, STEP, HOLD = 1.0, .25, 2


def ref_onsets(ann, end):
    hop = ann[1, 0] - ann[0, 0]; out = []; cur = np.nan; last = -1e9
    midi = np.where(ann[:, 1] > 0, 69 + 12 * np.log2(np.maximum(ann[:, 1], 1e-9) / 440), np.nan)
    for i, (t, m) in enumerate(zip(ann[:, 0], midi)):
        if t >= end: break
        if not np.isfinite(m): continue
        if t - last > .05 + hop: out.append(t); cur = m
        elif abs(m - cur) >= .8:
            h = int(np.ceil(.06 / hop)); seg = midi[i:i + h]
            if len(seg) == h and np.all(np.isfinite(seg)) and np.all(np.abs(seg - m) < .5): out.append(t); cur = m
        else: cur = cur * .9 + m * .1
        last = t
    return out


def match(refs, preds, tol):
    pairs = sorted((abs(p - r), r, p) for r in refs for p in preds if abs(p - r) <= tol)
    ur, up = set(), set()
    for _, r, p in pairs:
        if r not in ur and p not in up: ur.add(r); up.add(p)
    return len(ur)


def window_choice(tr, d, policy, theta, emin):
    """Per-window owner: 'other' | 'vocals' | None."""
    energy = {}
    for s in ('vocals', 'other'):
        w, _ = sf.read(os.path.join(d, s + '.wav'), dtype='float32'); energy[s] = w
    end = len(energy['vocals']) / 44100
    choices, times = [], np.arange(0, end, STEP)
    frames = {s: np.array([[f[0], f[1] if f[1] is not None else np.nan] for f in tr[s]['frames']]) for s in ('vocals', 'other')}
    for t in times:
        ev = {}
        e = {s: float(np.mean(energy[s][int(max(0, t - WIN / 2) * 44100):int((t + WIN / 2) * 44100)] ** 2) + 1e-12) for s in energy}
        for s in ('vocals', 'other'):
            f = frames[s]; sel = f[(f[:, 0] >= t - WIN / 2) & (f[:, 0] < t + WIN / 2), 1]
            if len(sel) < 4: ev[s] = 0; continue
            voiced = np.isfinite(sel); vs = voiced.mean()
            pairs = voiced[1:] & voiced[:-1]; steps = np.abs(np.diff(sel))[pairs[:len(np.diff(sel))]]
            stable = (steps < 1).mean() if len(steps) else 0
            share = e[s] / (e['vocals'] + e['other'])
            ev[s] = vs * stable if share >= emin else 0
        if policy == 'inst': c = 'other' if ev['other'] >= theta else 'vocals' if ev['vocals'] >= theta else None
        else:
            best = max(ev, key=ev.get); c = best if ev[best] >= theta else None
        choices.append(c)
    # Hysteresis: a new owner must hold for HOLD consecutive windows.
    out, cur, pend, count = [], None, None, 0
    for c in choices:
        if c == cur: pend, count = None, 0
        elif c == pend:
            count += 1
            if count >= HOLD: cur, pend, count = c, None, 0
        else: pend, count = c, 1
        if cur is None and c is not None and pend == c and count >= 1: cur = c
        out.append(cur)
    return times, out


def evaluate(track, d, policy, theta, emin):
    tr = json.load(open(os.path.join(d, os.environ.get('TRACKS', 'tracks.json'))))
    times, owner = window_choice(tr, d, policy, theta, emin)
    at = lambda t: owner[min(len(owner) - 1, int(round(t / STEP)))]
    frames = {s: tr[s]['frames'] for s in ('vocals', 'other')}
    lead = [(f[0], f[1] if at(f[0]) == 'vocals' else None) for f in frames['vocals']]
    other_pitch = {round(f[0], 3): f[1] for f in frames['other']}
    lead = [(t, (other_pitch.get(round(t, 3)) if at(t) == 'other' else p)) for t, p in lead]
    events = sorted(e['t'] for s in ('vocals', 'other') for e in tr[s]['events'] if at(e['t']) == s)
    return tr, lead, events, owner


def score(set_name, policy, theta, emin, verbose=False):
    rows = []
    for track, part in partition.items():
        if set_name != 'all' and part != set_name: continue
        d = ROOT + 'MD_' + track.replace('MusicDelta_', '') + '_full-mix'
        tr, lead, events, owner = evaluate(track, d, policy, theta, emin)
        ann = np.loadtxt(ANN + track + '_MELODY2.csv', delimiter=','); end = 19.8 if len(lead) == 0 else lead[-1][0] - .2
        hop = ann[1, 0] - ann[0, 0]
        refAt = lambda t: (lambda r: 69 + 12 * np.log2(r[1] / 440) if r[1] > 0 else np.nan)(ann[min(len(ann) - 1, int(round(t / hop)))])
        segs = labels[track]['melody']; cls = lambda t: next((s['class'] for s in segs if s['start'] <= t < s['end']), None)
        r = dict(track=track, voiced=0, own=0, unv=0, abst=0, srcOk=0, srcN=0)
        mixf = {round(f[0], 3): f[1] for f in tr['mix']['frames']}; r['c5own'] = 0
        for t, p in lead:
            if t >= end: break
            ref = refAt(t)
            if np.isfinite(ref):
                r['voiced'] += 1; r['own'] += p is not None and abs(p - ref) < .5
                m = mixf.get(round(t, 3)); r['c5own'] += m is not None and abs(m - ref) < .5
                c = cls(t); o = owner[min(len(owner) - 1, int(round(t / STEP)))]
                if c and o: r['srcN'] += 1; r['srcOk'] += (o == 'vocals') == (c == 'vocal')
            else: r['unv'] += 1; r['abst'] += p is None
        refs = ref_onsets(ann, end); ev = [e for e in events if e < end]
        c5 = [e['t'] for e in tr['mix']['events'] if e['t'] < end]; c6 = [t for t in tr['mixC6'] if t < end]
        r.update(refs=len(refs), ev=len(ev), tp=match(refs, ev, .05), tp25=match(refs, ev, .025),
                 c5ev=len(c5), c5tp=match(refs, c5, .05), c6ev=len(c6), c6tp=match(refs, c6, .05))
        rows.append(r)
    S = lambda k: sum(r[k] for r in rows)
    f1 = lambda tp, ev, ref: 2 * tp / max(1, ev + ref)
    return dict(policy=policy, theta=theta, emin=emin, tracks=len(rows),
                ownership=round(S('own') / S('voiced'), 3), c5ownership=round(S('c5own') / S('voiced'), 3),
                abstention=round(S('abst') / max(1, S('unv')), 3), sourceCorrect=round(S('srcOk') / max(1, S('srcN')), 3),
                precision=round(S('tp') / max(1, S('ev')), 3), recall=round(S('tp') / S('refs'), 3), f1=round(f1(S('tp'), S('ev'), S('refs')), 3),
                f1At25=round(f1(S('tp25'), S('ev'), S('refs')), 3),
                c5={'precision': round(S('c5tp') / S('c5ev'), 3), 'recall': round(S('c5tp') / S('refs'), 3), 'f1': round(f1(S('c5tp'), S('c5ev'), S('refs')), 3)},
                c6={'precision': round(S('c6tp') / S('c6ev'), 3), 'recall': round(S('c6tp') / S('refs'), 3), 'f1': round(f1(S('c6tp'), S('c6ev'), S('refs')), 3)},
                perTrack=[(r['track'].replace('MusicDelta_', ''), round(r['own'] / max(1, r['voiced']), 2), r['tp'], r['ev'], r['refs']) for r in rows] if verbose else None)


def drum_rate(policy, theta, emin):
    n = secs = 0
    for d in glob.glob(ROOT + 'MD_*_drum-only'):
        tr, lead, events, owner = evaluate(None, d, policy, theta, emin); n += len(events); secs += len(lead) * 0.01161
    return round(n / secs * 60, 1)


if __name__ == '__main__':
    if sys.argv[1] == 'grid':
        res = []
        for policy, theta, emin in itertools.product(['inst', 'dom'], [.3, .4, .5, .6], [.1, .2]):
            r = score('development', policy, theta, emin); res.append(r)
            print(json.dumps({k: r[k] for k in ['policy', 'theta', 'emin', 'ownership', 'abstention', 'sourceCorrect', 'precision', 'recall', 'f1']}))
    else:
        policy, theta, emin, set_name = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), sys.argv[4]
        r = score(set_name, policy, theta, emin, verbose=True); r['drumOnlyPerMinute'] = drum_rate(policy, theta, emin)
        print(json.dumps(r, indent=1))
