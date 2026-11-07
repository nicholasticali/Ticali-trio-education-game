# Each consonant clip vs the same consonant cut from other words (other vowels): nearest family member must be itself.
import sys, numpy as np, soundfile as sf, parselmouth as pm
from ksynth import synth
from cut import cut, SR
def mf(z, n=12):
    z = np.asarray(z, dtype=float)
    if len(z) < int(0.03 * SR): z = np.concatenate([z, np.zeros(int(0.03 * SR) - len(z))])
    return pm.Sound(z, sampling_frequency=SR).to_mfcc(number_of_coefficients=n, window_length=0.015, time_step=0.003).to_array()[1:n + 1].mean(axis=1)
VOW = ['æ', 'ɪ', 'ʊ', 'ɛ', 'ʌ', 'ɑ', 'ɔ']
FAM = {
 'fricatives': ({'s': 's', 'sh': 'ʃ', 'f': 'f', 'th': 'θ'}, lambda c, v: (f'ˈ{v}{c}', 'final_unvoiced')),
 'unvoiced stops': ({'p': 'p', 't': 't', 'k': 'k', 'ch': 'tʃ'}, lambda c, v: (f'{c}ˈ{v}', 'initial_unvoiced2')),
 'voiced stops': ({'b': 'b', 'd': 'd', 'g': 'ɡ'}, lambda c, v: (f'{c}ˈ{v}', 'initial_voiced_stop2')),
 'nasals': ({'m': 'm', 'n': 'n', 'ng': 'ŋ'}, lambda c, v: (f'ˈ{v}{c}', 'final_nasal')),
}
D = sys.argv[1]; total = ok = 0
for fam, (mem, mk) in FAM.items():
    refs = {}
    for k, c in mem.items():
        refs[k] = []
        for v in VOW:
            if k == 'ng' and v in ('ʊ',): continue
            car, meth = mk(c, v)
            try:
                seg, _ = cut(synth(car)[0], meth); mm = mf(seg)
                if mm.shape == (12,) and np.all(np.isfinite(mm)): refs[k].append(mm)
            except Exception as e: print('  ref skip', car, str(e)[:60])
    print('==', fam)
    for k in mem:
        x, _ = sf.read(f'{D}/{k}.wav'); e = np.abs(x); act = np.where(e > e.max() * 0.02)[0]; core = x[act[0]:act[-1]]
        m = mf(core); d = {r: np.mean([np.linalg.norm(m - rr) for rr in refs[r]]) for r in mem}
        rank = sorted(d, key=d.get); total += 1; ok += rank[0] == k
        print(f'  {k:3s} nearest: ' + '  '.join(f'{r}={d[r]:.1f}' for r in rank) + ('' if rank[0] == k else '   <-- MISMATCH'))
print(f'{ok}/{total} consonants nearest to themselves')
