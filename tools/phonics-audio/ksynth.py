# Kokoro with per-phoneme duration control. synth(phonemes, scales) where scales maps index->factor.
import numpy as np, onnxruntime as ort, soundfile as sf
from kokoro_onnx import Kokoro
_k = Kokoro('models/kokoro-v1.0-timed.onnx', 'models/voices-v1.0.bin')   # for vocab + voices
_sess = ort.InferenceSession('models/kokoro-v1.0-dur.onnx')
VOCAB = _k.tokenizer.vocab
SR = 24000
def synth(ph, scale=None, voice='af_heart', speed=0.85):
    ids = [VOCAB[c] for c in ph if c in VOCAB]
    missing = [c for c in ph if c not in VOCAB]
    if missing: raise ValueError(f'not in vocab: {missing!r}')
    toks = np.array([[0, *ids, 0]], dtype=np.int64)
    ds = np.ones(toks.shape[1], dtype=np.float32)
    for i, f in (scale or {}).items(): ds[i + 1] = f          # +1 for the leading pad token
    style = _k._style_for(_k.get_voice_style(voice), len(ids))
    out = _sess.run(None, {'tokens': toks, 'style': np.asarray(style, dtype=np.float32), 'speed': np.array([speed], dtype=np.float32), 'dur_scale': ds})
    audio = np.asarray(out[0]).ravel(); dur = np.asarray(out[1]).ravel()
    # sample offset of each token (pad included): frames are uniform
    edges = np.concatenate([[0], np.cumsum(dur)]); edges = np.round(edges * (len(audio) / edges[-1])).astype(int)
    spans = [(c, edges[i+1]/SR, edges[i+2]/SR) for i, c in enumerate(ph) if c in VOCAB]
    return audio, spans
if __name__ == '__main__':
    import sys, json
    for name, ph, sc in json.loads(sys.argv[1]):
        a, spans = synth(ph, {int(k): v for k, v in sc.items()})
        sf.write(f'proto/{name}.wav', a, SR)
        print(name, ph, f'{len(a)/SR:.3f}s', ' '.join(f'{c}[{s:.3f}-{e:.3f}]' for c, s, e in spans))
