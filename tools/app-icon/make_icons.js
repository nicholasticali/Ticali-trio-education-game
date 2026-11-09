// The Home Screen icons: the game's three circles (one per child), drawn crisp at each size.
//   node tools/app-icon/make_icons.js        (writes icon-180.png, icon-192.png, icon-512.png and
//                                             icon-maskable-512.png next to the game file)
// No frame: iPadOS rounds every Home Screen icon's corners, which would clip a border unevenly.
// The maskable icon keeps the circles inside the middle 80%, the "safe zone" a launcher may crop to.
// Afterwards, tools/app-icon/inline_icon.py puts icon-180.png into the game file itself (the icon a
// game opened as a file, or added from Safari, shows).
const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const svg = scale => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="100%" height="100%">
  <rect width="180" height="180" fill="#fdf6e3"/>
  <g transform="translate(90 90) scale(${scale}) translate(-90 -90)" stroke="#1a1a2e" stroke-width="4">
    <circle cx="62" cy="65" r="29" fill="#ff5e87"/>
    <circle cx="118" cy="65" r="29" fill="#0096c7"/>
    <circle cx="90" cy="117" r="29" fill="#ff8800"/>
  </g>
</svg>`;
(async () => {
  const b = await chromium.launch({ executablePath: CHROMIUM });
  for (const [file, size, scale] of [['icon-180.png', 180, 1], ['icon-192.png', 192, 1], ['icon-512.png', 512, 1], ['icon-maskable-512.png', 512, 0.78]]) {
    const p = await (await b.newContext({ viewport: { width: size, height: size } })).newPage();
    await p.setContent(`<html><body style="margin:0">${svg(scale)}</body></html>`);
    await p.screenshot({ path: path.join(ROOT, file), omitBackground: false });
    console.log('wrote', file);
  }
  await b.close();
})();
