# Cut one pure sound out of a carrier word at acoustic landmarks; lengthen held sounds.
import numpy as np, parselmouth as pm
from parselmouth.praat import call
from feat import features, runs, longest, STEP
SR = 24000
def idx(t): return int(round(t * SR))
def active_span(F, floor=-35):
    peak = max(f['db'] for f in F); act = [i for i, f in enumerate(F) if f['db'] > peak + floor]
    return act[0], act[-1] + 1
def voiced(f): return f['f0'] > 0
def lengthen(x, factor):
    if factor <= 1.02: return x
    s = pm.Sound(x, sampling_frequency=SR)
    y = call(s, 'Lengthen (overlap-add)', 100, 500, factor)
    return y.values[0]
def stretch_middle(x, target, edge=0.012):
    """Lengthen only the steady middle so the onset and offset stay natural."""
    n = len(x) / SR
    if n >= target or n < 3 * edge: return x
    a, b = idx(edge), len(x) - idx(edge)
    mid = x[a:b]; want = target - 2 * edge
    m2 = mid
    for _ in range(4):
        if len(m2) / SR >= want * 0.98: break
        m2 = lengthen(m2, min(3.0, want / (len(m2) / SR) * 1.02))
    m2 = m2[:idx(want)]
    return xfade_concat([x[:a], m2, x[b:]], 0.005)
def xfade_concat(parts, fade):
    k = idx(fade); out = parts[0].copy()
    for p in parts[1:]:
        if len(out) < k or len(p) < k: out = np.concatenate([out, p]); continue
        r = np.linspace(0, 1, k); out[-k:] = out[-k:] * (1 - r) + p[:k] * r; out = np.concatenate([out, p[k:]])
    return out
