# For each consonant family, cut every member from many words and keep, per member, the cut most clearly itself.
import json, numpy as np, parselmouth as pm
from ksynth import synth
from cut import cut, SR
def mf(z, n=12):
    z = np.asarray(z, dtype=float)
    if len(z) < int(0.03 * SR): z = np.concatenate([z, np.zeros(int(0.03 * SR) - len(z))])
    return pm.Sound(z, sampling_frequency=SR).to_mfcc(number_of_coefficients=n, window_length=0.015, time_step=0.003).to_array()[1:n + 1].mean(axis=1)
V = ['ʌ', 'æ', 'ɪ', 'ɛ', 'ʊ', 'ɑ', 'ɔ']
FAM = {
 'fric': ({'s': 's', 'sh': 'ʃ', 'f': 'f', 'th': 'θ'}, [lambda c, v: (f'ˈ{v}{c}', 'final_unvoiced')]),
 'stop': ({'p': 'p', 't': 't', 'k': 'k', 'ch': 'tʃ'}, [lambda c, v: (f'{c}ˈ{v}', 'initial_unvoiced2')]),
 'vstop': ({'b': 'b', 'd': 'd', 'g': 'ɡ'}, [lambda c, v: (f'{c}ˈ{v}', 'initial_voiced_stop2')]),
 'nasal': ({'m': 'm', 'n': 'n', 'ng': 'ŋ'}, [lambda c, v: (f'ˈ{v}{c}', 'final_nasal')]),
}
import os
picks = json.load(open('conspicks.json')) if os.path.exists('conspicks.json') else {}
for fam, (mem, makers) in FAM.items():
    if all(k in picks for k in mem): continue
    cand = {k: [] for k in mem}
    for k, c in mem.items():
        for mk in makers:
            for v in V:
                car, meth = mk(c, v)
                try:
                    seg, _ = cut(synth(car)[0], meth)
                    if len(seg) < int(0.02 * SR): continue
                    mm = mf(seg)
                    if mm.shape == (12,) and np.all(np.isfinite(mm)): cand[k].append((car, meth, mm, len(seg) / SR))
                except Exception: pass
    print('==', fam, {k: len(v) for k, v in cand.items()})
    for k in mem:
        best = None
        for i, (car, meth, m, dur) in enumerate(cand[k]):
            own = np.mean([np.linalg.norm(m - mm) for j, (_, _, mm, _) in enumerate(cand[k]) if j != i])
            dd = {o: np.mean([np.linalg.norm(m - mm) for (_, _, mm, _) in cand[o]]) for o in mem if o != k}
            near = min(dd, key=dd.get); margin = dd[near] - own
            if best is None or margin > best[0]: best = (margin, car, meth, near, dur)
        picks[k] = {'carrier': best[1], 'method': best[2], 'margin': round(float(best[0]), 1), 'nearest_other': best[3], 'cut_s': round(best[4], 3)}
        print(f'  {k:3s} pick {best[1]:7s} margin {best[0]:6.1f} nearest other {best[3]}  cut {best[4]*1000:.0f}ms')
json.dump(picks, open('conspicks.json', 'w'), ensure_ascii=False, indent=1)
