// Sticker Book — end-to-end test.
//   node modules/stickers.test.js [app.html]
// On the game file (the repo's, $TT_APP, or the one named), with the sticker
// module and every other one built in: for the kindergartener (k) and the 5th
// grader (g5), on an iPad (820×1180, touch) and a laptop (1440×900, mouse +
// keyboard), plays real rounds and drives every path of the module. A 390px
// phone pass checks nothing overflows. Exits non-zero on any failure, page
// error, console error or swallowed module error. Screenshots go to
// tools/out/shots/stickers/.
const { chromium } = require('playwright');
const path = require('path');
const app = require('./app');

const HTML = app.APP;
// The suite is for the stickers module as the game file has it: without it, it fails.
if (!app.has('stickers')) { console.log('stickers: FAIL — the game file has no stickers module'); process.exit(1); }
const SHOTS = app.shots('stickers');
console.log('app: ' + HTML);

const failures = [];
let passes = 0;
function check(cond, msg) {
  if (cond) passes++; else failures.push(msg);
  console.log((cond ? '  ok   ' : '  FAIL ') + msg);
}

const sleep = (page, ms) => page.waitForTimeout(ms);

// Chromium's touch emulation reads two taps less than ~300ms apart as a
// double-tap and drops the second click, so taps are spaced like a person's.
let lastTap = 0;
async function tap(page, vp, loc) {
  await loc.scrollIntoViewIfNeeded();
  if (vp.touch) {
    const wait = 450 - (Date.now() - lastTap);
    if (wait > 0) await page.waitForTimeout(wait);
    await loc.tap();
    lastTap = Date.now();
  } else await loc.click();
}

async function newPage(browser, vp, opts) {
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h }, hasTouch: !!vp.touch, deviceScaleFactor: 1,
    reducedMotion: (opts && opts.reducedMotion) || 'no-preference',
  });
  await ctx.addInitScript(require('./together').quietBuddy);   // every module built in: see together.js
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    const url = (m.location() || {}).url || '';
    if (/fonts\.(googleapis|gstatic)\.com/.test(url)) return;   // web fonts are optional offline
    if (m.type() === 'error') errors.push('console.error: ' + m.text());
    // FUN swallows a module's exception with console.warn — that is a bug here.
    if (m.type() === 'warning' && /^\[fun\]/.test(m.text())) errors.push('module error: ' + m.text());
  });
  await page.goto('file://' + HTML);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
  await spies(page);
  return { ctx, page, errors };
}

// Record speech, sounds and events instead of making noise.
async function spies(page) {
  await page.evaluate(() => {
    window.__spoken = []; window.__sounds = []; window.__earned = []; window.__roundEnd = null;
    // Same event handling as the real speakText, minus the audio.
    window.speakText = function (t, evt) {
      if (evt) { evt.stopPropagation(); if (evt.stopImmediatePropagation) evt.stopImmediatePropagation(); evt.preventDefault(); }
      window.__spoken.push(String(t));
    };
    window.funSound = function (n) { window.__sounds.push(n); };
    FUN.on('stickerEarned', e => window.__earned.push(e));
    FUN.on('roundEnd', s => { window.__roundEnd = { score: s.score, total: s.total, perfect: s.perfect }; });
  });
}

const st = (page, pid) => page.evaluate(pid => {
  const s = (state.profiles[pid].fun || {}).stickers || {};
  return {
    owned: STICKERS.filter(x => (s.owned || {})[x.id]).length,
    ownedIds: Object.keys(s.owned || {}),
    shiny: Object.keys(s.shiny || {}).length,
    pending: (s.pending || []).length,
    unseen: (s.unseen || []).length,
    recent: (s.recent || []).length,
    trophies: state.profiles[pid].trophies.slice(),
  };
}, pid);

