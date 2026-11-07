# The letter-sound recordings

The game plays a short recording of each of Amplify CKLA's 44 sounds (and /zh/) wherever it
names a sound, because no device voice can say a sound on its own (they read /b/ as "buh" or
"slash b"). This folder makes those 45 recordings. They are built once and embedded in the game
as MP3s (about 200 KB); nothing here runs when the game runs.

## How a sound is made

A speech model cannot say a sound alone either: asked for "k" it adds a vowel, asked for "sss" it
says a word. So each sound is **cut out of a word the model says well**, at landmarks measured in
the audio (where voicing starts or stops, the burst of a stop, the steady stretch of a hum), and
then shaped the way CKLA teachers say it:

- **Clipped sounds** (/b/ /d/ /g/ /p/ /t/ /k/ /ch/ /j/ /h/ /r/ /w/ /y/ /x/ /qu/ /ə/): only the
  release and its breath, no vowel after it. For /b/ /d/ /g/, a short voice bar, the release and
  about 25 ms of the vowel's start, which is how the ear tells b, d and g apart, too short to hear
  as "uh".
- **Held sounds** (/m/ /n/ /ng/ /l/ /s/ /f/ /sh/ /th/ and the vowels): the steady part, lengthened.
  Voiced sounds are lengthened by pitch-synchronous overlap-add; hissing sounds by random grains
  (overlap-add would make a hiss buzz), then matched to the original's spectrum, with the real
  first and last 40-60 ms kept, since that is where /th/ differs from /s/.
- **/v/ /z/ /th/ (this) /zh/**: the model voices them weakly, so each is its own hiss (/f/ /s/
  /th/ /sh/) with the voice's own hum under it, the hiss pulsing at the voice's pitch: how a
  voiced fricative is made.
- **Vowels**: the steadiest 100 ms of the vowel, from the word (out of a dozen) whose vowel is
  most clearly itself and least like its neighbors (bet vs bat, book vs buck), then lengthened.
  Gliding vowels (/ae/ /ie/ /oe/ /ue/ /ou/ /oi/ /ar/ /or/) keep their whole glide.

Every recording is then checked by measurement: voicing, length, loudness and spectral shape,
and, against the same sound cut from other words, it must be nearest its own sound (10 of 10
vowels, 14 of 14 consonants in the families p t k ch, b d g, s sh f th, m n ng). These checks
are no substitute for a teacher's ear: the parent dashboard's 🔈 HEAR ALL 45 SOUNDS plays them.

The voice is `af_heart` of **Kokoro-82M** (Apache-2.0), run with **kokoro-onnx** from PyPI.

## Rebuilding

    python3 -m venv venv && ./venv/bin/pip install kokoro-onnx praat-parselmouth soundfile numpy onnx matplotlib
    mkdir models   # then download into it, from the kokoro-onnx project's GitHub release "model-files-v1.0":
                   #   kokoro-v1.0.onnx and voices-v1.0.bin
    ./venv/bin/python make_models.py          # writes the timed copy of the model (phoneme durations as an output)
    ./venv/bin/python build.py table_final.json out     # 45 WAVs in out/
    ./venv/bin/python vowelcheck.py out && ./venv/bin/python conscheck.py out    # the identity checks
    for f in out/*.wav; do ffmpeg -y -i "$f" -ac 1 -ar 24000 -codec:a libmp3lame -b:a 64k "mp3/$(basename "$f" .wav).mp3"; done

`table_final.json` says, for each sound, the word it is cut from and how; `vowelpick.py` and
`conspick.py` are how the words were chosen (`picks.json`, `conspicks.json`). `evaluate.py`
prints the measurements; `spec.py` draws spectrograms. The MP3s go into the game's
`// ═══ PHONICS SOUNDS ═══` block as `PHONICS_CLIPS`, beside `PHONICS_SOUNDS` (notation, key word,
spellings, how to say it), from which the game's 🔈 page and its speaker work.