def fades(x, fin=0.008, fout=0.025):
    x = x.copy(); a, b = min(idx(fin), len(x) // 2), min(idx(fout), len(x) // 2)
    if a: x[:a] *= np.linspace(0, 1, a) ** 2
    if b: x[-b:] *= np.linspace(1, 0, b) ** 2
    return x

def cut(x, method, opt=None):
    """Return (segment, info). Times in seconds."""
    opt = opt or {}
    F = features(x, SR); s0, s1 = active_span(F)
    T = lambda i: i * STEP
    if method == 'final_unvoiced':          # vowel then an unvoiced fricative to the end: from voicing offset
        vo = max(i for i in range(s0, s1) if voiced(F[i]))
        a = vo + 2
        # end: where the fricative falls 30 dB below its own peak
        pk = max(F[i]['db'] for i in range(a, s1)); b = max(i for i in range(a, s1) if F[i]['db'] > pk - 30) + 1
        return x[idx(T(a)):idx(T(b))], dict(a=T(a), b=T(b))
    if method == 'final_nasal':             # the steady murmur: voiced, almost all energy under 500 Hz
        r = longest(runs(F[s0:s1], lambda f: voiced(f) and f['lo'] > 0.9 and f['mid'] < 0.1))
        a, b = s0 + r[0] + 1, s0 + r[1] - 1
        return x[idx(T(a)):idx(T(b))], dict(a=T(a), b=T(b))
    if method == 'final_voiced_fric':       # after the vowel: level drops and high band rises, voiced or not, to the end
        vpk = max(F[i]['db'] for i in range(s0, s1))
        vi = max(range(s0, s1), key=lambda i: F[i]['db'])
        a = next(i for i in range(vi, s1) if F[i]['db'] < vpk - opt.get('drop', 8) and F[i]['hi'] > opt.get('hi', 0.08))
        pk = max(F[i]['db'] for i in range(a, s1)); b = max(i for i in range(a, s1) if F[i]['db'] > pk - 30) + 1
        return x[idx(T(a)):idx(T(b))], dict(a=T(a), b=T(b))
    if method == 'initial_unvoiced2':
        quiet = min(F[i]['db'] for i in range(max(0, s0 - 20), s0 + 1))
        st = s0
        r0 = runs(F[s0:s1], voiced)
        if r0 and r0[0][0] < 6 and sum(F[s0 + i]['lo'] for i in range(*r0[0])) / (r0[0][1] - r0[0][0]) > 0.75:
            nxt = [i for i in range(s0 + r0[0][1], s1) if not voiced(F[i])]
            if nxt and nxt[0] - (s0 + r0[0][1]) < 3: st = s0 + r0[0][1]
        a = next(i for i in range(st, s1) if not voiced(F[i]) and F[i]['lo'] < 0.5 and F[i]['db'] > quiet + 25)
        # the sustained vowel: the first voiced run of 40 ms or more
        vr = [r for r in runs(F[a:s1], voiced) if r[1] - r[0] >= 8]
        von = a + vr[0][0]
        keep = [i for i in range(a, von - opt.get('before_voice', 1)) if not voiced(F[i]) and not (i > a + 1 and F[i]['lo'] > 0.8)]
        segs, cur = [], [keep[0]]
        for i in keep[1:]:
            if i == cur[-1] + 1: cur.append(i)
            else: segs.append(cur); cur = [i]
        segs.append(cur)
        parts = [x[idx(T(g[0])) - (idx(0.004) if k == 0 else 0):idx(T(g[-1] + 1))] for k, g in enumerate(segs)]
        return xfade_concat(parts, 0.003), dict(a=T(a), b=T(keep[-1] + 1), voice_on=T(von), spliced=len(segs) - 1)
    if method == 'initial_voiced_stop2':
        # prevoicing (voice bar: voiced, almost all energy under 500 Hz), then the release, then the vowel
        vb = [i for i in range(s0, s1) if voiced(F[i]) and F[i]['lo'] > 0.9]
        rel = next(i for i in range(vb[0] if vb else s0, s1) if F[i]['lo'] < 0.7 and (not vb or i > vb[0] + 2))
        vow = next(i for i in range(rel, s1) if voiced(F[i]) and F[i]['mid'] > 0.3)
        a = max(s0, rel - opt.get('prevoice', 5)); b = vow + opt.get('keep', 5)
        return x[idx(T(a)):idx(T(b))], dict(a=T(a), release=T(rel), vowel_on=T(vow), b=T(b))
    if method == 'initial_voiced_affricate':   # j: a short voice bar, the release, the voiced frication, cut at the vowel
        rel = next(i for i in range(s0, s1) if F[i]['hi'] > 0.3)
        vow = next(i for i in range(rel, s1) if voiced(F[i]) and F[i]['mid'] > 0.3 and F[i]['hi'] < 0.1)
        a = max(s0, rel - opt.get('prevoice', 4)); b = vow + opt.get('keep', 2)
        return x[idx(T(a)):idx(T(b))], dict(a=T(a), release=T(rel), vowel_on=T(vow), b=T(b))
    if method == 'mid_voiced_fric':            # vowel + fricative + vowel: the stretch where the high band rises
        hv = [f['hi'] for f in F]; pk = max(f['db'] for f in F)
        cand = [i for i in range(s0, s1) if F[i]['hi'] > opt.get('hi', 0.12) and F[i]['db'] > pk - 30]
        # longest consecutive run of candidates (allow 1-frame gaps)
        best, cur = [], [cand[0]]
        for i in cand[1:]:
            if i - cur[-1] <= 2: cur.append(i)
            else:
                if len(cur) > len(best): best = cur
                cur = [i]
        if len(cur) > len(best): best = cur
        a, b = best[0], best[-1] + 1
        return x[idx(T(a)):idx(T(b))], dict(a=T(a), b=T(b), voiced=sum(1 for i in range(a, b) if voiced(F[i])), n=b - a)
    if method == 'final_cluster':              # vowel + stop + fricative (x = k s): from the end of the vowel to the end
        vo = max(i for i in range(s0, s1) if voiced(F[i]))
        rel = next(i for i in range(vo + 1, s1) if F[i]['db'] > F[vo + 1]['db'] + 6 or F[i]['hi'] > 0.3)
        pk = max(F[i]['db'] for i in range(rel, s1)); b = max(i for i in range(rel, s1) if F[i]['db'] > pk - 30) + 1
        return x[idx(T(rel)) - idx(0.004):idx(T(b))], dict(a=T(rel), b=T(b), vowel_off=T(vo))
    if method == 'glide':
        v = [i for i in range(s0, s1) if voiced(F[i]) and F[i]['db'] > F[s0]['db'] - 3]
        a = v[0] + opt.get('skip', 2); b = a + int(opt.get('len', 0.11) / STEP)
        return x[idx(T(a)):idx(T(b))], dict(a=T(a), b=T(b))
    if method == 'initial_unvoiced':        # burst/frication/aspiration up to voicing onset (p t k ch h, initial s f)
        # skip any low murmur before the burst: first unvoiced frame with energy above 500 Hz
        a = next(i for i in range(s0, s1) if not voiced(F[i]) and F[i]['lo'] < 0.5)
        von = next(i for i in range(a, s1) if voiced(F[i]))
        b = von - opt.get('before_voice', 1)
        return x[idx(T(a)) - idx(0.004):idx(T(b))], dict(a=T(a), b=T(b), voice_on=T(von))
    if method == 'initial_voiced_stop':     # the burst and a hint of voicing, no vowel (b d g, j)
        a = next(i for i in range(s0, s1) if F[i]['lo'] < 0.6 and F[i]['db'] > F[s0]['db'] - 5) if opt.get('burst_hi') else s0
        # first frame where the vowel's formant energy is established (mid share high)
        vow = next(i for i in range(a + 1, s1) if voiced(F[i]) and F[i]['mid'] > opt.get('mid', 0.3))
        b = vow + opt.get('keep', 2)
        return x[idx(T(a)) - idx(0.004):idx(T(b))], dict(a=T(a), b=T(b), vowel_on=T(vow))
    if method == 'initial_sonorant':        # m n l r w y before a vowel: from onset to the jump into the vowel
        v = [i for i in range(s0, s1) if voiced(F[i])]; a = v[0]
        dbs = np.array([F[i]['db'] for i in range(a, s1)]); mids = np.array([F[i]['mid'] for i in range(a, s1)])
        d = np.diff(dbs) + 20 * np.diff(mids)           # where level and formant energy rise together
        j = int(np.argmax(d[:int(opt.get('within', 0.25) / STEP)]))
        b = a + j + opt.get('keep', 0)
        return x[idx(T(a)):idx(T(b))], dict(a=T(a), b=T(b))
    if method == 'vowel_between':           # h + vowel + stop: the voiced stretch, trimmed at both ends
        v = runs(F[s0:s1], voiced); r = longest(v)
        a, b = s0 + r[0] + opt.get('trim_in', 3), s0 + r[1] - opt.get('trim_out', 2)
        return x[idx(T(a)):idx(T(b))], dict(a=T(a), b=T(b))
    if method == 'vowel_final':             # h + vowel to the end
        v = runs(F[s0:s1], voiced); r = longest(v)
        a, b = s0 + r[0] + opt.get('trim_in', 3), s0 + r[1]
        return x[idx(T(a)):idx(T(b))], dict(a=T(a), b=T(b))
    raise ValueError(method)

# ─── Steady vowel core, noise-safe lengthening, voiced hiss ───
def band_feats(x, F):
    """Log energies in 24 mel-ish bands per 5 ms frame (for finding the steadiest stretch)."""
    out = []; w = int(0.02 * SR); win = np.hanning(w)
    edges = np.geomspace(150, 6000, 25)
    for fr in F:
        c = int(fr['t'] * SR); a = c - w // 2; seg = np.zeros(w)
        lo_, hi_ = max(0, a), min(len(x), a + w)
        if hi_ > lo_: seg[lo_ - a:hi_ - a] = x[lo_:hi_]
        sp = np.abs(np.fft.rfft(seg * win)) ** 2; f = np.fft.rfftfreq(w, 1 / SR)
        out.append(np.log10(np.array([sp[(f >= edges[i]) & (f < edges[i + 1])].sum() + 1e-10 for i in range(24)])))
    return np.array(out)
def steady_core(x, a, b, n=12):
    """Frames a..b: the n-frame window whose spectrum changes least."""
    F = features(x, SR); B = band_feats(x, F[a:b])
    best, bi = 1e9, 0
    for i in range(0, max(1, len(B) - n)):
        v = np.mean(np.var(B[i:i + n], axis=0))
        if v < best: best, bi = v, i
    return a + bi, a + bi + n
def noise_extend(x, target, grain=0.025, seed=1):
    """Lengthen a hiss without making it buzzy: random Hann-windowed grains, 50% overlap."""
    rng = np.random.default_rng(seed); g = int(grain * SR); hop = g // 4
    core = x[int(len(x) * 0.15):int(len(x) * 0.85)]
    if len(core) < g * 1.5: core = x
    n = int(target * SR); y = np.zeros(n + g); w = np.hanning(g)
    for pos in range(0, n, hop):
        st = rng.integers(0, max(1, len(core) - g)); gr = core[st:st + g]
        gr = gr * (np.sqrt(np.mean(core ** 2)) / (np.sqrt(np.mean(gr ** 2)) + 1e-12))
        y[pos:pos + g] += gr * w
    y = y[:n]
    y *= np.sqrt(np.mean(core ** 2) + 1e-12) / (np.sqrt(np.mean(y ** 2)) + 1e-12)
    return y
def lowpass(x, fc):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / np.sqrt(1 + (f / fc) ** 8); return np.fft.irfft(X, len(x))
def voiced_hiss(hiss, hum, f0, bar_db=-8, mod=0.6):
    """A voiced fricative: the voice's own hum under the band (low-passed) plus its own hiss pulsing at f0."""
    n = min(len(hiss), len(hum)); hiss, hum = hiss[:n], hum[:n]
    t = np.arange(n) / SR
    env = 1 - mod / 2 + (mod / 2) * np.cos(2 * np.pi * f0 * t)
    bar = lowpass(hum, 350)
    rh = np.sqrt(np.mean(hiss ** 2)); rb = np.sqrt(np.mean(bar ** 2)) + 1e-12
    bar *= rh * 10 ** (bar_db / 20) / rb
    return hiss * env * 0.8 + bar

def avg_spectrum(x, n=1024):
    hop = n // 2; w = np.hanning(n); acc = np.zeros(n // 2 + 1); k = 0
    if len(x) < n: x = np.concatenate([x, np.zeros(n - len(x))])
    for i in range(0, len(x) - n + 1, hop):
        acc += np.abs(np.fft.rfft(x[i:i + n] * w)) ** 2; k += 1
    return acc / max(k, 1)
def spec_match(y, ref, n=1024):
    """Filter y so its long-term spectrum matches ref's (third-octave smoothed)."""
    Py, Pr = avg_spectrum(y, n), avg_spectrum(ref, n)
    f = np.fft.rfftfreq(n, 1 / SR); g = np.sqrt((Pr + 1e-12) / (Py + 1e-12))
    sm = np.empty_like(g)
    for i, fi in enumerate(f):
        lo, hi = fi / 2 ** (1 / 6), fi * 2 ** (1 / 6) + 1
        sel = (f >= lo) & (f <= hi); sm[i] = np.exp(np.mean(np.log(g[sel] + 1e-12)))
    Y = np.fft.rfft(y); fy = np.fft.rfftfreq(len(y), 1 / SR)
    Y *= np.interp(fy, f, sm)
    out = np.fft.irfft(Y, len(y))
    return out * (np.sqrt(np.mean(ref ** 2)) / (np.sqrt(np.mean(out ** 2)) + 1e-12))