// Horizontal overflow anywhere, and tap-target sizes inside the module's UI.
async function layout(page, label, minTarget) {
  const issues = await page.evaluate(min => {
    const W = window.innerWidth, out = [];
    if (document.documentElement.scrollWidth > W + 1) out.push('document is ' + document.documentElement.scrollWidth + 'px wide');
    const app = document.getElementById('app');
    if (app.scrollWidth > app.clientWidth + 1) out.push('#app scrolls sideways (' + app.scrollWidth + ' > ' + app.clientWidth + ')');
    const shown = el => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      const b = el.getBoundingClientRect();
      return b.width > 0 && b.height > 0;
    };
    for (const el of document.querySelectorAll('[class*="stk-"]')) {
      if (el.closest('.stk-burst') || !shown(el)) continue;
      const b = el.getBoundingClientRect();
      if (b.left < -1 || b.right > W + 1) out.push('off-screen: .' + [...el.classList].join('.') + ' ' + Math.round(b.left) + '→' + Math.round(b.right));
    }
    const scopes = document.querySelectorAll('.stk-hubcard, .stk-book, .stk-reveal, .stk-overlay');
    const seen = new Set();
    for (const sc of scopes) {
      for (const el of [sc, ...sc.querySelectorAll('button, [role="button"]')]) {
        if (seen.has(el) || !el.matches('button, [role="button"]') || !shown(el)) continue;
        seen.add(el);
        const b = el.getBoundingClientRect();
        if (b.width < min - 0.5 || b.height < min - 0.5) {
          out.push(`small target ${Math.round(b.width)}×${Math.round(b.height)} (<${min}): ` + (el.getAttribute('aria-label') || el.textContent).trim().slice(0, 40));
        }
      }
    }
    return out;
  }, minTarget);
  check(issues.length === 0, `${label}: no overflow, targets ≥ ${minTarget}px` + (issues.length ? ' — ' + issues.slice(0, 5).join(' | ') : ''));
}

// Answer whatever question is showing, through the real UI.
async function answer(page, vp, makeWrong) {
  const q = await page.evaluate(() => {
    const q = questions[qIdx];
    return {
      type: q.type || 'mc', correct: q.correct, answer: q.answer, accepted: q.acceptedAnswers,
      n: (q.items || []).length, groups: (q.items || []).map(it => it && it.g),
      pa: q.partA && q.partA.correct, pb: q.partB && q.partB.correct, nOpt: (q.options || []).length,
    };
  });
  const T = sel => tap(page, vp, page.locator(sel).first());
  const done = async () => { await sleep(page, 350); return (await page.locator('#fb .next-btn').count()) > 0; };
  if (q.type === 'mc') {
    if (makeWrong) {
      await T(`.choice[data-idx="${q.correct === 0 ? 1 : 0}"]`);
      if (!(await done())) await T(`.choice[data-idx="${q.correct}"]`);
    } else await T(`.choice[data-idx="${q.correct}"]`);
  } else if (q.type === 'tf') {
    await T((makeWrong ? !q.answer : q.answer) ? '.true-btn' : '.false-btn');
  } else if (q.type === 'typed' || q.type === 'fib' || q.type === 'showwork') {
    if (q.type === 'showwork') await page.locator('#workDone').check();
    const enter = async v => {
      await page.evaluate(v => {
        const i = document.getElementById('typedInput');
        i.value = v; i.dispatchEvent(new Event('input', { bubbles: true }));
      }, v);
      await T('.typed-submit');
    };
    if (makeWrong) { await enter('987654'); if (!(await done())) await enter(String(q.accepted[0])); }
    else await enter(String(q.accepted[0]));
  } else if (q.type === 'order') {
    const seq = [...Array(q.n).keys()];
    for (const pos of makeWrong ? seq.slice().reverse() : seq) await T(`.order-item[onclick="orderPlace(${pos})"]`);
    await T('.puzzle-check');
    if (makeWrong && !(await done())) {
      for (let pos = 0; pos < q.n; pos++) {
        const locked = await page.locator('.order-slot').nth(pos).evaluate(el => el.classList.contains('locked'));
        if (!locked) await T(`.order-item[onclick="orderPlace(${pos})"]`);
      }
      await T('.puzzle-check');
    }
  } else if (q.type === 'sort') {
    const G = Math.max(...q.groups) + 1;
    for (let i = 0; i < q.n; i++) await T(`.sort-btn[onclick="sortAssign(${i},${makeWrong ? (q.groups[i] + 1) % G : q.groups[i]})"]`);
    await T('.puzzle-check');
    if (makeWrong && !(await done())) {
      for (let i = 0; i < q.n; i++) await T(`.sort-btn[onclick="sortAssign(${i},${q.groups[i]})"]`);
      await T('.puzzle-check');
    }
  } else if (q.type === 'multi') {
    const wrong = [...Array(q.nOpt).keys()].find(i => !q.correct.includes(i));
    const picks = makeWrong ? [wrong, ...q.correct.slice(1)] : q.correct;
    for (const c of picks) await T(`.multi-choice[onclick="multiToggle(${c})"]`);
    await T('.puzzle-check');
    if (makeWrong && !(await done())) {
      await T(`.multi-choice[onclick="multiToggle(${wrong})"]`);
      await T(`.multi-choice[onclick="multiToggle(${q.correct[0]})"]`);
      await T('.puzzle-check');
    }
  } else if (q.type === 'twopart') {
    await T(`.part-choice[data-part="A"][data-idx="${q.pa}"]`);
    await sleep(page, 250);
    await T(`.part-choice[data-part="B"][data-idx="${makeWrong ? (q.pb === 0 ? 1 : 0) : q.pb}"]`);
  } else {
    throw new Error('unknown question type ' + q.type);
  }
  await page.locator('#fb .next-btn').first().waitFor({ timeout: 4000 });
  await T('#fb .next-btn');
  return q.type;
}

