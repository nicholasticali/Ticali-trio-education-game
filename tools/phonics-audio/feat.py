# Frame features at 5 ms: voicing (f0), level (dB), band shares and centroid.
import numpy as np, parselmouth as pm
STEP = 0.005
def features(x, sr):
    s = pm.Sound(x, sampling_frequency=sr)
    p = s.to_pitch_ac(time_step=STEP, pitch_floor=100, pitch_ceiling=500, voicing_threshold=0.5)
    n = int(len(x) / sr / STEP)
    F = []
    w = int(0.02 * sr); win = np.hanning(w)
    for i in range(n):
        t = i * STEP; c = int(t * sr); a, b = c - w // 2, c + w // 2
        seg = np.zeros(w)
        lo_, hi_ = max(0, a), min(len(x), b)
        if hi_ > lo_: seg[lo_ - a:hi_ - a] = x[lo_:hi_]
        sp = np.abs(np.fft.rfft(seg * win)) ** 2; f = np.fft.rfftfreq(w, 1 / sr); tot = sp.sum() + 1e-12
        f0 = p.get_value_at_time(t); f0 = 0.0 if np.isnan(f0) else f0
        db = 10 * np.log10(np.mean(seg ** 2) + 1e-12)
        F.append(dict(t=t, f0=f0, db=db, lo=sp[f < 500].sum() / tot, mid=sp[(f >= 500) & (f < 3000)].sum() / tot,
                      hi=sp[f >= 3000].sum() / tot, cen=(f * sp).sum() / tot))
    return F
def runs(F, pred):
    out, start = [], None
    for i, fr in enumerate(F):
        if pred(fr):
            if start is None: start = i
        elif start is not None: out.append((start, i)); start = None
    if start is not None: out.append((start, len(F)))
    return out
def longest(rs): return max(rs, key=lambda r: r[1] - r[0]) if rs else None
