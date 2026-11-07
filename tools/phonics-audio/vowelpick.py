# For each monophthong, cut steady cores from many words and keep the one most clearly itself
# (largest margin between its distance to other vowels and to its own vowel, leave-one-out). Writes picks.json.
import json, numpy as np, parselmouth as pm
from ksynth import synth
from cut import features, runs, longest, voiced, steady_core, active_span, SR, STEP, idx
V = {'a': 'æ', 'e': 'ɛ', 'i': 'ɪ', 'o': 'ɑː', 'u': 'ʌ', 'ee': 'iː', 'oo': 'uː', 'oo2': 'ʊ', 'aw': 'ɔː', 'er': 'ɜː'}
CTX = [('p','t'),('t','k'),('k','p'),('b','t'),('s','d'),('p','k'),('t','p'),('k','t'),('d','p'),('f','t'),('s','t'),('m','p')]
def mf(z):
    return pm.Sound(z, sampling_frequency=SR).to_mfcc(number_of_coefficients=12, window_length=0.025, time_step=0.005).to_array()[1:13].mean(axis=1)
data = {}
for k, v in V.items():
    data[k] = []
    for a, b in CTX:
        c = f'{a}ˈ{v}{b}'
        try:
            z, _ = synth(c)
            F = features(z, SR); s0, s1 = active_span(F)
            r = longest([r for r in runs(F[s0:s1], voiced) if r[1] - r[0] > 10]); lo, hi = s0 + r[0] + 3, s0 + r[1] - 3
            ca, cb = steady_core(z, lo, hi, min(20, hi - lo - 1))
            core = z[idx(ca * STEP):idx(cb * STEP)]
            data[k].append((c, core, mf(core)))
        except Exception as e:
            print('skip', c, e)
picks = {}
for k in V:
    best = None
    for i, (c, core, m) in enumerate(data[k]):
        own = np.mean([np.linalg.norm(m - mm) for j, (_, _, mm) in enumerate(data[k]) if j != i])
        other = min(np.mean([np.linalg.norm(m - mm) for (_, _, mm) in data[o]]) for o in V if o != k)
        near = min((o for o in V if o != k), key=lambda o: np.mean([np.linalg.norm(m - mm) for (_, _, mm) in data[o]]))
        margin = other - own
        if best is None or margin > best[0]: best = (margin, c, near, own, other)
    picks[k] = {'carrier': best[1], 'margin': round(float(best[0]), 1), 'nearest_other': best[2]}
    print(f'{k:4s} pick {best[1]:8s} margin {best[0]:6.1f} (own {best[3]:.1f}, nearest other {best[2]} {best[4]:.1f})')
json.dump(picks, open('picks.json', 'w'), ensure_ascii=False, indent=1)