// The app's own round: first pack card → LET'S GO → 10 answers → complete.
async function playRound(page, vp, wantMiss) {
  await tap(page, vp, page.locator('.pack-card').first());
  await page.locator('.briefing-go, .question-frame').first().waitFor({ timeout: 4000 });
  if (await page.locator('.briefing-go').count()) await tap(page, vp, page.locator('.briefing-go'));
  await page.locator('.question-frame').first().waitFor({ timeout: 4000 });
  const types = [];
  for (let n = 0; n < 14; n++) {
    if (await page.locator('.complete').count()) break;
    // Miss the first question of the round when asked to.
    types.push(await answer(page, vp, wantMiss && n === 0));
    await sleep(page, 150);
  }
  return types;
}

async function run(browser, vp, pid) {
  const tag = `${vp.name}-${pid}`;
  const min = pid === 'k' ? 56 : 44;
  let shotN = 0;
  const { ctx, page, errors } = await newPage(browser, vp);
  const shot = async (name, full) => page.screenshot({ path: path.join(SHOTS, `${tag}-${String(++shotN).padStart(2, '0')}-${name}.png`), fullPage: !!full });
  console.log(`\n── ${tag} (${vp.w}×${vp.h}${vp.touch ? ', touch' : ''}) ──`);

  // 1. Hub with an empty book.
  await tap(page, vp, page.locator('.profile-card').nth(pid === 'k' ? 0 : 2));
  await sleep(page, 250);
  const card = page.locator('.stk-hubcard');
  check(await card.count() === 1, `${tag}: hub shows the sticker book card`);
  check(/STICKER BOOK/.test(await card.innerText()) && /0\/48/.test(await card.innerText()), `${tag}: card reads STICKER BOOK 0/48`);
  check(await page.locator('.trophy', { hasText: 'FIRST STICKER' }).count() === 1, `${tag}: FIRST STICKER trophy listed`);
  if (pid === 'k') {
    check(await card.locator('.js-speak').count() === 1, `${tag}: card has a read-aloud button for the kindergartener`);
    await tap(page, vp, card.locator('.js-speak'));
    await sleep(page, 300);
    check(await page.evaluate(() => __spoken.some(t => /sticker book/i.test(t))) && await page.locator('.stk-book').count() === 0,
      `${tag}: 🔊 on the card reads it aloud without opening the book`);
  }
  await card.scrollIntoViewIfNeeded();
  await shot('hub-empty');
  await layout(page, `${tag} hub (empty)`, min);

  // 2. Empty book: 6 sets, 48 mystery slots.
  await tap(page, vp, card);
  await sleep(page, 250);
  check(await page.locator('.stk-book').count() === 1, `${tag}: tapping the card opens the book`);
  check(await page.locator('.stk-set').count() === 6, `${tag}: book has 6 sets`);
  check(await page.locator('.stk-slot').count() === 48 && await page.locator('.stk-slot.missing').count() === 48, `${tag}: 48 slots, all mystery`);
  check((await page.locator('.stk-set-count').allInnerTexts()).every(t => t.trim() === '0/8'), `${tag}: every set reads 0/8`);
  await sleep(page, 300);
  if (pid === 'k') check(await page.evaluate(() => __spoken.some(t => /sticker book/i.test(t))), `${tag}: empty book is read aloud (autoRead)`);
  await tap(page, vp, page.locator('.stk-slot.missing').nth(3));
  await sleep(page, 120);
  check(await page.locator('.stk-slot.missing.stk-shake').count() === 1, `${tag}: mystery slot wiggles when tapped`);
  check(await page.locator('.fun-toast', { hasText: 'Still hiding' }).count() === 1, `${tag}: mystery slot explains how to find it`);
  await shot('book-empty');
  await layout(page, `${tag} book (empty)`, min);
  await tap(page, vp, page.locator('.stk-back'));
  await sleep(page, 200);
  check(await page.locator('.hub').count() === 1, `${tag}: BACK returns to the hub`);

  // 3. A real round, all right → one sticker, plus a bonus if perfect.
  await page.evaluate(() => { __earned.length = 0; __sounds.length = 0; __spoken.length = 0; });
  const types = await playRound(page, vp, false);
  const rEnd = await page.evaluate(() => __roundEnd);
  check(await page.locator('.complete').count() === 1 && types.length === 10, `${tag}: normal round plays start to finish (${types.join(',')})`);
  const expect1 = 1 + (rEnd && rEnd.perfect ? 1 : 0);
  await sleep(page, 1700);
  // With every module built in another module can award a sticker for the same
  // round (all three daily missions done): it is revealed with this round's.
  const others = () => page.evaluate(own => __earned.filter(e => !own.includes(e.reason)).length, ['round', 'perfect']);
  const extra1 = await others();
  const all1 = expect1 + extra1, plus1 = extra1 ? ` + ${extra1} from another module` : '';
  check(rEnd && rEnd.perfect, `${tag}: all-right round counts as perfect (${rEnd && rEnd.score}/${rEnd && rEnd.total})`);
  check(await page.locator('.stk-reveal .stk-rcard').count() === all1, `${tag}: complete screen flips in ${expect1} NEW STICKER card(s)${plus1}`);
  check(/NEW STICKERS?!/.test(await page.locator('.stk-reveal-head').innerText()), `${tag}: reveal headline says NEW STICKER`);
  let s1 = await st(page, pid);
  check(s1.owned === all1 && s1.pending === 0, `${tag}: ${expect1} owned${plus1}, nothing left pending`);
  check(await page.evaluate(n => __earned.length === n && __earned.every(e => e.sticker && e.sticker.fact && !e.sticker.shiny), all1), `${tag}: stickerEarned emitted per sticker`);
  check(await page.evaluate(() => __sounds.includes('sticker')), `${tag}: sticker sound played`);
  check(s1.trophies.includes('stickers_first'), `${tag}: FIRST STICKER trophy awarded`);
  if (expect1 === 2) check(/PERFECT BONUS/.test(await page.locator('.stk-rcard').nth(1).innerText()), `${tag}: second card is the perfect-round bonus`);
  const firstName = (await page.locator('.stk-rcard-name').first().innerText()).trim();
  const spokenNew = await page.evaluate(() => __spoken.filter(t => t.startsWith('New sticker!')));
  if (pid === 'k') check(spokenNew.length === 1 && spokenNew[0].includes(firstName), `${tag}: autoRead says "New sticker! ${firstName}. …"`);
  else check(spokenNew.length === 0, `${tag}: no auto speech when autoRead is off`);
  await page.locator('.stk-reveal').scrollIntoViewIfNeeded();
  await shot('complete-reveal');
  await layout(page, `${tag} complete screen`, min);
  await page.evaluate(() => { __spoken.length = 0; __sounds.length = 0; });
  await tap(page, vp, page.locator('.stk-rcard .js-speak').first());
  check(await page.evaluate(n => __spoken.some(t => t.includes(n)), firstName), `${tag}: 🔊 on the card reads the sticker`);
  await tap(page, vp, page.locator('.stk-rcard .stk-big').first());
  check(await page.locator('.stk-rcard .stk-big.stk-wiggle').count() === 1 && await page.evaluate(() => __sounds.includes('sticker')), `${tag}: tapping the sticker makes it wiggle`);

  // 4. A round that is not perfect → exactly one sticker (real finishPack).
  await page.evaluate(() => { __earned.length = 0; });
  await tap(page, vp, page.locator('.next-btn', { hasText: 'BACK TO PACKS' }));
  await sleep(page, 250);
  await playRound(page, vp, true);
  await sleep(page, 1500);
  const rEnd2 = await page.evaluate(() => __roundEnd);
  check(rEnd2 && !rEnd2.perfect, `${tag}: round with a miss is not perfect`);
  const extra2 = await others();
  check(await page.locator('.stk-reveal .stk-rcard').count() === 1 + extra2, `${tag}: non-perfect round earns exactly 1 sticker${extra2 ? ` (+ ${extra2} from another module)` : ''}`);
  s1 = await st(page, pid);
  check(s1.owned === all1 + 1 + extra2 && new Set(s1.ownedIds).size === s1.owned, `${tag}: ${all1 + 1 + extra2} different stickers owned`);

  // 5. The book with stickers: NEW badges, detail overlay, ◀ ▶, close.
  await tap(page, vp, page.locator('.stk-open-btn'));
  await sleep(page, 250);
  const ownedN = s1.owned;
  check(await page.locator('.stk-slot.owned').count() === ownedN && await page.locator('.stk-slot.new').count() === ownedN, `${tag}: book shows ${ownedN} owned stickers, all marked NEW`);
  check((await st(page, pid)).unseen === 0, `${tag}: NEW badges are cleared after this visit`);
  const counts = await page.locator('.stk-set-count').allInnerTexts();
  check(counts.reduce((a, t) => a + Number(t.replace(/[^0-9/]/g, '').split('/')[0]), 0) === ownedN, `${tag}: set progress adds up (${counts.join(' ')})`);
  check(new RegExp(`${ownedN} of 48`, 'i').test(await page.locator('.stk-book-sub').innerText()), `${tag}: book header shows ${ownedN} of 48`);
  await shot('book-some');
  await shot('book-some-full', true);
  await layout(page, `${tag} book`, min);
  await page.evaluate(() => { __spoken.length = 0; });
  const slot = page.locator('.stk-slot.owned').first();
  const slotId = await slot.getAttribute('data-id');
  await tap(page, vp, slot);
  await sleep(page, 400);
  check(await page.locator('#stk-overlay .stk-detail').count() === 1, `${tag}: tapping an owned sticker opens its card`);
  const detail = await page.evaluate(id => ({ name: document.querySelector('.stk-detail-name').textContent.trim(), fact: document.querySelector('.stk-detail .stk-fact').textContent.trim(), want: STICKERS_BY_ID[id] }), slotId);
  check(detail.name === detail.want.name && detail.fact.includes(detail.want.fact), `${tag}: detail shows ${detail.want.name} and its fact`);
  check(await page.locator('.stk-detail .js-speak').count() === 1, `${tag}: detail has a 🔊 button`);
  if (pid === 'k') check(await page.evaluate(f => __spoken.some(t => t.includes(f)), detail.want.fact), `${tag}: detail fact is read aloud (autoRead)`);
  await shot('detail');
  await layout(page, `${tag} detail`, min);
  await tap(page, vp, page.locator('.stk-nav[aria-label="Next sticker"]'));
  await sleep(page, 200);
  const name2 = (await page.locator('.stk-detail-name').innerText()).trim();
  check(name2 !== detail.name, `${tag}: ▶ moves to the next sticker (${name2})`);
  if (vp.touch) await tap(page, vp, page.locator('.stk-close'));
  else await page.keyboard.press('Escape');
  await sleep(page, 150);
  check(await page.locator('#stk-overlay').count() === 0, `${tag}: detail closes (${vp.touch ? '✕' : 'Escape'})`);

  // 6. Award from another module while on the hub → pop-up, card refreshes.
  await tap(page, vp, page.locator('.stk-back'));
  await sleep(page, 300);
  await page.evaluate(pid => { __earned.length = 0; FUN.emit('awardSticker', { profileId: pid, reason: 'Daily missions' }); }, pid);
  await sleep(page, 1500);
  check(await page.locator('#stk-overlay .stk-rcard').count() === 1, `${tag}: awardSticker on the hub pops up a NEW STICKER card`);
  check(/DAILY MISSIONS/.test(await page.locator('#stk-overlay .stk-rcard-tag').innerText()), `${tag}: pop-up says why it was earned`);
  check(new RegExp(`${ownedN + 1}/48`).test(await page.locator('.stk-hubcard .fun-card-badge').innerText()), `${tag}: hub card updates to ${ownedN + 1}/48 in place`);
  check(await page.locator('.stk-hubcard .stk-hub-st').count() === 3, `${tag}: hub card shows the last 3 stickers`);
  await shot('popup');
  await layout(page, `${tag} pop-up`, min);
  await tap(page, vp, page.locator('.stk-ok'));
  await sleep(page, 150);
  check(await page.locator('#stk-overlay').count() === 0, `${tag}: AWESOME closes the pop-up`);
  await shot('hub-after');

  // 7. Award mid-round → held for the round-complete card, not a pop-up.
  await tap(page, vp, page.locator('.pack-card').first());
  await sleep(page, 200);
  await page.evaluate(pid => FUN.emit('awardSticker', { profileId: pid, reason: 'Boss defeated' }), pid);
  await sleep(page, 500);
  check(await page.locator('#stk-overlay').count() === 0 && (await st(page, pid)).pending === 1, `${tag}: mid-round sticker waits for the end of the round`);
  check(await page.locator('.fun-toast', { hasText: 'STICKER EARNED' }).count() === 1, `${tag}: mid-round toast promises the reveal`);
  await page.evaluate(() => { __earned.length = 0; qIdx = questions.length - 1; score = 4; finishPack(); });
  await sleep(page, 1500);
  const tags = await page.locator('.stk-reveal .stk-rcard-tag').allInnerTexts();
  const extra7 = await page.evaluate(() => __earned.filter(e => e.reason !== 'round').length);
  check(tags.length === 2 + extra7 && tags.some(t => /BOSS DEFEATED/.test(t)) && tags.some(t => /ROUND DONE/.test(t)), `${tag}: complete screen reveals the held sticker + the round's (${tags.join(' / ')})`);
  check((await st(page, pid)).pending === 0, `${tag}: pending list is empty after the reveal`);
  await page.locator('.stk-reveal').scrollIntoViewIfNeeded();
  await shot('complete-two');
  await layout(page, `${tag} complete (two)`, min);

  // 8. Completing a set → toast, confetti, SET COLLECTOR.
  await page.evaluate(() => renderHub());
  await sleep(page, 200);
  await page.evaluate(pid => {
    const s = stickersStore(pid);
    s.owned = {}; s.setsDone = {}; s.shiny = {};
    STICKERS.filter(x => x.set === 'bay' && x.id !== 'bay_grass').forEach(x => { s.owned[x.id] = Date.now(); });
    saveState();
    window.__rnd = Math.random; Math.random = () => 0;
    FUN.emit('awardSticker', { profileId: pid, reason: 'test' });
    Math.random = window.__rnd;
  }, pid);
  await sleep(page, 1500);
  check(await page.locator('#stk-overlay .stk-rcard-name', { hasText: 'Bay Grass' }).count() === 1, `${tag}: last missing Bay sticker is awarded`);
  check(await page.locator('#stk-overlay .stk-setdone').count() === 1, `${tag}: card says SET COMPLETE`);
  check(await page.locator('.fun-toast', { hasText: 'SET COMPLETE' }).count() === 1, `${tag}: set-complete toast`);
  check(await page.locator('.fun-confetti').count() >= 1, `${tag}: set-complete confetti`);
  check((await st(page, pid)).trophies.includes('stickers_set'), `${tag}: SET COLLECTOR trophy awarded`);
  await shot('set-complete');
  await tap(page, vp, page.locator('.stk-ok'));

  // 9. Filling the book → COMPLETE BOOK; after that, shinies.
  await page.evaluate(pid => {
    const s = stickersStore(pid);
    STICKERS.forEach(x => { if (x.id !== 'tp_hatter') s.owned[x.id] = s.owned[x.id] || Date.now(); });
    saveState();
    __earned.length = 0;
    FUN.emit('awardSticker', { profileId: pid, reason: 'test' });
  }, pid);
  await sleep(page, 1500);
  check((await st(page, pid)).owned === 48, `${tag}: all 48 owned`);
  check(await page.locator('#stk-overlay .stk-setdone.gold').count() === 1, `${tag}: card says WHOLE BOOK COMPLETE`);
  check((await st(page, pid)).trophies.includes('stickers_book'), `${tag}: COMPLETE BOOK trophy awarded`);
  await tap(page, vp, page.locator('.stk-ok'));
  await sleep(page, 150);
  await page.evaluate(pid => { __earned.length = 0; FUN.emit('awardSticker', { profileId: pid, reason: 'test' }); }, pid);
  await sleep(page, 1500);
  const s9 = await st(page, pid);
  check(s9.owned === 48 && s9.shiny === 1, `${tag}: a full book earns a ✨ shiny instead`);
  check(await page.evaluate(() => __earned.length === 1 && __earned[0].sticker.shiny === true), `${tag}: stickerEarned marks it shiny`);
  check(/SHINY/.test(await page.locator('#stk-overlay .stk-reveal-head').innerText()), `${tag}: pop-up headline says SHINY`);
  await shot('shiny-popup');
  await tap(page, vp, page.locator('#stk-overlay .stk-btn', { hasText: 'SEE MY BOOK' }));
  await sleep(page, 300);
  check(await page.locator('#stk-overlay').count() === 0 && await page.locator('.stk-book').count() === 1, `${tag}: SEE MY BOOK closes the pop-up and opens the book`);
  check(await page.locator('.stk-slot.missing').count() === 0 && await page.locator('.stk-slot.stk-shiny').count() === 1, `${tag}: full book with one shiny`);
  check(/Book complete/.test(await page.locator('.stk-book-tip').innerText()), `${tag}: book says it is complete`);
  check((await page.locator('.stk-set-count').allInnerTexts()).every(t => /8\/8/.test(t)), `${tag}: every set reads 8/8`);
  await shot('book-full');
  await shot('book-full-whole', true);
  await layout(page, `${tag} full book`, min);
  // the shiny one opens with its shine
  await tap(page, vp, page.locator('.stk-slot.stk-shiny').first());
  await sleep(page, 400);
  check(await page.locator('.stk-detail.stk-shiny').count() === 1, `${tag}: shiny sticker card shines`);
  await shot('detail-shiny');
  await layout(page, `${tag} shiny detail`, min);
  await tap(page, vp, page.locator('.stk-close'));

  // 10. Keyboard (laptop): Enter on the card, Enter on a sticker, arrows, Escape.
  if (!vp.touch) {
    await page.evaluate(() => renderHub());
    await sleep(page, 200);
    await page.locator('.stk-hubcard').focus();
    await page.keyboard.press('Enter');
    await sleep(page, 200);
    check(await page.locator('.stk-book').count() === 1, `${tag}: Enter on the hub card opens the book`);
    await page.locator('.stk-slot.owned').nth(2).focus();
    await page.keyboard.press(' ');
    await sleep(page, 250);
    const a = (await page.locator('.stk-detail-name').innerText()).trim();
    await page.keyboard.press('ArrowRight');
    await sleep(page, 150);
    const b = (await page.locator('.stk-detail-name').innerText()).trim();
    check(a !== b, `${tag}: Space opens a sticker, → steps to the next (${a} → ${b})`);
    const focusInDialog = await page.evaluate(() => document.getElementById('stk-overlay').contains(document.activeElement));
    await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
    check(focusInDialog && await page.evaluate(() => document.getElementById('stk-overlay').contains(document.activeElement)), `${tag}: focus stays inside the sticker card`);
    await page.keyboard.press('Escape');
    await sleep(page, 150);
    check(await page.locator('#stk-overlay').count() === 0, `${tag}: Escape closes the sticker card`);
  }

  // 11. Saved: the book round-trips through the app's own saveState/loadState.
  // (APP BUG, not this module: on page load `let state = loadState()` runs
  // before `const PROFILE_MIGRATIONS` is initialised, so loadState throws,
  // its catch returns a fresh state, and ALL progress is dropped on reload.
  // The test therefore checks what is stored, and what loadState() returns
  // once the script has finished loading, then continues on that state.)
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
  await spies(page);
  const stored = await page.evaluate(pid => {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const s = raw.profiles[pid].fun.stickers;
    const loaded = loadState().profiles[pid].fun.stickers;
    const appKept = !!(state.profiles[pid].fun && state.profiles[pid].fun.stickers);
    state = loadState();
    return { owned: Object.keys(s.owned).length, shiny: Object.keys(s.shiny).length, loaded: Object.keys(loaded.owned).length, appKept };
  }, pid);
  check(stored.owned === 48 && stored.shiny === 1 && stored.loaded === 48, `${tag}: sticker book is saved and loads back (48 + 1 shiny)`);
  if (!stored.appKept) console.log(`  NOTE ${tag}: the app itself dropped saved progress on reload (load-order bug in the app, not this module)`);
  await page.evaluate(() => {
    state.profiles.g3.fun = { stickers: { owned: ['not', 'an', 'object'], recent: 'bad', pending: [{ id: 'nope' }, null], unseen: null, shiny: 7 } };
    saveState();
  });
  await tap(page, vp, page.locator('.profile-card').nth(1));
  await sleep(page, 600);
  check(/0\/48/.test(await page.locator('.stk-hubcard').innerText()) && await page.locator('#stk-overlay').count() === 0, `${tag}: broken old data reads as an empty book`);
  await page.evaluate(() => { delete state.profiles.g3.fun; renderHub(); });
  check(/0\/48/.test(await page.locator('.stk-hubcard').innerText()), `${tag}: a child who never saw stickers gets an empty book`);

  // 12. Parent dashboard lists every child's book.
  await page.evaluate(() => renderParentDash());
  await sleep(page, 200);
  const parent = await page.locator('.stk-parent').innerText();
  check(/Sticker Books/.test(parent) && /48\/48 stickers/.test(parent) && /0\/48 stickers/.test(parent), `${tag}: parent dashboard shows sticker counts`);
  if (pid === 'k' && vp.touch) {
    await page.locator('.stk-parent').scrollIntoViewIfNeeded();
    await shot('parent');
  }

  check(errors.length === 0, `${tag}: no page/console/module errors` + (errors.length ? ' — ' + errors.slice(0, 4).join(' | ') : ''));
  await ctx.close();
}

