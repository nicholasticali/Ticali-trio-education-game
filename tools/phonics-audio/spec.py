# A grid of spectrograms (0-8 kHz) with the waveform under each, for eyeballing cuts.
import sys, numpy as np, soundfile as sf, matplotlib
matplotlib.use('Agg'); import matplotlib.pyplot as plt
paths = sys.argv[2:]; out = sys.argv[1]
n = len(paths); cols = 4; rows = (n + cols - 1) // cols
fig, axes = plt.subplots(rows * 2, cols, figsize=(cols * 3.2, rows * 2.6), gridspec_kw={'height_ratios': [3, 1] * rows})
axes = np.array(axes).reshape(rows * 2, cols)
for i in range(rows * cols):
    r, c = (i // cols) * 2, i % cols
    a1, a2 = axes[r, c], axes[r + 1, c]
    if i >= n: a1.axis('off'); a2.axis('off'); continue
    x, sr = sf.read(paths[i]); x = x if x.ndim == 1 else x[:, 0]
    a1.specgram(x, NFFT=512, Fs=sr, noverlap=448, cmap='magma', vmin=-120)
    a1.set_ylim(0, 8000); a1.set_title(paths[i].split('/')[-1] + f' {len(x)/sr*1000:.0f}ms', fontsize=8); a1.tick_params(labelsize=6)
    a2.plot(np.arange(len(x)) / sr, x, lw=0.4); a2.set_xlim(0, len(x) / sr); a2.set_ylim(-1, 1); a2.tick_params(labelsize=6)
plt.tight_layout(); plt.savefig(out, dpi=90)
