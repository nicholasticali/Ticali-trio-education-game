# Is each isolated vowel clip closest to the same vowel in real words? MFCC (Praat) means over steady frames.
import sys, numpy as np, soundfile as sf, parselmouth as pm
from ksynth import synth
from cut import features, runs, longest, voiced, steady_core, active_span, SR, STEP, idx
V = {'a': 'æ', 'e': 'ɛ', 'i': 'ɪ', 'o': 'ɑː', 'u': 'ʌ', 'ee': 'iː', 'oo': 'uː', 'oo2': 'ʊ', 'aw': 'ɔː', 'er': 'ɜː'}
FRAMES = [('b', 't'), ('s', 'd'), ('p', 'k'), ('t', 'p'), ('d', 's')]
def mfcc_mean(x):
    m = pm.Sound(x, sampling_frequency=SR).to_mfcc(number_of_coefficients=12, window_length=0.025, time_step=0.005)
    a = m.to_array()[1:13]          # drop c0 (level)
    return a.mean(axis=1)
def vowel_core(x):
    F = features(x, SR); s0, s1 = active_span(F)
    r = longest(runs(F[s0:s1], voiced)); a, b = s0 + r[0] + 3, s0 + r[1] - 3
    ca, cb = steady_core(x, a, b, 12); return x[idx(ca * STEP):idx(cb * STEP)]
refs = {}
for k, v in V.items():
    refs[k] = [mfcc_mean(vowel_core(synth(f'{c1}ˈ{v}{c2}')[0])) for c1, c2 in FRAMES]
ok = 0
for k in V:
    x, _ = sf.read(f'{sys.argv[1]}/{k}.wav'); e = np.abs(x); act = np.where(e > e.max() * 0.05)[0]
    core = x[act[0] + int(0.05 * SR):act[-1] - int(0.05 * SR)]
    c = mfcc_mean(core)
    d = {r: min(np.linalg.norm(c - rr) for rr in refs[r]) for r in V}
    rank = sorted(d, key=d.get)
    ok += rank[0] == k
    print(f'{k:4s} nearest: ' + '  '.join(f'{r}={d[r]:.1f}' for r in rank[:4]) + ('' if rank[0] == k else '   <-- MISMATCH'))
print(f'{ok}/{len(V)} vowels nearest to their own vowel in real words')
