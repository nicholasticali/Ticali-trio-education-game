// Every grade, K-5, on the title screen.
//   node title-grades.js [app.html]
// Under the three profile cards, "📚 EVERY GRADE, K–5" has a button for each
// grade with its pack count. A button opens "Who is playing?" (the three
// children and "👀 Just looking: nothing is saved"), which Esc, the ✕ and a tap
// outside close; a quick double tap on a grade, the ✕ or outside it, and a
// doubled Enter, pick nobody. A child opens that grade as that child, and a round played
// there adds XP to that child only. Just looking opens the grade with nothing
// saved: a full round (answers right and wrong, SHOW ME HOW opened, the exit
// pop-up) leaves the children's save byte-identical with no storage write at
// all, and ← ALL GRADES goes back to the title screen with the same XP and
// trophies as before. Played with a mouse on a laptop (1366x625, where the
// three cards stay on the first screen), with the keyboard only (Tab, Enter,
// Space, Esc) and by touch on an iPad (820x1180), and laid out at 390x844,
// 820x1180, 1180x820 and 1366x625. No JS errors. Screenshots in
// out/shots/title-grades/.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const APP = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'Ticali_Trio_Family_Edition.html'));
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const OUT = path.join(__dirname, 'out', 'shots', 'title-grades');
const KEY = 'tapChampions_v3';
fs.mkdirSync(OUT, { recursive: true });

let bad = 0, good = 0;
const ok = (cond, msg) => { if (cond) { good++; console.log('  ok   ' + msg); } else { bad++; console.log('  FAIL ' + msg); } };
const wait = (page, ms) => page.waitForTimeout(ms);

// A family's real save: every child has XP and trophies to lose.
const kid = (xp, extra) => Object.assign({ xp, trophies: ['warmup', 'streak_3'], packs: { demo: { best: 9, total: 10 } },
  rounds: { demo: 2 }, reviews: [], correct: 40, attempts: 50, bestStreak: 7, summerMode: false, autoRead: false, history: [] }, extra || {});
const SAVE = { profiles: { k: kid(320, { autoRead: true }), g3: kid(1210), g5: kid(2405, { trophies: ['warmup', 'streak_3', 'xp_200'] }) },
  parent: { reportRequired: true, secondChance: true } };

async function open(browser, vp, errors) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.touch });
  // Every storage write the page makes, so "nothing is saved" means nothing.
  await ctx.addInitScript(() => {
    window.__writes = [];
    const P = Storage.prototype, set = P.setItem, rem = P.removeItem, clr = P.clear;
    P.setItem = function (k, v) { window.__writes.push('set ' + k); return set.call(this, k, v); };
    P.removeItem = function (k) { window.__writes.push('remove ' + k); return rem.call(this, k); };
    P.clear = function () { window.__writes.push('clear'); return clr.call(this); };
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`[${vp.name}] ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${vp.name}] console: ${m.text().slice(0, 200)}`); });
  await page.goto(APP);
  await page.evaluate(([k, s]) => { localStorage.clear(); localStorage.setItem(k, JSON.stringify(s)); }, [KEY, SAVE]);
  await page.reload(); await wait(page, 600);
  return { ctx, page };
}

// Press a control the way this device would. Keyboard: the control must be
// in the Tab order; it gets focus the way Tab would give it, then Enter.
async function press(page, how, loc) {
  if (how === 'tap') { await loc.scrollIntoViewIfNeeded(); return loc.tap(); }
  if (how === 'click') return loc.click();
  const reach = await loc.evaluate(el => {
    const tabbable = el.matches('button, a[href], input, select, textarea') ? !el.disabled : el.tabIndex >= 0;
    if (!tabbable || el.offsetParent === null) return false;
    el.focus(); return document.activeElement === el;
  });
  if (!reach) throw new Error('a control is not reachable with Tab: ' + (await loc.evaluate(el => el.className)));
  return page.keyboard.press('Enter');
}
async function tabTo(page, test, arg, max) {
  for (let i = 0; i < (max || 40); i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(test, arg)) return true;
  }
  return false;
}
const saved = page => page.evaluate(k => localStorage.getItem(k), KEY);
const xpOf = (raw, pid) => JSON.parse(raw).profiles[pid].xp;
const header = page => page.evaluate(() => {
  const h = document.querySelector('.hub-name-block h2'), p = document.querySelector('.hub-name-block p');
  const b = document.querySelector('.hub-header .switch-btn');
  return { h2: h ? h.textContent.trim() : '', p: p ? p.textContent.trim() : '', btn: b ? b.textContent.trim() : '' };
});

