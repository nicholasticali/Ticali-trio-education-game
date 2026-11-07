# Build every pure-sound clip from Kokoro carrier words. Usage: build.py table.json outdir [keys...]
import sys, json, os, numpy as np, soundfile as sf, parselmouth as pm
from ksynth import synth
from cut import (cut, features, runs, longest, voiced, stretch_middle, lengthen, fades, xfade_concat, steady_core,
                 noise_extend, voiced_hiss, spec_match, SR, STEP, idx, active_span)
TABLE = json.load(open(sys.argv[1])); OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
only = set(sys.argv[3:])
LEVEL = {'vowel': -20, 'cont': -21, 'fric': -27, 'vfric': -24, 'glide': -21}   # target RMS dBFS of the sound itself
built, info_all = {}, {}
def carrier(e):
    x, _ = synth(e['carrier'], {}, voice=e.get('voice', 'af_heart'), speed=e.get('speed', 0.85))
    return x
def norm(y, cls, lvl=None):
    lvl = LEVEL.get(cls, -21) if lvl is None else lvl
    if cls in ('stop', 'breath'):
        return y * (10 ** (-6 / 20) / (np.abs(y).max() + 1e-9))
    e = np.abs(y); act = y[e > e.max() * 0.05]
    r = np.sqrt(np.mean(act ** 2)) + 1e-9
    y = y * (10 ** (lvl / 20) / r)
    pk = np.abs(y).max()
    return y * (10 ** (-3 / 20) / pk) if pk > 10 ** (-3 / 20) else y
def make(key, e):
    cls, m = e['cls'], e['method']
    if m == 'concat':
        parts = [built[k] for k in e['parts']]; gap = np.zeros(int(e.get('gap', 0.02) * SR))
        y = parts[0]
        for p in parts[1:]: y = np.concatenate([y, gap, p])
        return y, {'parts': e['parts']}
    if m == 'voiced_hiss':
        hiss, hum = built[e['hiss']], built[e['hum']]
        f0 = np.nanmedian(pm.Sound(hum, sampling_frequency=SR).to_pitch_ac(pitch_floor=100, pitch_ceiling=500).selected_array['frequency'][lambda a: a > 0] if False else [220])
        p = pm.Sound(hum, sampling_frequency=SR).to_pitch_ac(pitch_floor=100, pitch_ceiling=500).selected_array['frequency']
        f0 = float(np.median(p[p > 0])) if (p > 0).any() else 220.0
        return voiced_hiss(hiss, hum, f0, bar_db=e.get('bar_db', -8)), {'f0': round(f0)}
    if m == 'vowel_typical':
        import parselmouth as _pm
        def mf(z):
            a = _pm.Sound(z, sampling_frequency=SR).to_mfcc(number_of_coefficients=12, window_length=0.025, time_step=0.005).to_array()[1:13]
            return a.mean(axis=1)
        cores = []
        for c in e['carriers']:
            z, _ = synth(c, {}, voice=e.get('voice', 'af_heart'), speed=e.get('speed', 0.85))
            F = features(z, SR); s0, s1 = active_span(F)
            r = longest([r for r in runs(F[s0:s1], voiced) if r[1] - r[0] > 10]); a, b = s0 + r[0] + 3, s0 + r[1] - 3
            ca, cb = steady_core(z, a, b, min(e.get('core', 20), b - a - 1))
            cores.append((c, z[idx(ca * STEP):idx(cb * STEP)]))
        M = [mf(z) for _, z in cores]; mean = np.mean(M, axis=0)
        bi = int(np.argmin([np.linalg.norm(m_ - mean) for m_ in M])); c, core = cores[bi]
        y = core
        while len(y) / SR < e['hold'] * 0.98: y = lengthen(y, min(3, e['hold'] / (len(y) / SR) * 1.02))
        y = y[:idx(e['hold'])]
        return fades(y, 0.04, 0.08), {'from': c, 'spread': round(float(np.mean([np.linalg.norm(m_ - mean) for m_ in M])), 1)}
    x = carrier(e)
    if m == 'vowel_steady':
        F = features(x, SR); s0, s1 = active_span(F)
        r = longest([r for r in runs(F[s0:s1], voiced)]); a, b = s0 + r[0] + 3, s0 + r[1] - 3
        ca, cb = steady_core(x, a, b, e.get('core', 12))
        core = x[idx(ca * STEP):idx(cb * STEP)]
        y = lengthen(core, e['hold'] / (len(core) / SR))
        while len(y) / SR < e['hold'] * 0.98: y = lengthen(y, min(3, e['hold'] / (len(y) / SR) * 1.02))
        y = y[:idx(e['hold'])]
        return fades(y, 0.04, 0.08), {'core': (round(ca * STEP, 3), round(cb * STEP, 3))}
    seg, info = cut(x, m, e.get('opt'))
    if cls == 'fric' and e.get('hold'):
        ed = idx(e.get('edge', 0.04))
        mid = spec_match(noise_extend(seg, e['hold'] - 2 * ed / SR), seg)
        y = xfade_concat([seg[:ed], mid, seg[-ed:]], 0.01)
        return fades(y, 0.01, 0.03), info
    if e.get('hold'):
        if e.get('steady'):
            n = len(seg) // int(STEP * SR)
            F = features(seg, SR); ca, cb = steady_core(seg, 1, max(2, len(F) - 1), min(e['steady'], max(2, len(F) - 3)))
            seg = seg[idx(ca * STEP):idx(cb * STEP)]
            y = seg
            while len(y) / SR < e['hold'] * 0.98: y = lengthen(y, min(3, e['hold'] / (len(y) / SR) * 1.02))
            y = y[:idx(e['hold'])]
            return fades(y, 0.03, 0.07), info
        seg = stretch_middle(seg, e['hold'])
    return fades(seg, e.get('fin', 0.008), e.get('fout', 0.025)), info
for key, e in TABLE.items():
    if only and key not in only and e.get('method') not in ('concat', 'voiced_hiss'): 
        # still build dependencies quietly
        if not any(key in (TABLE[k].get('parts', []) + [TABLE[k].get('hiss'), TABLE[k].get('hum')]) for k in only if k in TABLE): continue
    try:
        y, info = make(key, e)
    except Exception as err:
        print(f'{key:6s} FAILED {str(err).splitlines()[0]}'); continue
    built[key] = y
    if only and key not in only: continue
    out = norm(y, e['cls'], e.get('level')); pad = np.zeros(int(0.03 * SR))
    out = np.concatenate([pad, out, pad])
    sf.write(f'{OUT}/{key}.wav', out.astype(np.float32), SR)
    info_all[key] = {k: (round(v, 3) if isinstance(v, float) else v) for k, v in info.items()}
    print(f'{key:6s} {len(out)/SR*1000:5.0f}ms  {e["carrier"] if "carrier" in e else e["method"]}  {info_all[key]}')
json.dump(info_all, open(f'{OUT}/build-info.json', 'w'), indent=1, ensure_ascii=False)
