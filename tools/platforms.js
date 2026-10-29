// The game has to play the same on a laptop with no touchscreen, a
// touchscreen laptop, and an iPad. This plays the same round four ways —
// mouse only, keyboard only, touch taps on a touch laptop, touch taps on an
// iPad in both orientations — for every child, and fails unless every way
// reaches the end of the round with the same results and no errors.
//
// Real Safari is not available here; iPads are emulated in Chromium with
// touch input and iPad screen sizes.
const { chromium } = require('playwright');
const path = require('path');
const APP = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'Ticali_Trio_Family_Edition.html'));

const DEVICES = [
  { name: 'laptop, mouse only',    width: 1440, height: 900,  hasTouch: false, how: 'click' },
  { name: 'laptop, keyboard only', width: 1440, height: 900,  hasTouch: false, how: 'keys' },
  { name: 'touch laptop',          width: 1440, height: 900,  hasTouch: true,  how: 'tap' },
  { name: 'iPad portrait',         width: 820,  height: 1180, hasTouch: true,  how: 'tap' },
  { name: 'iPad landscape',        width: 1180, height: 820,  hasTouch: true,  how: 'tap' },
];

// Press a control the way this device would.
async function press(page, how, locator) {
  if (how === 'tap') return locator.tap();
  if (how === 'click') return locator.click();
  // Keyboard: the control must be in the Tab order (a native control, or
  // tabindex >= 0) and visible; give it focus the way Tab would, then Enter.
  const ok = await locator.evaluate(el => {
    const native = el.matches('button, a[href], input, select, textarea');
    const tabbable = native ? !el.disabled : el.tabIndex >= 0;
    if (!tabbable || el.offsetParent === null) return false;
    el.focus();
    return document.activeElement === el;
  });
  if (!ok) throw new Error('a control is not reachable with Tab');
  return page.keyboard.press('Enter');
}