// Answer the question on screen with this device's input. `wrong`: a wrong
// answer where the type has one (the hint and second try follow).
async function answer(page, how, wrong) {
  const q = await page.evaluate(() => {
    const q = questions[qIdx];
    return { type: q.type || 'mc', correct: q.correct, answer: q.answer, accepted: q.acceptedAnswers, items: q.items,
      shuffle: q._shuffle, pa: q.partA, pb: q.partB, sort: q.type === 'sort' ? q._shuffle.map(i => q.items[i].g) : null,
      eliminated: [...document.querySelectorAll('.choice')].map(c => c.classList.contains('eliminated')) };
  });
  const t = q.type;
  if (how === 'keys' && !wrong) {
    if (t === 'mc') return page.keyboard.press(String(q.correct + 1));
    if (t === 'tf') return page.keyboard.press(q.answer ? 't' : 'f');
    if (t === 'multi') { for (const i of q.correct) await page.keyboard.press(String(i + 1)); return page.keyboard.press('Enter'); }
    if (t === 'twopart') { await page.keyboard.press(String(q.pa.correct + 1)); await wait(page, 150); return page.keyboard.press(String(q.pb.correct + 1)); }
  }
  if (t === 'mc') {
    let pick = q.correct;
    if (wrong) { pick = q.eliminated.findIndex((e, i) => !e && i !== q.correct); if (pick < 0) pick = q.correct; }
    return press(page, how, page.locator('.choice').nth(pick));
  }
  if (t === 'tf') return press(page, how, page.locator(q.answer === !wrong ? '.true-btn' : '.false-btn'));
  if (t === 'typed' || t === 'fib' || t === 'showwork') {
    if (t === 'showwork' && !(await page.locator('#workDone').isChecked())) {
      const box = page.locator('#workDone');
      if (how === 'keys') { await box.focus(); await page.keyboard.press('Space'); } else if (how === 'tap') await box.tap(); else await box.click();
    }
    const value = wrong ? '0000' : String(q.accepted[0]);
    const pad = await page.locator('.numpad-key').count();
    if (how === 'keys' || !pad || !/^[0-9.,:/$%()\- ]+$/.test(value)) {
      if (pad && !/^[0-9.,:/$%()\- ]+$/.test(value) && how !== 'keys') await press(page, how, page.locator('.numpad-toggle'));
      if (!(await page.locator('.numpad-key').count()) || how !== 'keys') await page.locator('#typedInput').focus();
      if (!pad || how !== 'keys') await page.locator('#typedInput').fill('');
      await page.keyboard.type(value.replace(/ /g, ''));
      return page.keyboard.press('Enter');
    }
    await press(page, how, page.locator('.numpad-key.clear'));
    for (const ch of value.replace(/ /g, '')) {
      const pat = new RegExp('^' + ch.replace(/[.*+?^${}()|[\]\\/$]/g, '\\$&') + '$');
      await press(page, how, page.locator('.numpad-key', { hasText: pat }).first());
    }
    return press(page, how, page.locator('.typed-submit'));
  }
  if (t === 'order') {
    for (let pos = 0; pos < q.items.length; pos++) {
      const want = wrong ? q.shuffle[pos] : pos;
      const item = page.locator(`.order-item[onclick="orderPlace(${want})"]`);
      if (await item.count()) await press(page, how, item); else await press(page, how, page.locator('.order-item').first());
    }
    return press(page, how, page.locator('.puzzle-check'));
  }
  if (t === 'sort') {
    for (let r = 0; r < q.sort.length; r++) {
      const btns = page.locator('.sort-row').nth(r).locator('.sort-btn');
      if (await btns.first().isDisabled()) continue;
      const n = await btns.count();
      await press(page, how, btns.nth(wrong ? (q.sort[r] + 1) % n : q.sort[r]));
    }
    return press(page, how, page.locator('.puzzle-check'));
  }
  if (t === 'multi') {
    const want = wrong ? q.correct.slice(0, -1).concat([[0, 1, 2, 3, 4, 5].find(i => !q.correct.includes(i))]) : q.correct;
    const picked = await page.evaluate(() => [...qState.sel]);
    for (const i of picked) if (!want.includes(i)) await press(page, how, page.locator('.choice').nth(i));
    for (const i of want) if (!picked.includes(i)) await press(page, how, page.locator('.choice').nth(i));
    return press(page, how, page.locator('.puzzle-check'));
  }
  if (t === 'twopart') {
    await press(page, how, page.locator('.part-choice[data-part="A"]').nth(q.pa.correct));
    await wait(page, 300);
    return press(page, how, page.locator('.part-choice[data-part="B"]').nth(wrong ? (q.pb.correct + 1) % q.pb.options.length : q.pb.correct));
  }
  throw new Error('unknown question type ' + t);
}

