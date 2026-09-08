// Drives the app in a real browser at iPad sizes and reports anything
// that would break for a child: JS errors, tap targets under 44px, and
// content that overflows the viewport horizontally.
const { chromium, devices } = require('playwright');
const path = require('path');

const APP = 'file://' + path.resolve(process.argv[2] || require('path').join(__dirname, '..', 'Ticali_Trio_Family_Edition.html'));

const VIEWPORTS = [
  { name: 'iPad 10.9 portrait',  width: 820,  height: 1180, touch: true },
  { name: 'iPad 10.9 landscape', width: 1180, height: 820,  touch: true },
  { name: 'iPad Pro 12.9 land',  width: 1366, height: 1024, touch: true },
  { name: 'iPad Split View 1/2', width: 507,  height: 1180, touch: true },
  { name: 'iPhone portrait',     width: 390,  height: 844,  touch: true },
  { name: 'Touch laptop',        width: 1440, height: 900,  touch: true },
];

async function auditPage(page, label, results) {
  // Horizontal overflow: the page must never scroll sideways.
  const overflow = await page.evaluate(() => {
    const de = document.documentElement;
    const app = document.querySelector('.app');
    const w = window.innerWidth;
    const offenders = [];
    document.querySelectorAll('body *').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > w + 2 || r.left < -2)) {
        const s = el.className && typeof el.className === 'string' ? el.className : el.tagName;
        offenders.push({ sel: String(s).slice(0, 60), right: Math.round(r.right), left: Math.round(r.left) });
      }
    });
    return {
      docScrollW: de.scrollWidth, innerW: w,
      appScrollW: app ? app.scrollWidth : 0,
      offenders: offenders.slice(0, 6),
    };
  });
  if (overflow.docScrollW > overflow.innerW + 2) {
    results.push(`[${label}] horizontal overflow: doc ${overflow.docScrollW} > viewport ${overflow.innerW} :: ` +
      JSON.stringify(overflow.offenders));
  }

  // Tap target sizes on interactive elements.
  const small = await page.evaluate(() => {
    const sel = 'button, .choice, .tf-btn, .pack-card, .profile-card, .parent-link, .numpad-key, [role="button"]';
    const out = [];
    document.querySelectorAll(sel).forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;   // hidden
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') return;
      // A ::after hit-expander counts; measure it if present.
      if (r.height < 44 || r.width < 40) {
        out.push({
          sel: (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : el.tagName),
          text: (el.textContent || '').trim().slice(0, 24),
          w: Math.round(r.width), h: Math.round(r.height),
        });
      }
    });
    return out;
  });
  small.forEach(s => results.push(`small tap target ${s.sel} ${s.w}x${s.h}`));
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const results = [];
  const jsErrors = [];

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      hasTouch: vp.touch,
      isMobile: false,
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    page.on('pageerror', e => jsErrors.push(`[${vp.name}] pageerror: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') jsErrors.push(`[${vp.name}] console: ${m.text().slice(0,200)}`); });

    await page.goto(APP);
    await page.waitForTimeout(400);

    // 1. Title screen
    await auditPage(page, `${vp.name} / title`, results);

    // 2. Each profile hub
    const profileCount = await page.locator('.profile-card').count();
    if (profileCount === 0) results.push(`[${vp.name}] NO PROFILE CARDS RENDERED`);

    for (let i = 0; i < profileCount; i++) {
      await page.locator('.profile-card').nth(i).click();
      await page.waitForTimeout(250);
      const name = (await page.locator('.hub-name-block h2').textContent().catch(() => '?')) || '?';
      await auditPage(page, `${vp.name} / hub ${name}`, results);

      // 3. Play a full round of the first pack, answering every question.
      const packs = await page.locator('.pack-card').count();
      if (packs === 0) { results.push(`[${vp.name}] hub ${name}: no packs`); }
      else {
        await page.locator('.pack-card').first().click();
        await page.waitForTimeout(250);
        for (let q = 0; q < 12; q++) {
          if (await page.locator('.complete').count()) break;
          await auditPage(page, `${vp.name} / ${name} q${q + 1}`, results);

          if (await page.locator('.choice').count()) {
            await page.locator('.choice').first().click();
          } else if (await page.locator('.tf-btn').count()) {
            await page.locator('.tf-btn').first().click();
          } else if (await page.locator('#workDone').count()) {
            await page.locator('#workDone').check();
            if (await page.locator('.numpad-key').count()) {
              await page.locator('.numpad-key').first().click();
            } else {
              await page.locator('#typedInput').fill('x');
            }
            await page.locator('#swSubmit').click();
          } else if (await page.locator('#typedInput').count()) {
            if (await page.locator('.numpad-key').count()) {
              await page.locator('.numpad-key').first().click();
              const v = await page.locator('#typedInput').inputValue();
              if (!v) results.push(`[${vp.name}] numpad key did not enter a digit`);
            } else {
              await page.locator('#typedInput').fill('x');
            }
            await page.locator('.typed-submit').click();
          } else {
            results.push(`[${vp.name}] ${name} q${q+1}: no answerable control found`);
            break;
          }
          await page.waitForTimeout(120);
          const next = page.locator('.next-btn').first();
          if (await next.count()) { await next.click(); await page.waitForTimeout(150); }
        }
        if (!(await page.locator('.complete').count())) {
          results.push(`[${vp.name}] ${name}: round did not reach the completion screen`);
        } else {
          await auditPage(page, `${vp.name} / ${name} complete`, results);
        }
        // back to hub, then to profile select for the next kid
        const back = page.locator('.next-btn').nth(1);
        if (await back.count()) { await back.click(); await page.waitForTimeout(200); }
      }

      const sw = page.locator('.switch-btn', { hasText: 'SWITCH' });
      if (await sw.count()) { await sw.click(); await page.waitForTimeout(200); }
      else { await page.goto(APP); await page.waitForTimeout(300); }
    }

    await ctx.close();
  }

  await browser.close();

  console.log('=== JS ERRORS (' + jsErrors.length + ') ===');
  [...new Set(jsErrors)].slice(0, 40).forEach(e => console.log(e));
  console.log('\n=== LAYOUT / TOUCH FINDINGS (' + results.length + ') ===');
  const uniq = [...new Set(results)];
  uniq.forEach(r => console.log(r));
})();