// A 390px phone and reduced motion: nothing overflows, nothing breaks.
async function runPhone(browser) {
  const vp = { name: 'phone', w: 390, h: 844, touch: true };
  const tag = 'phone-k';
  const { ctx, page, errors } = await newPage(browser, vp, { reducedMotion: 'reduce' });
  console.log(`\n── ${tag} (390×844, touch, reduced motion) ──`);
  const shot = async name => page.screenshot({ path: path.join(SHOTS, `${tag}-${name}.png`) });
  await tap(page, vp, page.locator('.profile-card').nth(0));
  await sleep(page, 250);
  await page.evaluate(() => {
    const s = stickersStore('k');
    STICKERS.slice(0, 20).forEach(x => { s.owned[x.id] = Date.now(); s.recent.push({ id: x.id, shiny: false }); });
    s.unseen = ['bay_crab', 'md_flag'];
    saveState(); renderHub();
  });
  await page.locator('.stk-hubcard').scrollIntoViewIfNeeded();
  await shot('01-hub');
  await layout(page, `${tag} hub`, 56);
  await tap(page, vp, page.locator('.stk-hubcard'));
  await sleep(page, 250);
  await shot('02-book');
  await layout(page, `${tag} book`, 56);
  await tap(page, vp, page.locator('.stk-slot[data-id="md_flag"]'));
  await sleep(page, 300);
  await shot('03-detail-flag');
  await layout(page, `${tag} detail`, 56);
  await tap(page, vp, page.locator('.stk-close'));
  await tap(page, vp, page.locator('.stk-back'));
  await sleep(page, 300);
  await page.evaluate(() => { FUN.emit('awardSticker', { profileId: 'k', reason: 'Family goal reached' }); FUN.emit('awardSticker', { profileId: 'k', reason: 'Sprint record' }); });
  await sleep(page, 400);
  check(await page.locator('#stk-overlay .stk-rcard').count() === 2, `${tag}: two quick awards share one pop-up`);
  check(await page.evaluate(() => getComputedStyle(document.querySelector('.stk-rcard')).opacity === '1'), `${tag}: reduced motion shows the card immediately`);
  check(await page.locator('.fun-confetti').count() === 0, `${tag}: no confetti with reduced motion`);
  await shot('04-popup-two');
  await layout(page, `${tag} pop-up`, 56);
  await tap(page, vp, page.locator('.stk-ok'));
  // round-complete card at phone width
  await tap(page, vp, page.locator('.pack-card').first());
  await sleep(page, 200);
  await page.evaluate(() => { qIdx = questions.length - 1; score = questions.length; finishPack(); });
  await sleep(page, 500);
  await page.locator('.stk-reveal').scrollIntoViewIfNeeded();
  await shot('05-complete');
  await layout(page, `${tag} complete`, 56);
  check(errors.length === 0, `${tag}: no page/console/module errors` + (errors.length ? ' — ' + errors.slice(0, 4).join(' | ') : ''));
  await ctx.close();
}