// A whole round, from the pack card to the round-complete screen.
//   opts.mix: miss every other question on purpose; opts.coach: open SHOW ME HOW on the first.
async function playRound(page, how, packSel, opts) {
  opts = opts || {};
  await press(page, how, page.locator(packSel).first()); await wait(page, 450);
  if (await page.locator('.briefing-go').count()) {
    if (how === 'keys') await page.keyboard.press('Enter'); else await press(page, how, page.locator('.briefing-go'));
    await wait(page, 450);
  }
  const seen = { wrong: 0, right: 0, coach: false };
  for (let n = 0; n < 12; n++) {
    if (await page.locator('.complete').count()) break;
    if (!(await page.locator('.question-frame').count())) throw new Error(`q${n + 1}: no question on screen`);
    if (opts.coach && n === 0) {
      await press(page, how, page.locator('.help-btn')); await wait(page, 400);
      seen.coach = !!(await page.locator('#coach-overlay').count());
      await page.keyboard.press('Escape'); await wait(page, 300);
      if (await page.locator('#coach-overlay').count()) throw new Error('SHOW ME HOW did not close with Esc');
    }
    const miss = !!opts.mix && n % 2 === 0;
    await answer(page, how, miss); await wait(page, 350);
    if (miss) seen.wrong++;
    if (await page.locator('.think-box').count() && !(await page.locator('#fb .next-btn').count())) { await answer(page, how, false); await wait(page, 350); }
    const next = page.locator('#fb .next-btn');
    if (!(await next.count())) throw new Error(`q${n + 1}: answering did not finish the question`);
    if (!miss) seen.right++;
    if (how === 'keys') await page.keyboard.press('Enter'); else await press(page, how, next);
    await wait(page, 450);
  }
  if (!(await page.locator('.complete').count())) throw new Error('the round did not reach its end');
  return seen;
}
// A sticker or buddy pop-up after a round is the game's own celebration: let it go.
async function closePopups(page) {
  for (const sel of ['#stk-overlay', '#buddy-room']) if (await page.locator(sel).count()) { await page.keyboard.press('Escape'); await wait(page, 300); }
}

