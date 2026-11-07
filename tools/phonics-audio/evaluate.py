# Measure every clip: length, voicing, voice-bar share, spectral centre, mid formants; recognizer output.
import sys, json, glob, subprocess, numpy as np, soundfile as sf, parselmouth as pm
def metrics(path):
    x, sr = sf.read(path); s = pm.Sound(x, sampling_frequency=sr)
    e = np.abs(x); th = e.max() * 0.02; act = np.where(e > th)[0]
    if not len(act): return dict(ms=0, voiced=0, bar=0, hi=0, cen=0, F1=0, F2=0, F3=0, rms=-99, peak=-99)
    a, b = act[0], act[-1]; core = x[a:b + 1]
    cs = pm.Sound(core, sampling_frequency=sr)
    try:
        p = cs.to_pitch_ac(time_step=0.005, pitch_floor=max(100, 3 / cs.duration + 1), pitch_ceiling=500, voicing_threshold=0.35); f0 = p.selected_array['frequency']
    except Exception: f0 = np.array([0.0])
    pass; vfrac = float((f0 > 0).mean()) if len(f0) else 0
    sp = np.abs(np.fft.rfft(core * np.hanning(len(core)))) ** 2; f = np.fft.rfftfreq(len(core), 1 / sr); tot = sp.sum()
    bar = sp[f < 400].sum() / tot; cen = (f * sp).sum() / tot; hi = sp[f > 3000].sum() / tot
    fm = cs.to_formant_burg(time_step=0.01, max_number_of_formants=5, maximum_formant=5500)
    T = cs.duration; F1 = np.nanmedian([fm.get_value_at_time(1, t) for t in np.linspace(T * .3, T * .7, 9)])
    F2 = np.nanmedian([fm.get_value_at_time(2, t) for t in np.linspace(T * .3, T * .7, 9)])
    F3 = np.nanmedian([fm.get_value_at_time(3, t) for t in np.linspace(T * .3, T * .7, 9)])
    rms = 20 * np.log10(np.sqrt(np.mean(core ** 2)) + 1e-9); peak = 20 * np.log10(np.abs(core).max() + 1e-9)
    return dict(ms=round(len(core) / sr * 1000), voiced=round(vfrac, 2), bar=round(float(bar), 2), hi=round(float(hi), 2), cen=round(float(cen)),
                F1=round(float(F1)), F2=round(float(F2)), F3=round(float(F3)), rms=round(float(rms), 1), peak=round(float(peak), 1))
def recog(paths):
    out = {}
    for p in paths:
        r = subprocess.run(['./venv/bin/python', '-m', 'allosaurus.run', '-m', 'eng2102', '-i', p], capture_output=True, text=True)
        out[p] = r.stdout.strip()
    return out
if __name__ == '__main__':
    paths = sys.argv[1:]
    rec = {p: '' for p in paths}
    rows = {}
    for p in paths:
        m = metrics(p); m['heard'] = rec[p]; rows[p.split('/')[-1]] = m
        print(f"{p.split('/')[-1]:12s} {m['ms']:4d}ms voiced={m['voiced']:.2f} bar={m['bar']:.2f} hi={m['hi']:.2f} cen={m['cen']:5d} F1/F2/F3={m['F1']:4d}/{m['F2']:4d}/{m['F3']:4d} rms={m['rms']:6.1f} peak={m['peak']:5.1f}  heard: {m['heard']}")
    json.dump(rows, open('proto/metrics.json', 'w'), indent=1)
