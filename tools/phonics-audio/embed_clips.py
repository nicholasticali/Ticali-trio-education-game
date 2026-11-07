# Put the recordings in mp3/ into the game file's PHONICS_CLIPS (after re-recording a sound).
#   python3 embed_clips.py ../../Ticali_Trio_Family_Edition.html
import sys, os, re, base64, json
game = sys.argv[1]
h = open(game, encoding='utf-8').read()
here = os.path.dirname(os.path.abspath(__file__))
ids = [s['id'] for s in json.load(open(os.path.join(here, 'sounds.json')))]
clips = {i: base64.b64encode(open(os.path.join(here, 'mp3', i + '.mp3'), 'rb').read()).decode() for i in ids}
block = 'const PHONICS_CLIPS = {\n' + ',\n'.join(f'  {k}: "{v}"' for k, v in clips.items()) + '\n};'
new, n = re.subn(r'const PHONICS_CLIPS = \{\n.*?\n\};', lambda m: block, h, count=1, flags=re.S)
if n != 1: sys.exit('PHONICS_CLIPS not found')
open(game, 'w', encoding='utf-8').write(new)
print(f'{len(clips)} recordings embedded ({sum(len(v) for v in clips.values()) // 1024} KB as base64)')