// ─── 1. The row and the chooser at four screen sizes ───
async function layout(browser, errors) {
  console.log('\n▶ layout: the row and the chooser at four sizes');
  const SIZES = [{ name: 'phone 390x844', width: 390, height: 844, touch: true }, { name: 'iPad 820x1180', width: 820, height: 1180, touch: true },
    { name: 'iPad 1180x820', width: 1180, height: 820, touch: true }, { name: 'laptop 1366x625', width: 1366, height: 625 }];
  for (const vp of SIZES) {
    const { ctx, page } = await open(browser, vp, errors);
    const tag = vp.name;
    const r = await page.evaluate(() => {
      const sec = document.querySelector('.title-grades');
      const chips = [...document.querySelectorAll('.title-grade')];
      const cards = [...document.querySelectorAll('.profile-card')].map(c => c.getBoundingClientRect());
      const fam = document.querySelector('.family-panel');
      const kids = document.querySelector('.profiles');
      return {
        head: sec ? sec.querySelector('h2').textContent.trim() : '',
        keys: chips.map(c => c.dataset.grade),
        counts: chips.map(c => c.querySelector('.grade-chip-count').textContent.trim()),
        want: GRADES.map(g => `${gradePacks(g.key).length} packs`),
        wantKeys: GRADES.map(g => g.key),
        labels: chips.map(c => c.querySelector('.grade-chip-label').textContent.trim()),
        wantLabels: GRADES.map(g => g.label),
        icons: chips.map(c => c.querySelector('.grade-chip-icon').textContent.trim()),
        wantIcons: GRADES.map(g => g.icon),
        small: chips.filter(c => { const b = c.getBoundingClientRect(); return b.height < 44 || b.width < 44; }).length,
        spill: chips.filter(c => c.scrollWidth > c.clientWidth + 1 || c.querySelector('.grade-chip-label').getBoundingClientRect().right > c.getBoundingClientRect().right).length,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        after: !!(sec && kids && (kids.compareDocumentPosition(sec) & Node.DOCUMENT_POSITION_FOLLOWING)),
        beforeFamily: !fam || !!(sec && (sec.compareDocumentPosition(fam) & Node.DOCUMENT_POSITION_FOLLOWING)),
        below: sec ? sec.getBoundingClientRect().top >= Math.max(...cards.map(c => c.bottom)) : false,
        cardsShown: cards.every(c => c.top >= -1 && c.bottom <= innerHeight + 1),
        firstShown: cards.length ? cards[0].top < innerHeight : false,
      };
    });
    ok(r.head === '📚 EVERY GRADE, K–5', `${tag}: the heading reads "${r.head}"`);
    ok(JSON.stringify(r.keys) === JSON.stringify(r.wantKeys), `${tag}: a button for each grade, K to 5 (${r.keys.join(' ')})`);
    ok(JSON.stringify(r.counts) === JSON.stringify(r.want), `${tag}: each shows its pack count (${r.counts.join(', ')})`);
    ok(JSON.stringify(r.labels) === JSON.stringify(r.wantLabels) && JSON.stringify(r.icons) === JSON.stringify(r.wantIcons), `${tag}: each shows its grade's icon and name`);
    ok(r.small === 0, `${tag}: every grade button is at least 44px`);
    ok(r.spill === 0, `${tag}: no grade name spills out of its button`);
    ok(!r.overflow, `${tag}: the title screen never scrolls sideways`);
    ok(r.after && r.beforeFamily && r.below, `${tag}: the row sits below the three cards and above the family goal`);
    if (vp.width === 1366) ok(r.cardsShown, `${tag}: all three cards are on the first screen`);
    else ok(r.firstShown, `${tag}: the first card is on the first screen`);
    await page.screenshot({ path: path.join(OUT, `title-${vp.width}x${vp.height}.png`) });
    await page.evaluate(() => document.querySelector('.title-grades').scrollIntoView({ block: 'center' }));
    await wait(page, 150);
    await page.screenshot({ path: path.join(OUT, `row-${vp.width}x${vp.height}.png`) });
    // The chooser fits the screen and every target is a full size.
    await press(page, vp.touch ? 'tap' : 'click', page.locator('.title-grade').nth(2)); await wait(page, 450);
    const m = await page.evaluate(() => {
      const box = document.querySelector('.who-modal');
      if (!box) return null;
      const b = box.getBoundingClientRect();
      return { left: b.left, right: b.right, top: b.top, bottom: b.bottom,
        small: [...box.querySelectorAll('button')].filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map(e => e.className),
        overflow: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    ok(!!m && m.left >= 0 && m.right <= vp.width && m.top >= 0 && m.bottom <= vp.height && !m.overflow, `${tag}: the chooser fits the screen`);
    ok(!!m && m.small.length === 0, `${tag}: every button in the chooser is at least 44px ${m && m.small.length ? m.small.join(',') : ''}`);
    await page.screenshot({ path: path.join(OUT, `who-${vp.width}x${vp.height}.png`) });
    await ctx.close();
  }
}

// ─── 2. Mouse on a laptop: open and cancel; a child; just looking ───
async function mouse(browser, errors) {
  console.log('\n▶ mouse, laptop 1366x625');
  const vp = { name: 'laptop mouse', width: 1366, height: 625 };
  const { ctx, page } = await open(browser, vp, errors);
  const isOpen = () => page.evaluate(() => !!document.querySelector('#who-backdrop [role="dialog"]'));
  const g2 = page.locator('.title-grade[data-grade="2"]');
  // Open: the three children, each in their own colour, and Just looking.
  await g2.click(); await wait(page, 450);
  const who = await page.evaluate(() => ({
    kids: [...document.querySelectorAll('.who-kid')].map(b => ({ name: b.querySelector('.who-kid-name').textContent.trim(),
      emoji: b.querySelector('.who-kid-emoji').textContent.trim(), color: b.style.getPropertyValue('--card-color').trim() })),
    want: Object.values(PROFILES).map(p => ({ name: p.name, emoji: p.emoji, color: p.color })),
    guest: (document.querySelector('.who-guest') || {}).textContent,
    title: (document.querySelector('.who-title') || {}).textContent,
    inert: app.inert,
  }));
  ok(JSON.stringify(who.kids) === JSON.stringify(who.want), `the chooser lists the three children with their emoji, name and colour (${who.kids.map(k => k.emoji + ' ' + k.name).join(', ')})`);
  ok((who.guest || '').trim() === '👀 Just looking: nothing is saved', `and "${(who.guest || '').trim()}"`);
  ok(who.inert, 'the title screen behind it is inert');
  await page.keyboard.press('Escape'); await wait(page, 300);
  ok(!(await isOpen()) && !(await page.evaluate(() => app.inert)), 'Esc closes it');
  ok(await page.evaluate(() => document.activeElement && document.activeElement.dataset.grade === '2'), 'focus goes back to the grade button');
  await g2.click(); await wait(page, 450);
  await page.locator('.who-close').click(); await wait(page, 300);
  ok(!(await isOpen()), 'the ✕ closes it');
  await g2.click(); await wait(page, 450);
  await page.mouse.click(8, 8); await wait(page, 300);
  ok(!(await isOpen()) && await page.locator('.title-screen').count() === 1 && await page.evaluate(() => currentProfile === null), 'a click outside closes it, nothing picked');

  // A child: the 5th grader plays 2nd grade, and only the 5th grader's XP moves.
  const before = await saved(page);
  await g2.click(); await wait(page, 450);
  await page.locator('.who-kid', { hasText: '5TH GRADE' }).click(); await wait(page, 450);
  let h = await header(page);
  ok(await page.evaluate(() => currentProfile && currentProfile.id === 'g5' && libraryGrade === '2' && !guestMode), 'a child: 2nd grade opens as the 5th grader');
  ok(h.h2 === '2ND GRADE' && /playing as 5th grade/.test(h.p) && h.btn === '← MY HUB', `its header: "${h.h2} · ${h.p}", ${h.btn}`);
  ok(await page.locator('.pack-card').count() === await page.evaluate(() => gradePacks('2').length), 'every 2nd grade pack is there');
  try {
    const seen = await playRound(page, 'click', '.pack-card');
    ok(seen.right >= 10, 'a round of 2nd grade played to the end');
  } catch (e) { ok(false, 'a child\'s round: ' + e.message); }
  await closePopups(page);
  const after = await saved(page);
  ok(xpOf(after, 'g5') > xpOf(before, 'g5'), `the 5th grader's saved XP went up (${xpOf(before, 'g5')} → ${xpOf(after, 'g5')})`);
  ok(xpOf(after, 'k') === xpOf(before, 'k') && xpOf(after, 'g3') === xpOf(before, 'g3'), 'the other two children\'s saved XP did not move');
  await page.locator('.complete-nav', { hasText: 'BACK TO PACKS' }).click(); await wait(page, 450);
  h = await header(page);
  ok(h.h2 === '2ND GRADE', 'BACK TO PACKS returns to 2nd grade');
  await page.locator('.hub-header .switch-btn').click(); await wait(page, 450);
  if (await page.locator('.buddy-choose').count()) {   // the 5th grader's own first visit to the hub
    await page.locator('.buddy-tile').first().click(); await wait(page, 450);
    await page.locator('.buddy-go').click(); await wait(page, 450);
  }
  h = await header(page);
  ok(h.h2 === '5TH GRADE', '← MY HUB goes to the 5th grader\'s hub');
  await page.locator('.switch-btn', { hasText: 'SWITCH' }).click(); await wait(page, 450);

  // Just looking: a whole round, right and wrong answers, SHOW ME HOW, the exit pop-up.
  const g3 = page.locator('.title-grade[data-grade="3"]');
  await g3.scrollIntoViewIfNeeded(); await g3.click(); await wait(page, 450);
  const snap = await saved(page);
  const writes0 = await page.evaluate(() => __writes.length);
  const shown0 = await page.evaluate(() => Object.fromEntries(Object.keys(PROFILES).map(p => [p, { xp: state.profiles[p].xp, trophies: state.profiles[p].trophies.length }])));
  await page.locator('.who-guest').click(); await wait(page, 450);
  h = await header(page);
  ok(await page.evaluate(() => guestMode === true && libraryGrade === '3'), 'just looking: 3rd grade opens in guest mode');
  ok(h.h2 === '3RD GRADE' && /just looking · nothing is saved/.test(h.p) && !/playing as/.test(h.p), `its header: "${h.h2} · ${h.p}"`);
  ok(h.btn === '← ALL GRADES', `its button reads "${h.btn}"`);
  ok(await page.evaluate(() => getComputedStyle(document.querySelector('.parent-link')).display === 'none'), 'the parent link is hidden while just looking');
  ok(await page.locator('.buddy-choose, #buddy-room, #tut-overlay').count() === 0, 'no first-visit pop-up (buddy chooser, walkthrough)');
  await page.screenshot({ path: path.join(OUT, 'guest-library.png') });
  try {
    const seen = await playRound(page, 'click', '.pack-card', { mix: true, coach: true });
    ok(seen.coach, 'SHOW ME HOW opened during the round');
    ok(seen.wrong >= 4 && seen.right >= 4, `a full round with ${seen.wrong} wrong first tries and ${seen.right} right ones`);
  } catch (e) { ok(false, 'the guest round: ' + e.message); }
  const done = await page.evaluate(() => ({ note: (document.querySelector('.guest-note') || {}).textContent || '',
    family: !!document.querySelector('.family-done'), missions: !!document.querySelector('.missions-done'), review: !!document.querySelector('.review-notice') }));
  ok(/Just looking: nothing from this round is saved/.test(done.note), 'the round-complete screen says nothing is saved');
  ok(!done.family && !done.missions && !done.review, 'no family-goal stars, missions or parent review for a visitor');
  await page.screenshot({ path: path.join(OUT, 'guest-complete.png') });
  await closePopups(page);
  ok(await page.locator('.buddy-choose').count() === 0, 'still no buddy chooser');
  // Again, then leave half way: the exit pop-up says nothing is saved, and EXIT goes back to the grade.
  await page.locator('.complete-nav', { hasText: 'PLAY AGAIN' }).click(); await wait(page, 450);
  if (await page.locator('.briefing-go').count()) { await page.locator('.briefing-go').click(); await wait(page, 450); }
  await page.keyboard.press('Escape'); await wait(page, 300);
  const exitText = await page.evaluate(() => (document.getElementById('exit-modal-backdrop') || {}).textContent || '');
  ok(/Just looking: nothing is saved/.test(exitText) && !/XP so far is saved/.test(exitText), 'the exit pop-up says nothing is saved');
  await page.locator('#exit-modal-exit').click(); await wait(page, 450);
  await closePopups(page);
  ok((await header(page)).h2 === '3RD GRADE', 'EXIT goes back to 3rd grade');
  await page.evaluate(() => renderHub()); await wait(page, 200);
  ok((await header(page)).h2 === '3RD GRADE' && await page.evaluate(() => !document.querySelector('.stat-pill')), 'renderHub() while just looking shows the grade, not a child\'s hub');
  ok(await saved(page) === snap, 'after the round the children\'s save is byte-identical');
  const w = await page.evaluate(n => __writes.slice(n), writes0);
  ok(w.length === 0, `no storage write at all while just looking${w.length ? ': ' + w.join(', ') : ''}`);
  // ← ALL GRADES: the page reloads to the title screen, at the grade row.
  await Promise.all([page.waitForNavigation(), page.locator('.hub-header .switch-btn').click()]);
  await wait(page, 600);
  const back = await page.evaluate(() => {
    const sec = document.querySelector('.title-grades').getBoundingClientRect();
    return { title: !!document.querySelector('.title-screen'), guest: guestMode, hash: location.hash,
      rowShown: sec.top < innerHeight && sec.bottom > 0,
      shown: Object.fromEntries(Object.keys(PROFILES).map(p => [p, { xp: state.profiles[p].xp, trophies: state.profiles[p].trophies.length }])),
      cards: [...document.querySelectorAll('.profile-card .profile-level-label')].map(e => e.textContent.trim()),
      parent: getComputedStyle(document.querySelector('.parent-link')).display !== 'none' };
  });
  ok(back.title && back.guest === false && back.hash === '', '← ALL GRADES reloads to the title screen, guest mode over');
  ok(back.rowShown, 'the title screen opens at the grade row');
  ok(JSON.stringify(back.shown) === JSON.stringify(shown0), `the same XP and trophies as before (${Object.entries(back.shown).map(([p, v]) => p + ' ' + v.xp + ' XP/' + v.trophies).join(', ')})`);
  ok(JSON.stringify(back.cards) === JSON.stringify(Object.values(shown0).map(v => v.xp + ' XP')), `the cards show ${back.cards.join(', ')}`);
  ok(await saved(page) === snap, 'and the save is still byte-identical');
  ok(back.parent, 'the parent link is back');
  await ctx.close();
}

// ─── 3. Keyboard only (laptop, no touch): Tab, Enter, Space, Esc ───
async function keyboard(browser, errors) {
  console.log('\n▶ keyboard only, laptop 1440x900');
  const vp = { name: 'laptop keyboard', width: 1440, height: 900 };
  const { ctx, page } = await open(browser, vp, errors);
  const focused = () => page.evaluate(() => { const a = document.activeElement; return a ? (a.dataset.grade ? 'grade-' + a.dataset.grade : a.className) : ''; });
  ok(await tabTo(page, () => document.activeElement && document.activeElement.dataset.grade === '1'), 'Tab reaches the 1st grade button');
  ok(await page.waitForTimeout(250).then(() => page.evaluate(() => { const a = document.activeElement, cs = getComputedStyle(a);
    return a.matches(':focus-visible') && cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2; })), 'it shows a focus ring');
  await page.keyboard.press('Enter'); await wait(page, 300);
  ok(await page.locator('#who-backdrop').count() === 1 && /who-modal/.test(await focused()), 'Enter opens the chooser, focus on the pop-up itself');
  await page.keyboard.press('Tab');
  ok(await page.evaluate(() => document.activeElement === document.querySelector('.who-kid')), 'Tab: the first child');
  await page.keyboard.press('Escape'); await wait(page, 300);
  // A doubled Enter on a grade opens the chooser and picks nobody.
  await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await wait(page, 300);
  ok(await page.locator('#who-backdrop').count() === 1 && await page.evaluate(() => currentProfile === null), 'a doubled Enter on a grade picks nobody');
  const trail = [];
  for (let i = 0; i < 5; i++) { await page.keyboard.press('Tab'); trail.push(await page.evaluate(() => !!document.activeElement.closest('#who-backdrop') && document.activeElement.className.split(' ')[0])); }
  ok(trail.every(Boolean) && trail.includes('who-guest') && trail.includes('who-close'), `Tab stays inside it (${trail.join(' → ')})`);
  await page.keyboard.press('Shift+Tab');
  ok(await page.evaluate(() => !!document.activeElement.closest('#who-backdrop')), 'and so does Shift+Tab');
  await page.keyboard.press('Escape'); await wait(page, 300);
  ok(await page.locator('#who-backdrop').count() === 0 && await focused() === 'grade-1', 'Esc closes it, focus back on 1st grade');
  await page.keyboard.press('Space'); await wait(page, 300);
  ok(await page.locator('#who-backdrop').count() === 1, 'Space opens it too');
  ok(await tabTo(page, () => document.activeElement.classList.contains('who-guest'), null, 8), 'Tab reaches Just looking');
  const snap = await saved(page);
  const writes0 = await page.evaluate(() => __writes.length);
  await page.keyboard.press('Enter'); await wait(page, 450);
  const h = await header(page);
  ok(h.h2 === '1ST GRADE' && /just looking/.test(h.p) && await page.evaluate(() => guestMode && currentProfile.id === 'k'), 'Enter: 1st grade, just looking, read as the kindergartener reads');
  try {
    ok(await tabTo(page, () => document.activeElement.classList.contains('pack-card')), 'Tab reaches a pack');
    const id = await page.evaluate(() => document.activeElement.getAttribute('onclick'));
    const seen = await playRound(page, 'keys', `.pack-card[onclick="${id}"]`);
    ok(seen.right >= 10, 'a whole round played with the keyboard only');
  } catch (e) { ok(false, 'the keyboard round: ' + e.message); }
  await closePopups(page);
  ok(await tabTo(page, () => /BACK TO PACKS/.test(document.activeElement.textContent)), 'Tab reaches BACK TO PACKS');
  await page.keyboard.press('Enter'); await wait(page, 450);
  ok((await header(page)).h2 === '1ST GRADE', 'Enter: back to 1st grade');
  ok(await tabTo(page, () => /ALL GRADES/.test(document.activeElement.textContent)), 'Tab reaches ← ALL GRADES');
  ok(await saved(page) === snap && (await page.evaluate(n => __writes.length - n, writes0)) === 0, 'nothing written while just looking');
  await Promise.all([page.waitForNavigation(), page.keyboard.press('Enter')]); await wait(page, 600);
  ok(await page.locator('.title-screen').count() === 1 && await focused() === 'grade-1', 'Enter: the title screen, focus back on 1st grade');
  ok(await saved(page) === snap, 'the children\'s save is byte-identical');
  await ctx.close();
}

// ─── 4. Touch, iPad portrait 820x1180 ───
async function touch(browser, errors) {
  console.log('\n▶ touch, iPad 820x1180');
  const vp = { name: 'iPad touch', width: 820, height: 1180, touch: true };
  const { ctx, page } = await open(browser, vp, errors);
  const k = page.locator('.title-grade[data-grade="K"]');
  // A quick double tap on a grade: the second tap lands on the pop-up (on
  // this screen, on the dimmed backdrop around it, which would close it; on
  // others, a child). It must change nothing: the pop-up stays, nobody picked.
  const g1 = page.locator('.title-grade[data-grade="1"]');
  await g1.evaluate(el => el.scrollIntoView({ block: 'center' }));
  await wait(page, 100);
  const b = await g1.boundingBox();
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await page.touchscreen.tap(x, y);
  await wait(page, 90);
  const under = await page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); return el ? el.className.split(' ')[0] : 'nothing'; }, [x, y]);
  await page.touchscreen.tap(x, y);
  await wait(page, 450);
  ok(under !== 'title-grade' && await page.locator('#who-backdrop').count() === 1 && await page.evaluate(() => currentProfile === null),
    `a double tap opens the chooser; the second tap (on .${under}) changes nothing`);
  await page.locator('.who-close').tap(); await wait(page, 450);
  ok(await page.locator('#who-backdrop').count() === 0, 'a tap on ✕ closes it');
  // A quick double tap on ✕, or outside the pop-up: the second tap lands on
  // the title screen (a child's card, here) and must change nothing.
  for (const where of ['✕', 'outside']) {
    await g1.evaluate(el => el.scrollIntoView({ block: 'center' })); await wait(page, 100);
    await g1.tap(); await wait(page, 450);
    // Outside: a spot on the dimmed backdrop with a card or a grade button under it.
    const [px, py] = await page.evaluate(w => {
      if (w === '✕') { const b = document.querySelector('.who-close').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }
      const m = document.querySelector('.who-modal').getBoundingClientRect();
      for (const el of document.querySelectorAll('.profile-card, .title-grade')) {
        const r = el.getBoundingClientRect();
        for (const y of [r.top + 12, r.bottom - 12]) {
          const x = r.left + r.width / 2;
          if (y > 0 && y < innerHeight && !(x >= m.left - 8 && x <= m.right + 8 && y >= m.top - 8 && y <= m.bottom + 8)) return [x, y];
        }
      }
      return [m.left + m.width / 2, Math.max(4, m.top - 16)];
    }, where);
    await page.touchscreen.tap(px, py); await wait(page, 90);
    const below = await page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); return el ? (el.closest('button, [role="button"]') || el).className.split(' ')[0] : 'nothing'; }, [px, py]);
    await page.touchscreen.tap(px, py); await wait(page, 450);
    ok(await page.locator('.title-screen').count() === 1 && await page.locator('#who-backdrop').count() === 0 && await page.evaluate(() => currentProfile === null),
      `a double tap ${where === '✕' ? 'on ✕' : 'outside the pop-up'} closes it; the second tap (on .${below}) changes nothing`);
    if (!(await page.locator('.title-screen').count()) || await page.locator('#who-backdrop').count()) {
      await page.evaluate(() => { closeWhoPlays(true); renderProfileSelect(); }); await wait(page, 300);   // carry on from the title screen
    }
  }
  await k.tap(); await wait(page, 450);
  await page.locator('.who-kid', { hasText: 'KINDERGARTEN' }).tap(); await wait(page, 450);
  let h = await header(page);
  ok(h.h2 === 'KINDERGARTEN' && /your grade/.test(h.p) && await page.evaluate(() => currentProfile.id === 'k' && !guestMode), 'tap the kindergartener: her own grade, as her');
  await page.evaluate(() => renderProfileSelect()); await wait(page, 300);
  const g5 = page.locator('.title-grade[data-grade="5"]');
  await g5.scrollIntoViewIfNeeded(); await g5.tap(); await wait(page, 450);
  const snap = await saved(page);
  const writes0 = await page.evaluate(() => __writes.length);
  await page.locator('.who-guest').tap(); await wait(page, 450);
  h = await header(page);
  ok(h.h2 === '5TH GRADE' && /just looking/.test(h.p), 'tap Just looking: 5th grade, nothing saved');
  try {
    const seen = await playRound(page, 'tap', '.pack-card', { mix: true });
    ok(seen.right + seen.wrong >= 10, 'a whole round played by touch');
  } catch (e) { ok(false, 'the touch round: ' + e.message); }
  await closePopups(page);
  await page.locator('.complete-nav', { hasText: 'BACK TO PACKS' }).tap(); await wait(page, 450);
  ok(await saved(page) === snap && (await page.evaluate(n => __writes.length - n, writes0)) === 0, 'nothing written while just looking');
  await Promise.all([page.waitForNavigation(), page.locator('.hub-header .switch-btn').tap()]); await wait(page, 600);
  ok(await page.locator('.title-screen').count() === 1 && await saved(page) === snap, 'tap ← ALL GRADES: the title screen, the save byte-identical');
  await page.screenshot({ path: path.join(OUT, 'back-at-the-row-ipad.png') });
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const errors = [];
  for (const part of [layout, mouse, keyboard, touch]) {
    try { await part(browser, errors); } catch (e) { ok(false, `${part.name}: ${e.message.split('\n')[0]}`); }
  }
  await browser.close();
  ok(errors.length === 0, `no JS errors${errors.length ? ': ' + [...new Set(errors)].slice(0, 5).join(' | ') : ''}`);
  console.log(bad ? `\ntitle-grades: FAIL — ${bad} of ${good + bad} checks failed`
    : `\ntitle-grades: PASS — ${good} checks: every grade on the title screen, a child or just looking, by mouse, keyboard and touch; nothing saved while just looking`);
  process.exit(bad ? 1 : 0);
})();
