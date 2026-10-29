// The "About this game" page for grown-ups.
//   node about.js [app.html]
// On an iPad (portrait and landscape), a laptop and a phone: the title screen's
// About link is at least 44px tall and opens the page; the page does not
// scroll sideways, and on touch screens every button and section heading is at
// least 44px tall; a grade (3rd) opens to list its subjects; Esc goes back to
// the title screen; no JS errors. Prints the page's figures (question count,
// packs) for the iPad, and saves a full-page screenshot of each to
// out/shots/about/.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const APP = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'Ticali_Trio_Family_Edition.html'));
const OUT = path.join(__dirname, 'out', 'shots', 'about');
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: CHROMIUM });
  let bad = 0; const fail = m => { bad++; console.log('FAIL ' + m); };
  const VPS = [{ n: 'ipad', width: 820, height: 1180, touch: true }, { n: 'laptop', width: 1280, height: 800 }, { n: 'phone', width: 390, height: 844, touch: true }, { n: 'ipad-land', width: 1180, height: 820, touch: true }];
  for (const vp of VPS) {
    const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.touch });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(APP); await p.waitForTimeout(300);
    const link = p.locator('.about-link');
    if (!(await link.count())) { fail(vp.n + ': no about link'); await ctx.close(); continue; }
    const lb = await link.boundingBox(); if (lb.height < 44) fail(vp.n + ': link ' + lb.height + 'px tall');
    if (vp.touch) await link.tap(); else await link.click();
    await p.waitForTimeout(200);
    if (!(await p.locator('.about-page').count())) { fail(vp.n + ': page did not open'); await ctx.close(); continue; }
    const r = await p.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      count: writtenQuestionCount(), packs: allPacks().length,
      figures: [...document.querySelectorAll('.about-figures span')].map(s => s.textContent.trim()),
      small: [...document.querySelectorAll('.about-page button, .about-page summary')].filter(e => e.getBoundingClientRect().height < 44).map(e => e.textContent.trim().slice(0, 30)),
      grades: [...document.querySelectorAll('.about-grade summary')].map(s => s.textContent.trim()),
      text: document.querySelector('.about-page').innerText.length,
    }));
    if (r.overflow) fail(vp.n + ': horizontal overflow');
    if (vp.touch && r.small.length) fail(vp.n + ': small targets ' + r.small.join(', '));
    // Open a grade: its subjects are listed.
    await p.locator('.about-grade summary').nth(3).click(); await p.waitForTimeout(100);
    const g3 = await p.evaluate(() => document.querySelectorAll('.about-grade')[3].querySelectorAll('.about-subject').length);
    if (!g3) fail(vp.n + ': 3rd grade lists no subjects');
    // Esc goes back to the title screen.
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    if (!(await p.locator('.title-screen').count())) fail(vp.n + ': Esc did not go back');
    if (errs.length) fail(vp.n + ': errors ' + errs.join(' | '));
    if (vp.n === 'ipad') console.log(JSON.stringify(r, null, 1));
    await link.click(); await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(OUT, `about-${vp.n}.png`), fullPage: true });
    await ctx.close();
  }
  await b.close();
  console.log(bad ? `about: FAIL — ${bad} problems` : `about: PASS — the About page on ${VPS.length} screens; screenshots in out/shots/about/`);
  process.exit(bad ? 1 : 0);
})();
