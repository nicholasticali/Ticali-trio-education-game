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


// Answer whatever question is on screen. With `missFirst`, deliberately
// pick a wrong answer where one exists (to trigger the hint and retry);
// otherwise answer correctly. Returns false if nothing answerable was found.
async function answerQuestion(page, missFirst) {
  const q = await page.evaluate(() => {
    const q = questions[qIdx];
    return { type: q.type || 'mc', correct: q.correct, answer: q.answer, accepted: q.acceptedAnswers,
             items: q.items, shuffle: q._shuffle, pa: q.partA, pb: q.partB,
             eliminated: [...document.querySelectorAll('.choice')].map(c => c.classList.contains('eliminated')) };
  });
  const t = q.type;
  if (t === 'mc' && await page.locator('.choice').count()) {
    let pick = q.correct;
    if (missFirst) pick = q.eliminated.findIndex((e, i) => !e && i !== q.correct);
    if (pick < 0) pick = q.correct;
    await page.locator('.choice').nth(pick).click();
    await page.waitForTimeout(400);
    return true;
  }
  if (t === 'tf') { await page.locator(q.answer === missFirst ? '.false-btn' : '.true-btn').click(); return true; }
  if (t === 'typed' || t === 'fib' || t === 'showwork') {
    if (t === 'showwork' && !(await page.locator('#workDone').isChecked())) await page.locator('#workDone').check();
    const value = missFirst ? '0000' : String(q.accepted[0]);
    if (await page.locator('.numpad-key').count() && /^[0-9.,:/$%()\- ]+$/.test(value)) {
      await page.locator('.numpad-key.clear').click();
      for (const ch of value) {
        const key = page.locator('.numpad-key', { hasText: new RegExp('^\\' + ch + '$') }).first();
        if (await key.count()) await key.click();
      }
    } else {
      if (await page.locator('.numpad-toggle').count()) await page.locator('.numpad-toggle').click();
      await page.locator('#typedInput').fill(value);
    }
    await page.locator('.typed-submit').click();
    await page.waitForTimeout(350);
    return true;
  }
  if (t === 'order') {
    const slots = await page.locator('.order-slot').count();
    for (let pos = 0; pos < slots; pos++) {
      const locked = await page.locator('.order-slot').nth(pos).evaluate(el => el.classList.contains('locked') || el.classList.contains('filled'));
      if (locked) continue;
      // Piece i belongs in spot i. Find it by its handler, not its text:
      // a text match for "1" would also find "11".
      const want = missFirst ? q.shuffle[pos] : pos;
      const item = page.locator(`.order-item[onclick="orderPlace(${want})"]`);
      if (await item.count()) await item.click(); else await page.locator('.order-item').first().click();
    }
    await page.locator('.puzzle-check').click();
    await page.waitForTimeout(350);
    return true;
  }
  if (t === 'sort') {
    const assign = await page.evaluate(() => { const q = questions[qIdx]; return q._shuffle.map(i => q.items[i].g); });
    const rows = await page.locator('.sort-row').count();
    for (let r = 0; r < rows; r++) {
      const btns = page.locator('.sort-row').nth(r).locator('.sort-btn');
      if (await btns.first().isDisabled()) continue;
      const n = await btns.count();
      await btns.nth(missFirst ? (assign[r] + 1) % n : assign[r]).click();
    }
    await page.locator('.puzzle-check').click();
    await page.waitForTimeout(350);
    return true;
  }
  if (t === 'multi') {
    const want = missFirst ? q.correct.slice(0, -1).concat([[0, 1, 2, 3, 4, 5].find(i => !q.correct.includes(i))]) : q.correct;
    const picked = await page.evaluate(() => [...qState.sel]);
    for (const i of picked) if (!want.includes(i)) await page.locator('.choice').nth(i).click();
    for (const i of want) if (!picked.includes(i)) await page.locator('.choice').nth(i).click();
    await page.locator('.puzzle-check').click();
    await page.waitForTimeout(350);
    return true;
  }
  if (t === 'twopart') {
    await page.locator('.part-choice[data-part="A"]').nth(q.pa.correct).click();
    await page.waitForTimeout(300);
    await page.locator('.part-choice[data-part="B"]').nth(missFirst ? (q.pb.correct + 1) % 4 : q.pb.correct).click();
    await page.waitForTimeout(300);
    return true;
  }
  return false;
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

      // 3. Play a full round of the first pack. Each question is missed once
      //    on purpose where the type allows it, so the THINK AGAIN hint and
      //    the second try are audited too, then answered right.
      const packs = await page.locator('.pack-card').count();
      if (packs === 0) { results.push(`[${vp.name}] hub ${name}: no packs`); }
      else {
        await page.locator('.pack-card').first().click();
        await page.waitForTimeout(250);
        if (await page.locator('.briefing').count()) {
          await auditPage(page, `${vp.name} / ${name} briefing`, results);
          await page.locator('.briefing-go').click();
          await page.waitForTimeout(250);
        }
        for (let q = 0; q < 12; q++) {
          if (await page.locator('.complete').count()) break;
          await auditPage(page, `${vp.name} / ${name} q${q + 1}`, results);
          const ok = await answerQuestion(page, q % 2 === 0);
          if (!ok) { results.push(`[${vp.name}] ${name} q${q+1}: no answerable control found`); break; }
          if (await page.locator('.think-box').count() && !(await page.locator('.next-btn').count())) {
            await auditPage(page, `${vp.name} / ${name} q${q + 1} think-again`, results);
            await answerQuestion(page, false);
          }
          await page.waitForTimeout(150);
          if (!(await page.locator('.why-box').count()) && await page.locator('.next-btn').count()) {
            const t = await page.evaluate(() => questions[qIdx] && (questions[qIdx].type || 'mc'));
            results.push(`[${vp.name}] ${name} q${q + 1} (${t}): no HERE'S WHY panel`);
          }
          const next = page.locator('.next-btn').first();
          if (await next.count()) { await next.click(); await page.waitForTimeout(150); }
        }
        if (!(await page.locator('.complete').count())) {
          results.push(`[${vp.name}] ${name}: round did not reach the completion screen`);
        } else {
          await auditPage(page, `${vp.name} / ${name} complete`, results);
        }
        // back to hub, then to profile select for the next kid
        const back = page.locator('.next-btn', { hasText: 'BACK TO PACKS' });
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