// Catalogue sanity: 48 unique stickers, 6 sets of 8, a fact on each.
async function catalogue(browser) {
  const { ctx, page, errors } = await newPage(browser, { w: 800, h: 600 });
  const c = await page.evaluate(() => ({
    n: STICKERS.length, ids: new Set(STICKERS.map(s => s.id)).size, sets: STICKERS_SETS.map(st => STICKERS.filter(s => s.set === st.id).length),
    bad: STICKERS.filter(s => !s.id || !s.emoji || !s.name || !s.fact || s.fact.length > 140 || !STICKERS_SET_BY_ID[s.set]).map(s => s.id),
    trophies: ['stickers_first', 'stickers_set', 'stickers_book'].every(id => TROPHIES.some(t => t.id === id)),
    names: STICKERS.map(s => s.name),
  }));
  console.log('\n── catalogue ──');
  check(c.n === 48 && c.ids === 48, 'catalogue: 48 stickers, unique ids');
  check(c.sets.length === 6 && c.sets.every(n => n === 8), 'catalogue: 6 sets of 8 (' + c.sets.join(',') + ')');
  check(c.bad.length === 0, 'catalogue: every sticker has an emoji, name and a short fact' + (c.bad.length ? ' — ' + c.bad.join(',') : ''));
  check(c.trophies, 'catalogue: three sticker trophies registered');
  for (const want of ['Blue Crab', 'Diamondback Terrapin', 'Osprey', 'Oyster', 'Skipjack', 'Great Blue Heron', 'Bay Grass', 'Baltimore Oriole', 'Black-Eyed Susan', 'Fort McHenry', 'State House in Annapolis', 'Maryland Flag', 'Smith Island Cake', 'Baseball', 'Wrestling']) {
    if (!c.names.includes(want)) check(false, 'catalogue: has ' + want);
  }
  check(errors.length === 0, 'catalogue: no errors on load' + (errors.length ? ' — ' + errors.join(' | ') : ''));
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ executablePath: app.CHROMIUM });
  try {
    await catalogue(browser);
    for (const vp of [{ name: 'ipad', w: 820, h: 1180, touch: true }, { name: 'laptop', w: 1440, h: 900, touch: false }]) {
      for (const pid of ['k', 'g5']) await run(browser, vp, pid);
    }
    await runPhone(browser);
  } catch (e) {
    failures.push('crashed: ' + (e && e.stack || e));
    console.log('  FAIL crashed: ' + (e && e.stack || e));
  } finally {
    await browser.close();
  }
  console.log(`\nscreenshots: tools/${path.relative(app.TOOLS, SHOTS)}/`);
  if (failures.length) {
    console.log('\nfailures:');
    failures.forEach(f => console.log('  - ' + f));
    console.log(`stickers: FAIL — ${passes} checks passed, ${failures.length} failed`);
    process.exit(1);
  }
  console.log(`\nstickers: PASS — ${passes} checks passed, 0 failed`);
})();