// Answer the current question correctly, using only this device's input.
async function answer(page, how) {
  const q = await page.evaluate(() => {
    const q = questions[qIdx];
    return { type: q.type || 'mc', correct: q.correct, answer: q.answer, accepted: q.acceptedAnswers,
             items: q.items, pa: q.partA, pb: q.partB,
             sort: q.type === 'sort' ? q._shuffle.map(i => q.items[i].g) : null };
  });
  const t = q.type;
  if (how === 'keys') {
    // The shortcuts a child would use on a laptop.
    if (t === 'mc') return page.keyboard.press(String(q.correct + 1));
    if (t === 'tf') return page.keyboard.press(q.answer ? 't' : 'f');
    if (t === 'multi') { for (const i of q.correct) await page.keyboard.press(String(i + 1)); return page.keyboard.press('Enter'); }
    if (t === 'twopart') { await page.keyboard.press(String(q.pa.correct + 1)); await page.waitForTimeout(150); return page.keyboard.press(String(q.pb.correct + 1)); }
  }
  if (t === 'mc') return press(page, how, page.locator('.choice').nth(q.correct));
  if (t === 'tf') return press(page, how, page.locator(q.answer ? '.true-btn' : '.false-btn'));
  if (t === 'typed' || t === 'fib' || t === 'showwork') {
    if (t === 'showwork') {
      const box = page.locator('#workDone');
      if (how === 'keys') { await box.focus(); await page.keyboard.press('Space'); }
      else if (how === 'tap') await box.tap(); else await box.click();
    }
    const value = String(q.accepted[0]);
    const pad = await page.locator('.numpad-key').count();
    if (how === 'keys' || !pad || !/^[0-9.,:/$%()\- ]+$/.test(value)) {
      // Physical keyboard: digits go to the number pad; words go in the box.
      if (!pad) { await page.locator('#typedInput').focus(); }
      await page.keyboard.type(value.replace(/ /g, ''));
      if (!pad) return page.keyboard.press('Enter');
      return page.keyboard.press('Enter');
    }
    for (const ch of value.replace(/ /g, '')) {
      // Escape only symbols: \5 in a regex means character code 5, not the digit 5.
      const pat = new RegExp('^' + ch.replace(/[.*+?^${}()|[\]\\/$]/g, '\\$&') + '$');
      await press(page, how, page.locator('.numpad-key', { hasText: pat }).first());
    }
    return press(page, how, page.locator('.typed-submit'));
  }
  if (t === 'order') {
    // Piece i belongs in spot i; find it by its own handler, not its text
    // (a text match for "1" would also find "11").
    for (let i = 0; i < q.items.length; i++) await press(page, how, page.locator(`.order-item[onclick="orderPlace(${i})"]`));
    return press(page, how, page.locator('.puzzle-check'));
  }
  if (t === 'sort') {
    for (let r = 0; r < q.sort.length; r++) await press(page, how, page.locator('.sort-row').nth(r).locator('.sort-btn').nth(q.sort[r]));
    return press(page, how, page.locator('.puzzle-check'));
  }
  if (t === 'multi') {
    for (const i of q.correct) await press(page, how, page.locator('.choice').nth(i));
    return press(page, how, page.locator('.puzzle-check'));
  }
  if (t === 'twopart') {
    await press(page, how, page.locator('.part-choice[data-part="A"]').nth(q.pa.correct));
    await page.waitForTimeout(150);
    return press(page, how, page.locator('.part-choice[data-part="B"]').nth(q.pb.correct));
  }
  throw new Error('unknown question type ' + t);
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const failures = [];
  const outcomes = {};
  for (const dev of DEVICES) {
    const ctx = await browser.newContext({ viewport: { width: dev.width, height: dev.height }, hasTouch: dev.hasTouch, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(APP);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForTimeout(300);
    for (let kid = 0; kid < 3; kid++) {
      const label = `${dev.name} / child ${kid + 1}`;
      try {
        await page.goto(APP); await page.waitForTimeout(250);
        await press(page, dev.how, page.locator('.profile-card').nth(kid));
        await page.waitForTimeout(450);   // a press on the same spot within 400 ms of a screen change is a double tap
        // With the Brain Buddy module built in, a child's first visit asks her
        // to choose a buddy before the hub. Choose one with this device's own
        // input, at a person's pace: the app drops a second press on the same
        // spot within 400 ms of a screen change.
        if (await page.locator('.buddy-choose').count()) {
          await press(page, dev.how, page.locator('.buddy-tile').first());
          await page.waitForTimeout(450);
          await press(page, dev.how, page.locator('.buddy-go'));
          await page.waitForTimeout(450);
          if (!(await page.locator('.hub-name-block').count())) throw new Error('choosing a Brain Buddy did not lead to the hub');
        }
        // A pack with puzzles, so every input path is exercised.
        const packId = await page.evaluate(() => {
          const pk = PACKS[currentProfile.id].find(p => p.tier === 'now' && (THINK_ITEMS[p.id] || []).length) ||
                     PACKS[currentProfile.id].find(p => p.tier === 'now');
          return pk.id;
        });
        await press(page, dev.how, page.locator(`.pack-card[onclick="startPack('${packId}')"]`).first());
        await page.waitForTimeout(450);
        if (await page.locator('.briefing-go').count()) {
          if (dev.how === 'keys') await page.keyboard.press('Enter');
          else await press(page, dev.how, page.locator('.briefing-go'));
          await page.waitForTimeout(450);
        }
        // Make the round deterministic across devices: same questions, every type.
        await page.evaluate(() => {
          const pool = getQuestions(currentPack, currentPack.home || currentProfile.id).concat(getQuestions(currentPack, currentPack.home || currentProfile.id));
          const seen = new Set(), pick = [];
          for (const q of pool) { const t = q.type || 'mc'; if (!seen.has(t)) { seen.add(t); pick.push(q); } }
          for (const q of pool) if (pick.length < 10 && !pick.includes(q)) pick.push(q);
          questions = pick.slice(0, 10);
          qIdx = 0; renderQuestion();
        });
        await page.waitForTimeout(250);
        const types = await page.evaluate(() => questions.map(q => q.type || 'mc'));
        for (let n = 0; n < 12; n++) {
          if (await page.locator('.complete').count()) break;
          await answer(page, dev.how);
          await page.waitForTimeout(250);
          const next = page.locator('#fb .next-btn');
          if (!(await next.count())) throw new Error(`q${n + 1} (${types[n]}): answering did not finish the question`);
          if (dev.how === 'keys') await page.keyboard.press('Enter'); else await press(page, dev.how, next);
          await page.waitForTimeout(450);
        }
        if (!(await page.locator('.complete').count())) throw new Error('round did not reach the end');
        const result = await page.evaluate(() => ({ score, total: questions.length, fixed: fixedCount }));
        if (result.score !== result.total) throw new Error(`answered every question right but scored ${result.score}/${result.total}`);
        outcomes[label] = `${result.score}/${result.total} · types ${[...new Set(types)].join(',')}`;
      } catch (e) {
        failures.push(`[${label}] ${e.message}`);
      }
    }
    // Every visible control on the hub can be reached and is big enough,
    // measured once entrance animations (a sticker flipping in) have ended;
    // looping ones (a buddy bobbing) never end and do not change the size.
    await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running' ||
      (a.effect && a.effect.getComputedTiming && a.effect.getComputedTiming().iterations === Infinity)), null, { timeout: 10000 }).catch(() => {});
    const audit = await page.evaluate(() => {
      const small = [];
      document.querySelectorAll('button, [role="button"], .choice, .pack-card').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width && r.height && (r.height < 43.5 || r.width < 39.5)) small.push((el.className || el.tagName).toString().split(' ')[0] + ` ${Math.round(r.width)}x${Math.round(r.height)}`);
      });
      const unreachable = [...document.querySelectorAll('[onclick]')].filter(el =>
        el.offsetParent !== null && !el.matches('button, a, input, [role="button"], [role="checkbox"], [tabindex]')).map(el => el.className);
      return { small: [...new Set(small)].slice(0, 8), unreachable: [...new Set(unreachable)].slice(0, 8) };
    });
    audit.small.forEach(s => failures.push(`[${dev.name}] small target ${s}`));
    audit.unreachable.forEach(u => failures.push(`[${dev.name}] clickable but not keyboard-reachable: .${u}`));
    // The kindergartener's answers carry a 🔊. A tap on an answer must choose
    // it, never read it. A mouse lands exactly where it points, so checking
    // what is under the middle is enough. A finger does not: touchscreens
    // steer a fingertip toward a smaller button nearby, so on touch devices
    // every puzzle answer gets a real tap, middle and right of middle.
    await page.goto(APP); await page.waitForTimeout(250);
    const readInstead = new Set();
    await page.evaluate(() => {
      pickProfile('k'); state.profiles.k.autoRead = false;
      window.__hit = null;
      for (const fn of ['pickMc', 'pickTf', 'multiToggle', 'pickPart', 'orderPlace']) window[fn] = () => { __hit = 'chose'; };
      window.speakText = (t, evt) => { __hit = 'read'; if (evt) { evt.stopPropagation(); if (evt.cancelable) evt.preventDefault(); } };
    });
    const cases = await page.evaluate(() => {
      const out = [];
      for (const pk of PACKS.k) {
        (THINK_ITEMS[pk.id] || []).forEach((q, i) => out.push([pk.id, 'think', i]));
        for (let i = 0; i < 2; i++) out.push([pk.id, 'bank', i]);
      }
      return out;
    });
    for (const [pk, src, i] of cases) {
      const n = await page.evaluate(([pk, src, i]) => {
        currentPack = PACKS.k.find(x => x.id === pk);
        const q = src === 'think' ? THINK_ITEMS[pk][i] : getQuestions(currentPack, 'k')[i];
        if (!q || q.type === 'sort') return 0;
        questions = [prepareQuestion(JSON.parse(JSON.stringify(q)))]; qIdx = 0; renderQuestion();
        return document.querySelectorAll('.order-item, .choice, .tf-btn').length;
      }, [pk, src, i]);
      if (!n) continue;
      if (dev.how !== 'tap') {
        const hits = await page.evaluate(() => [...document.querySelectorAll('.order-item, .choice, .tf-btn')].filter(el => {
          el.scrollIntoView({ block: 'center' });
          const r = el.getBoundingClientRect();
          const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return at && at.closest('.js-speak');
        }).map(el => el.textContent.trim().slice(0, 20)));
        hits.forEach(h => readInstead.add(`${pk} "${h}"`));
        continue;
      }
      if (src === 'bank') continue;   // real taps on the puzzles; bank answers are full-width cards
      await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running'));
      for (let c = 0; c < n; c++) {
        const loc = page.locator('.order-item, .choice, .tf-btn').nth(c);
        await loc.scrollIntoViewIfNeeded();
        const box = await loc.boundingBox();
        for (const f of [0.5, 0.7]) {
          await page.evaluate(() => { __hit = null; });
          await page.touchscreen.tap(box.x + box.width * f, box.y + box.height / 2);
          if ((await page.evaluate(() => __hit)) !== 'chose') readInstead.add(`${pk} "${(await loc.textContent()).trim().slice(0, 20)}" tapped ${f * 100}% across`);
        }
      }
    }
    [...readInstead].slice(0, 6).forEach(h => failures.push(`[${dev.name}] tapping an answer reads it (or does nothing) instead of choosing it: ${h}`));
    if (readInstead.size > 6) failures.push(`[${dev.name}] ...and ${readInstead.size - 6} more answers like that`);
    errors.forEach(e => failures.push(`[${dev.name}] JS error: ${e}`));
    await ctx.close();
  }
  await browser.close();
  console.log('Outcomes:');
  Object.entries(outcomes).forEach(([k, v]) => console.log(`  ${k.padEnd(34)} ${v}`));
  const uniq = [...new Set(failures)];
  console.log(`\n${uniq.length} problems${uniq.length ? ':' : ' — the same game on every device.'}`);
  uniq.forEach(f => console.log('  ' + f));
  process.exit(uniq.length ? 1 : 0);
})();
