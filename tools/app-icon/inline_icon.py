# Puts icon-180.png into the game file, so the game carries the same Home Screen icon as the web
# copy's icon files: the apple-touch-icon and the tab icon, and the icon in its built-in manifest
# (the one a game opened as a file uses).
#   python3 tools/app-icon/inline_icon.py      (after node tools/app-icon/make_icons.js)
# Running it again changes nothing.
import base64, json, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
GAME = os.path.join(ROOT, 'Ticali_Trio_Family_Edition.html')
png = base64.b64encode(open(os.path.join(ROOT, 'icon-180.png'), 'rb').read()).decode()
icon = 'data:image/png;base64,' + png

src = open(GAME, encoding='utf-8').read()
head_end = src.index('</head>')
head, rest = src[:head_end], src[head_end:]

def tag(rel):
    m = re.search(r'<link rel="' + rel + r'"[^>]*?href="(data:[^"]*)"', head)
    if not m:
        sys.exit('no <link rel="%s"> with a data: address in the game head' % rel)
    return m

for rel in ('apple-touch-icon', 'icon'):
    m = tag(rel)
    head = head[:m.start(1)] + icon + head[m.end(1):]

m = tag('manifest')
b64 = m.group(1).split('base64,', 1)[1]
manifest = json.loads(base64.b64decode(b64))
for i in manifest.get('icons', []):
    if str(i.get('src', '')).startswith('data:image/png'):
        i['src'] = icon
        i['sizes'] = '180x180'
new = 'data:application/manifest+json;base64,' + base64.b64encode(json.dumps(manifest, separators=(',', ':')).encode()).decode()
head = head[:m.start(1)] + new + head[m.end(1):]

out = head + rest
if out != src:
    open(GAME, 'w', encoding='utf-8').write(out)
    print('the game file now carries the icon from icon-180.png')
else:
    print('the game file already carries the icon from icon-180.png')
