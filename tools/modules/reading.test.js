// Reading Road — end-to-end test.
//   node modules/reading.test.js [app.html]          every run (about 6 minutes)
//   node modules/reading.test.js [app.html] --quick  one iPad-touch and one
//                                                    laptop-keyboard run per child
//
// The game file (the repo's, $TT_APP, or the one named) has the road built in:
// the reading module, and its content as READING_ROAD in the reading-data
// module. The runs below play two small sample lands (fixtures/sample-*.json,
// which must pass readcheck first), so from the game file it derives, in
// tools/out/builds/ (the game file itself is never written):
//   reading-sample.html    READING_ROAD replaced by the sample lands
//   reading-reversed.html  the sample data AFTER the reading module
//   reading-nodata.html    the reading module with no reading-data at all
// and the real content is checked on the game file itself.
//
// For the kindergartener (k) and the 5th grader (g5), at 820×1180 (iPad
// portrait) and 1440×900 (laptop), three ways each — touch (locator.tap,
// hasTouch), mouse (click, no touch) and keyboard only (Tab / Enter / Space /
// arrows / Esc / answer keys) — it opens the road from the hub, plays a whole
// stop (learn cards → story with tapped words and read-to-me → the round →
// the complete screen → stars → back on the map with the next stop open),
// leaves a round half way, finishes a land (sticker, trophy flag), uses the
// parent controls, reloads to prove the progress is saved, and plays a normal
// non-road round. Extra passes: placement for k/g3/g5, star maths, broken
// saved data, a 390px phone, file order, no data, and every stop of the real
// content rendered. Fails on any page error, console error or swallowed
// module error, any horizontal overflow, or a module target under 44px
// (56px for the kindergartener). Screenshots: tools/out/shots/reading/.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const app = require('./app');

const QUICK = app.args.includes('--quick');
console.log('app: ' + app.APP);

// ─── Builds, derived from the game file ───
if (!app.has('reading')) { console.log('reading: FAIL — the game file has no reading module'); process.exit(1); }
const SAMPLES = ['sample-1.json', 'sample-2.json'].map(f => path.join(__dirname, 'fixtures', f));
try { execFileSync(process.execPath, [path.join(__dirname, 'readcheck.js'), ...SAMPLES], { stdio: 'inherit' }); }
catch (e) { console.log('reading: FAIL — the sample lands do not pass readcheck'); process.exit(1); }
const sampleData = () => app.module('reading-data', app.roadData(SAMPLES));
const isData = m => m.name === 'reading-data';
// The sample lands in place of the real content, where the content sits.
const HTML = app.variant('reading-sample', mods =>
  mods.some(isData) ? mods.map(m => isData(m) ? sampleData() : m)
    : mods.flatMap(m => m.name === 'reading' ? [sampleData(), m] : [m]));
// The same data AFTER the reading module.
const HTML_REVERSED = app.variant('reading-reversed', mods =>
  mods.filter(m => !isData(m)).flatMap(m => m.name === 'reading' ? [m, sampleData()] : [m]));
// The reading module with no road data at all.
const HTML_NODATA = app.variant('reading-nodata', mods => mods.filter(m => !isData(m)));
// The real content: the game file itself.
const HAVE_REAL = app.has('reading-data');
const HTML_REAL = app.APP;
const SHOTS = app.shots('reading');

// The sample road, as the test expects to find it.
const LANDS = SAMPLES.map(f => JSON.parse(fs.readFileSync(f, 'utf8'))).sort((a, b) => a.order - b.order);
const STOPS = [];
LANDS.forEach(l => l.stops.forEach((s, i) => STOPS.push(Object.assign({}, s, { land: l, n: i + 1 }))));
const STOP = id => STOPS.find(s => s.id === id);
const FIRST = { k: LANDS[0].stops[0].id, g3: LANDS[1].stops[0].id, g5: LANDS[1].stops[0].id };
const NEXT = { k: LANDS[0].stops[1].id, g5: LANDS[1].stops[1].id };

// ─── Results ───
let passes = 0;
const failures = [];
function mkCheck(log) {
  return (cond, msg) => {
    if (cond) passes++; else failures.push(msg);
    log.push((cond ? '  ok   ' : '  FAIL ') + msg);
    return !!cond;
  };
}

// ─── Pages ───
async function newPage(browser, vp, file) {
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h }, hasTouch: vp.input === 'touch', deviceScaleFactor: 1,
    reducedMotion: 'no-preference',
  });
  await ctx.addInitScript(require('./together').quietBuddy);   // every module built in: see together.js
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    const url = (m.location() || {}).url || '';
    if (/fonts\.(googleapis|gstatic)\.com/.test(url)) return;   // web fonts are optional offline
    if (m.type() === 'error') errors.push('console.error: ' + m.text());
    if (m.type() === 'warning' && /^\[fun\]/.test(m.text())) errors.push('module error: ' + m.text());
  });
  page.on('dialog', d => d.type() === 'prompt' ? d.accept('0000') : d.accept());
  await page.goto('file://' + (file || HTML));
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
  await spies(page);
  return { ctx, page, errors };
}

// Speech, sounds and events are recorded instead of played.
async function spies(page) {
  await page.evaluate(() => {
    window.__spoken = []; window.__sounds = []; window.__ev = [];
    window.speakText = function (t, evt) {
      if (evt) { evt.stopPropagation(); if (evt.stopImmediatePropagation) evt.stopImmediatePropagation(); evt.preventDefault(); }
      window.__spoken.push(String(t));
    };
    window.funSound = function (n) { window.__sounds.push(n); };
    for (const n of ['readingStop', 'readingLand', 'awardSticker', 'roundEnd', 'roundExit']) {
      FUN.on(n, e => window.__ev.push({
        n, pid: e.profileId, stars: e.stars, best: e.best, firstTime: e.firstTime, stop: e.stop && e.stop.id,
        land: e.land && e.land.id, reason: e.reason, score: e.score, total: e.total, fixed: e.fixed, pack: e.pack && e.pack.id,
      }));
    }
  });
}
const store = (page, pid) => page.evaluate(pid => {
  const f = state.profiles[pid].fun;
  return f && f.reading ? JSON.parse(JSON.stringify(f.reading)) : null;
}, pid);
const spoken = page => page.evaluate(() => window.__spoken.slice());
const sounds = page => page.evaluate(() => window.__sounds.slice());
const events = page => page.evaluate(() => window.__ev.slice());
const clearRec = page => page.evaluate(() => { window.__spoken.length = 0; window.__sounds.length = 0; window.__ev.length = 0; });

// ─── Input: one tap, one click, or focus + a key ───
async function press(R, loc, key) {
  loc = loc.first();
  await loc.waitFor({ state: 'visible', timeout: 6000 });
  if (R.vp.input === 'keys') {
    await loc.focus();
    await R.page.keyboard.press(key || 'Enter');
  } else {
    await loc.scrollIntoViewIfNeeded();
    if (R.vp.input === 'touch') {
      // Chromium reads two taps < ~300ms apart as a double-tap; space them like a person.
      const wait = 430 - (Date.now() - R.lastTap);
      if (wait > 0) await R.page.waitForTimeout(wait);
      await loc.tap();
      R.lastTap = Date.now();
    } else {
      const wait = 430 - (Date.now() - R.lastTap);
      if (wait > 0) await R.page.waitForTimeout(wait);
      await loc.click();
      R.lastTap = Date.now();
    }
  }
  await R.page.waitForTimeout(90);
}
// The road card itself, not its GO ▶ button (which skips the map). A tap or
// click goes on the card's title row: in a play zone shared with other
// modules the row of cards is as tall as the tallest, and the stretched
// card's middle is its GO ▶ button. The keyboard focuses the card.
const hubCard = R => R.page.locator(R.vp.input === 'keys' ? '.reading-hubcard' : '.reading-hubcard .fun-card-top');
// Keyboard only: Tab (or Shift+Tab) until the focused element passes the test.
async function tabTo(R, test, arg, shift, max) {
  for (let i = 0; i < (max || 40); i++) {
    await R.page.keyboard.press(shift ? 'Shift+Tab' : 'Tab');
    if (await R.page.evaluate(test, arg)) return true;
  }
  return false;
}
const focused = (page, sel) => page.evaluate(sel => !!document.activeElement && document.activeElement.matches(sel), sel);

// Horizontal overflow anywhere; tap targets in the module's own UI.
async function layout(R, label) {
  const r = await R.page.evaluate(min => {
    const W = document.documentElement.clientWidth;
    const vis = el => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      const b = el.getBoundingClientRect();
      return b.width > 0 && b.height > 0;
    };
    const desc = el => el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '') +
      ' "' + (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 26) + '"';
    const transient = el => el.closest('.fun-confetti, .fun-toast, .trophy-pop, .xp-pop, .streak-pop');
    const over = [];
    for (const el of document.querySelectorAll('body *')) {
      if (transient(el) || !vis(el)) continue;
      const b = el.getBoundingClientRect();
      if (b.right > W + 1 || b.left < -1) over.push(desc(el) + ` [${Math.round(b.left)}..${Math.round(b.right)} of ${W}]`);
    }
    const small = [];
    let mine = 0;
    for (const el of document.querySelectorAll('.reading-scope, .reading-parent')) {
      for (const b of [el, ...el.querySelectorAll('button, [role="button"], select')]) {
        if (!b.matches('button, [role="button"], select') || !vis(b) || transient(b)) continue;
        mine++;
        const need = b.closest('.reading-parent') ? 44 : min;   // the parent page is for adults
        const r = b.getBoundingClientRect();
        if (r.width < need - 0.5 || r.height < need - 0.5) small.push(`${desc(b)} ${Math.round(r.width)}×${Math.round(r.height)} (<${need})`);
      }
    }
    const app = document.getElementById('app');
    return { over, small, mine, docOver: document.documentElement.scrollWidth > W + 1, appOver: app.scrollWidth > app.clientWidth + 1 };
  }, R.pid === 'k' ? 56 : 44);
  R.check(!r.docOver && !r.appOver && r.over.length === 0, `${R.tag} ${label}: no horizontal overflow` + (r.over.length ? ' — ' + r.over.slice(0, 4).join(' | ') : ''));
  R.check(r.small.length === 0, `${R.tag} ${label}: ${r.mine} module targets all ≥ ${R.pid === 'k' ? 56 : 44}px` + (r.small.length ? ' — ' + r.small.slice(0, 4).join(' | ') : ''));
}
async function shot(R, name, full) {
  await R.page.screenshot({ path: path.join(SHOTS, `${R.tag}-${String(++R.shotN).padStart(2, '0')}-${name}.png`), fullPage: !!full });
}

// ─── The game's own round: answer whatever is showing ───
async function answerQ(R, wrongFirst) {
  const { page } = R;
  const keys = R.vp.input === 'keys';
  const q = await page.evaluate(() => {
    const q = questions[qIdx];
    return {
      type: q.type || 'mc', correct: q.correct, answer: q.answer, accepted: q.acceptedAnswers,
      n: (q.items || []).length, groups: (q.items || []).map(it => it && it.g), pa: q.partA && q.partA.correct,
      pb: q.partB && q.partB.correct, nOpt: (q.options || []).length, passage: !!q.passage, show: q.show || null,
      from: q._from || null, review: q._readingReview || null, idx: qIdx, total: questions.length,
    };
  });
  q.dom = await page.evaluate(() => ({
    passage: !!document.querySelector('.question-frame .passage .reading-passage'),
    passageVoice: !!document.querySelector('.question-frame .passage .passage-voice .js-speak'),
    show: (document.querySelector('.show-card') || {}).textContent || null,
    tag: (document.querySelector('.question-tag') || {}).textContent || '',
    choiceVoices: document.querySelectorAll('.choice .js-speak').length,
    pics: document.querySelectorAll('.question-frame .reading-pic').length,
  }));
  const P = sel => press(R, page.locator(sel));
  const answered = async () => { await page.waitForTimeout(320); return (await page.locator('#fb .next-btn').count()) > 0; };
  if (q.type === 'mc') {
    const pick = async i => { if (keys) { await page.keyboard.press(String(i + 1)); await page.waitForTimeout(90); } else await P(`.choice[data-idx="${i}"]`); };
    if (wrongFirst) { await pick(q.correct === 0 ? 1 : 0); if (!(await answered())) await pick(q.correct); }
    else await pick(q.correct);
  } else if (q.type === 'tf') {
    if (keys) await page.keyboard.press(q.answer ? 't' : 'f');
    else await P(q.answer ? '.true-btn' : '.false-btn');
  } else if (q.type === 'typed' || q.type === 'fib' || q.type === 'showwork') {
    const ans = String(q.accepted[0]);
    if (q.type === 'showwork') {
      if (keys) { await page.locator('#workDone').focus(); await page.keyboard.press(' '); }
      else await page.locator('#workDone').check();
    }
    const pad = await page.evaluate(() => { const i = document.getElementById('typedInput'); return !!i && i.readOnly; });
    if (keys) {
      await page.locator('#typedInput').focus();
      await page.keyboard.type(ans);           // the number pad takes the same keys
      if (pad) await P('.typed-submit'); else await page.keyboard.press('Enter');
    } else {
      await page.evaluate(v => { const i = document.getElementById('typedInput'); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }, ans);
      await P('.typed-submit');
    }
  } else if (q.type === 'order') {
    for (let pos = 0; pos < q.n; pos++) await P(`.order-item[onclick="orderPlace(${pos})"]`);
    await P('.puzzle-check');
  } else if (q.type === 'sort') {
    for (let i = 0; i < q.n; i++) await press(R, page.locator(`.sort-btn[onclick="sortAssign(${i},${q.groups[i]})"]`), ' ');
    await P('.puzzle-check');
  } else if (q.type === 'multi') {
    for (const c of q.correct) {
      if (keys) { await page.keyboard.press(String(c + 1)); await page.waitForTimeout(90); } else await P(`.multi-choice[onclick="multiToggle(${c})"]`);
    }
    await P('.puzzle-check');
  } else if (q.type === 'twopart') {
    if (keys) await page.keyboard.press(String(q.pa + 1)); else await P(`.part-choice[data-part="A"][data-idx="${q.pa}"]`);
    await page.waitForTimeout(300);
    if (keys) await page.keyboard.press(String(q.pb + 1)); else await P(`.part-choice[data-part="B"][data-idx="${q.pb}"]`);
  } else throw new Error('unknown question type ' + q.type);
  await page.locator('#fb .next-btn').first().waitFor({ timeout: 5000 });
  if (keys) { await page.waitForTimeout(80); await page.keyboard.press('Enter'); }
  else await P('#fb .next-btn');
  await page.waitForTimeout(120);
  return q;
}
// From the briefing to the complete screen. wrongFirst: miss the first mc once.
async function playRound(R, wrongFirst) {
  const { page } = R;
  await page.locator('.briefing-go').waitFor({ timeout: 5000 });
  if (R.vp.input === 'keys') await page.keyboard.press('Enter'); else await press(R, page.locator('.briefing-go'));
  await page.locator('.question-frame').first().waitFor({ timeout: 5000 });
  const seen = [];
  let missed = false;
  for (let n = 0; n < 20; n++) {
    if (await page.locator('.complete').count()) break;
    const miss = wrongFirst && !missed && (await page.evaluate(() => (questions[qIdx].type || 'mc') === 'mc'));
    if (miss) missed = true;
    seen.push(await answerQ(R, miss));
  }
  await page.locator('.complete').waitFor({ timeout: 5000 });
  return seen;
}

// ═══════════════════════════════════════════════════════════════
// THE MAIN RUN: one child, one screen, one way of pressing things
// ═══════════════════════════════════════════════════════════════
async function runFlow(browser, vp, pid, opts) {
  const log = [];
  const R = { vp, pid, tag: `${vp.name}-${pid}`, lastTap: 0, shotN: 0, check: mkCheck(log) };
  const check = R.check;
  const t0 = Date.now();
  log.push(`\n── ${R.tag} (${vp.w}×${vp.h}, ${vp.input}) ──`);
  const { ctx, page, errors } = await newPage(browser, vp);
  R.page = page;
  const K = pid === 'k';
  const keys = vp.input === 'keys';
  const first = STOP(FIRST[pid]), next = STOP(NEXT[pid]);
  const firstLand = first.land, otherLand = LANDS.find(l => l !== firstLand);
  const tag = R.tag;
  try {
    // ── 1. Title → hub: the road card, before any road data exists ──
    if (keys) {
      check(await tabTo(R, pid => (document.activeElement.getAttribute('onclick') || '').includes(`'${pid}'`), pid), `${tag}: Tab reaches the profile card`);
      await page.keyboard.press('Enter');
    } else await press(R, page.locator(`.profile-card[onclick*="'${pid}'"]`));
    await page.locator('.hub').waitFor();
    check(await store(page, pid) === null, `${tag}: a fresh profile has no road data yet`);
    const card = page.locator('.reading-hubcard');
    check(await card.count() === 1, `${tag}: hub shows the Reading Road card`);
    check(await page.evaluate(() => { const z = document.querySelector('.fun-zone'); return !!z && !!z.firstElementChild && z.firstElementChild.classList.contains('reading-hubcard'); }),
      `${tag}: the card is first in the play zone`);
    const cardText = (await card.innerText()).toUpperCase();
    check(cardText.includes('READING ROAD') && cardText.includes(firstLand.title.toUpperCase()) && cardText.includes(first.title.toUpperCase()) && /FIRST STOP/.test(cardText),
      `${tag}: card shows ${firstLand.title} · first stop "${first.title}"`);
    if (K) {
      await clearRec(page);
      await press(R, card.locator('.js-speak'));
      await page.waitForTimeout(150);
      check((await spoken(page)).some(t => /Reading Road/.test(t) && t.includes(first.sayTitle || first.title)) && await page.locator('.reading-road').count() === 0,
        `${tag}: 🔊 on the card reads it aloud without opening the road`);
    }
    check(await store(page, pid) === null, `${tag}: showing the card creates no data`);
    await shot(R, 'hub');
    await layout(R, 'hub card');

    // ── 2. Open the road: placement, map, avatar, scroll ──
    await clearRec(page);
    if (keys) {
      // (The kindergartener's focus is still on the card's 🔊, just after the card.)
      check(await tabTo(R, () => document.activeElement.classList.contains('reading-hubcard'), null, K), `${tag}: ${K ? 'Shift+' : ''}Tab reaches the road card`);
      await page.keyboard.press('Enter');
    } else await press(R, hubCard(R));
    await page.locator('.reading-road').waitFor();
    await page.waitForTimeout(500);
    let st = await store(page, pid);
    check(!!st && st.placed === true && st.current === first.id && st.reach === first.id, `${tag}: placed at ${first.id} on first open (${st && st.current})`);
    check(await page.locator('.reading-land').count() === LANDS.length && await page.locator('.reading-stop').count() === STOPS.length,
      `${tag}: map shows ${LANDS.length} lands and ${STOPS.length} stops`);
    const cls = id => page.locator(`.reading-stop[data-stop="${id}"]`).getAttribute('class');
    if (K) {
      check(/is-locked/.test(await cls(next.id)) && (await page.locator('.reading-land.is-locked').count()) === 1, `${tag}: stop 2 and the next land are locked`);
    } else {
      const pre = LANDS[0].stops.map(s => s.id);
      const preCls = await Promise.all(pre.map(cls));
      check(preCls.every(c => /is-open/.test(c) && !/is-locked|is-done/.test(c)), `${tag}: stops before the placement are open, not starred`);
      check(/is-locked/.test(await cls(next.id)), `${tag}: the stop after the placement is locked`);
    }
    const cur = page.locator(`.reading-stop.is-current[data-stop="${first.id}"]`);
    check(await cur.count() === 1, `${tag}: the current stop glows`);
    const inView = await cur.evaluate(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight; });
    check(inView, `${tag}: the map scrolled to the current stop`);
    const av = await page.evaluate(id => {
      const a = document.querySelector('.reading-avatar'), s = document.querySelector(`.reading-stop[data-stop="${id}"] .reading-disc`);
      if (!a || !s) return null;
      const ra = a.getBoundingClientRect(), rs = s.getBoundingClientRect();
      return { same: a.closest('.reading-land') === s.closest('.reading-land'), dy: Math.abs((ra.top + ra.height / 2) - (rs.top + rs.height / 2)),
        dx: Math.abs((ra.left + ra.width / 2) - (rs.left + rs.width / 2)), face: a.textContent.includes(currentProfile.emoji) };
    }, first.id);
    check(av && av.same && av.face && av.dy < 40 && av.dx < 140, `${tag}: the avatar (profile emoji) stands beside the current stop`);
    if (keys) check(await focused(page, `.reading-stop[data-stop="${first.id}"]`), `${tag}: keyboard focus starts on the current stop`);
    if (K) check((await spoken(page)).some(t => /Welcome to the Reading Road/.test(t)), `${tag}: first visit is read aloud`);
    await shot(R, 'map');
    await layout(R, 'map');

    // ── 3. A locked stop says, kindly, what to finish first ──
    await clearRec(page);
    await press(R, page.locator(`.reading-stop[data-stop="${next.id}"]`));
    await page.waitForTimeout(200);
    check(await page.locator(`.reading-stop.reading-shake[data-stop="${next.id}"]`).count() === 1 && await page.locator('.reading-road').count() === 1,
      `${tag}: a locked stop wiggles and stays on the map`);
    check(await page.locator('.fun-toast', { hasText: first.title }).count() >= 1, `${tag}: a toast says to finish "${first.title}" first`);
    check((await sounds(page)).includes('think'), `${tag}: locked stop plays the gentle think sound`);
    if (K) {
      check((await spoken(page)).some(t => /still locked/i.test(t)), `${tag}: the lock is explained aloud`);
      await clearRec(page);
      await press(R, page.locator(`.reading-land[data-land="${firstLand.id}"] .reading-banner .js-speak`));
      check((await spoken(page)).some(t => t.includes(firstLand.title)), `${tag}: 🔊 on the land banner says the land's name`);
    }
    await shot(R, 'locked-toast');

    // ── 4. The stop screen ──
    await clearRec(page);
    await press(R, cur);
    await page.locator('.reading-stopscreen').waitFor();
    await page.waitForTimeout(450);
    check((await page.locator('.reading-intro-title').innerText()).trim() === first.title, `${tag}: stop screen titled "${first.title}"`);
    check(await page.locator('.reading-plan li').count() === (first.story ? 4 : 3), `${tag}: the plan shows learn, story, play, stars`);
    if (K) {
      check(await page.locator('.reading-intro-more').count() === 0, `${tag}: a new stop shows one big START for the kindergartener`);
      check((await spoken(page)).some(t => t.includes('Stop 1') && t.includes(first.sayTitle || first.title)), `${tag}: the stop's name is said when tapped`);
    } else check(await page.locator('.reading-intro-more .reading-btn').count() === 2, `${tag}: JUST THE STORY / JUST THE GAMES offered`);
    if (keys) check(await focused(page, '.reading-start'), `${tag}: focus lands on START`);
    await shot(R, 'stop');
    await layout(R, 'stop screen');

    // ── 5. Learn cards ──
    await clearRec(page);
    await press(R, page.locator('.reading-start'));
    await page.locator('.reading-learn').waitFor();
    await page.waitForTimeout(420);
    const cards = first.learn;
    const say0 = cards[0].say || cards[0].text;
    if (K) check((await spoken(page)).includes(say0), `${tag}: the first card is read aloud automatically`);
    else check(!(await spoken(page)).includes(say0), `${tag}: no automatic speech when auto-read is off`);
    // (Speech checks look for the line anywhere: an auto-read timer may land after a fast press.)
    await clearRec(page);
    await press(R, page.locator('.reading-big'));
    check((await spoken(page)).includes(say0), `${tag}: tapping the big "${cards[0].big}" says it`);
    const chip = page.locator('.reading-chip').first();
    const chipWord = await chip.getAttribute('data-word');
    await clearRec(page);
    await press(R, chip);
    check((await spoken(page)).includes(chipWord) && await page.locator('.reading-chip.reading-said').count() === 1, `${tag}: tapping the example word "${chipWord}" says it`);
    await clearRec(page);
    await press(R, page.locator('.reading-card-voice .js-speak'));
    check((await spoken(page)).includes(say0), `${tag}: 🔊 Hear it reads the card`);
    await shot(R, 'learn');
    await layout(R, 'learn card');
    const count = () => page.locator('.reading-card-count').innerText();
    for (let i = 1; i < cards.length; i++) {
      if (keys) await page.keyboard.press('ArrowRight'); else await press(R, page.locator('.reading-next'));
      await page.waitForTimeout(120);
      check((await count()).includes(`${i + 1} OF ${cards.length}`), `${tag}: ${keys ? '→' : 'NEXT'} goes to card ${i + 1}`);
    }
    if (cards.length > 1) {
      if (keys) await page.keyboard.press('ArrowLeft'); else await press(R, page.locator('.reading-prev'));
      await page.waitForTimeout(120);
      check((await count()).includes(`${cards.length - 1} OF`), `${tag}: ${keys ? '←' : 'BACK'} goes back a card`);
      if (keys) await page.keyboard.press('ArrowRight'); else await press(R, page.locator('.reading-next'));
      await page.waitForTimeout(120);
    }
    check(/TO THE STORY/.test(await page.locator('.reading-next').innerText()), `${tag}: the last card leads TO THE STORY`);

    // ── 6. The story: tap words, read-to-me, the end ──
    await clearRec(page);
    if (keys) await page.keyboard.press('ArrowRight'); else await press(R, page.locator('.reading-next'));
    await page.locator('.reading-story').waitFor();
    await page.waitForTimeout(480);
    const story = first.story;
    const listen = story.mode === 'listen';
    check(await page.locator(`.reading-mode.${listen ? 'is-listen' : 'is-read'}`).count() === 1, `${tag}: story is marked ${listen ? 'LISTEN' : 'YOU READ IT'}`);
    check((await page.locator('.reading-page-count').innerText()).includes(`1 OF ${story.pages.length}`), `${tag}: page 1 of ${story.pages.length}`);
    const nWords = await page.locator('.reading-page .reading-word').count();
    check(nWords === story.pages[0].split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w)).length, `${tag}: every word on the page is a button (${nWords})`);
    if (listen) check((await spoken(page)).some(t => t.includes(story.pages[0])), `${tag}: a listen story reads each page by itself`);
    else check(!(await spoken(page)).some(t => t.includes(story.pages[0])) && await page.locator('.reading-tip').count() === 1, `${tag}: a read story waits for the child ("Your turn to read!")`);
    await clearRec(page);
    let word;
    if (keys) {
      check(await tabTo(R, () => document.activeElement.classList.contains('reading-word'), null, true, 6), `${tag}: Shift+Tab reaches a word`);
      word = await page.evaluate(() => document.activeElement.getAttribute('data-word'));
      await page.keyboard.press('Enter');
    } else {
      const w = page.locator('.reading-page .reading-word').nth(1);
      word = await w.getAttribute('data-word');
      await press(R, w);
    }
    await page.waitForTimeout(80);
    check((await spoken(page)).includes(word) && await page.locator('.reading-word.reading-said').count() === 1, `${tag}: tapping the word "${word}" says just that word`);
    await clearRec(page);
    await press(R, page.locator('.reading-story-voice .js-speak'));
    check((await spoken(page)).some(t => t.includes(story.pages[0]) && t.includes(story.title)), `${tag}: "${listen ? 'Read it again' : 'Read this page to me'}" reads the page`);
    await shot(R, 'story');
    await layout(R, 'story page');
    for (let p = 1; p < story.pages.length; p++) {
      if (keys) await page.keyboard.press('ArrowRight'); else await press(R, page.locator('.reading-next'));
      await page.waitForTimeout(100);
    }
    check((await page.locator('.reading-page-count').innerText()).includes(`${story.pages.length} OF ${story.pages.length}`), `${tag}: reached the last page`);
    if (keys) await page.keyboard.press('ArrowRight'); else await press(R, page.locator('.reading-next'));
    await page.locator('.reading-book-end').waitFor();
    await clearRec(page);
    await press(R, page.locator('.reading-story-voice .js-speak'));
    check((await spoken(page)).some(t => story.pages.every(p => t.includes(p))), `${tag}: "Hear the whole story" reads every page`);
    await shot(R, 'story-end');
    await layout(R, 'story end');
    if (keys) check(await focused(page, '.reading-play') || (await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('js-speak'))), `${tag}: focus is on a story-end control`);
    await press(R, page.locator('.reading-play'));

    // ── 7. Briefing, worded for the stop ──
    await page.locator('.briefing').waitFor();
    await page.waitForTimeout(60);
    const nQ = await page.evaluate(() => questions.length);
    const expectQ = first.practice.length + first.questions.length;
    check(nQ === expectQ, `${tag}: the round is the stop's ${first.practice.length} practice + ${first.questions.length} story questions (${nQ})`);
    const brief = await page.locator('.briefing').innerText();
    check(await page.locator('.briefing.reading-briefing').count() === 1 && brief.includes(firstLand.title.toUpperCase()) && brief.includes('STOP 1') &&
      brief.includes(`${nQ} questions`) && /⭐/.test(brief), `${tag}: the briefing names the land and stop, ${nQ} questions, and the stars`);
    check(brief.includes(first.why), `${tag}: the briefing's why is the stop's why`);
    check(await page.evaluate(() => currentPack.grade) === (firstLand.grade === 'K' ? 'K' : String(firstLand.grade).charAt(0)), `${tag}: pack grade follows the land (${firstLand.grade})`);
    await shot(R, 'briefing');

    // ── 8. The round ──
    await clearRec(page);
    const wrong = !K;   // the 5th grader fixes one answer after a hint → 2 stars
    const seen = await playRound(R, wrong);
    const storyQs = seen.filter(q => q.passage);
    check(seen.length === expectQ, `${tag}: answered all ${expectQ} (${seen.map(q => q.type).join(',')})`);
    check(storyQs.length === first.questions.length && storyQs.every(q => q.dom.passage && q.dom.tag.includes('📖')), `${tag}: every story question shows the story to look back at`);
    if (K) {
      check(storyQs.every(q => q.dom.passageVoice), `${tag}: the kindergartener can hear the story on each question`);
      check(seen.filter(q => q.type === 'mc').every(q => q.dom.choiceVoices === q.nOpt), `${tag}: every answer has its own 🔊`);
      check(seen.some(q => q.dom.pics > 0), `${tag}: picture answers are drawn big`);
    }
    const shows = seen.filter(q => q.show);
    const expShows = [...first.practice, ...first.questions].filter(q => q.show).length;
    if (expShows) check(shows.length === expShows && shows.every(q => q.dom.show === q.show), `${tag}: "read this word" cards are shown (${shows.map(q => q.show).join(', ')})`);

    // ── 9. The complete screen: stars ──
    await page.waitForTimeout(2300);
    const expStars = K ? 3 : 2;
    const ev = await events(page);
    const end = ev.find(e => e.n === 'roundEnd');
    check(!!end && end.score === (K ? expectQ : expectQ - 1) && end.fixed === (K ? 0 : 1), `${tag}: round ended ${end && end.score}/${end && end.total}, ${end && end.fixed} fixed`);
    check(await page.locator('.reading-done').count() === 1, `${tag}: the complete screen shows the road card`);
    check(await page.locator('.reading-done .reading-bigstar.on').count() === expStars, `${tag}: ${expStars} stars pop in`);
    check((await page.locator('.complete-title').innerText()).includes('STOP 1 DONE'), `${tag}: title says STOP 1 DONE!`);
    const doneText = await page.locator('.reading-done').innerText();
    check(/NEW STOP OPEN/.test(doneText) && doneText.includes(next.title), `${tag}: says the new stop "${next.title}" is open`);
    check(await page.locator('.complete .complete-nav', { hasText: 'MY HUB' }).count() === 1, `${tag}: engine buttons reworded (← MY HUB)`);
    st = await store(page, pid);
    check(st.stars[first.id] === expStars && st.current === next.id && st.plays[first.id] === 1, `${tag}: saved ${expStars} stars, current → ${next.id}`);
    const rs = ev.find(e => e.n === 'readingStop');
    check(!!rs && rs.stop === first.id && rs.stars === expStars && rs.firstTime === true, `${tag}: readingStop event { stop, stars: ${expStars} }`);
    check((await sounds(page)).filter(s => s === 'sticker').length >= expStars, `${tag}: a sparkle sound per star`);
    if (K) check(await page.locator('.reading-done .js-speak').count() === 1, `${tag}: 🔊 on the result for the kindergartener`);
    if (keys) check(await focused(page, '.reading-done-go'), `${tag}: focus on BACK TO THE ROAD`);
    await page.locator('.reading-done').scrollIntoViewIfNeeded();
    await shot(R, 'complete');
    await layout(R, 'complete');

    // ── 10. Back on the map: the new stop pops open ──
    await clearRec(page);
    await press(R, page.locator('.reading-done-go'));
    await page.locator('.reading-road').waitFor();
    await page.waitForTimeout(520);
    check(await page.locator(`.reading-stop.just-unlocked[data-stop="${next.id}"]`).count() === 1, `${tag}: the next stop pops open`);
    check((await sounds(page)).includes('levelup') && await page.locator('.fun-confetti').count() >= 1, `${tag}: level-up sound and confetti`);
    check(/is-current/.test(await cls(next.id)) && !/is-locked/.test(await cls(next.id)) && /is-done/.test(await cls(first.id)), `${tag}: next stop is current; the played stop is done`);
    await page.waitForTimeout(900);   // the avatar's hop
    const starTxt = await page.locator(`.reading-stop[data-stop="${first.id}"] .reading-stop-stars`).innerText();
    check(starTxt.trim() === '★'.repeat(expStars) + '☆'.repeat(3 - expStars), `${tag}: ${starTxt.trim()} under the played stop`);
    check(await page.locator(`.reading-land[data-land="${firstLand.id}"] .reading-path-trail`).count() === 1, `${tag}: the finished part of the road is coloured in`);
    const av2 = await page.evaluate(id => {
      const a = document.querySelector('.reading-avatar').getBoundingClientRect(), s = document.querySelector(`.reading-stop[data-stop="${id}"] .reading-disc`).getBoundingClientRect();
      return Math.abs((a.top + a.height / 2) - (s.top + s.height / 2));
    }, next.id);
    check(av2 < 40, `${tag}: the avatar moved to the new stop`);
    if (K) check((await spoken(page)).some(t => /new stop is open/i.test(t)), `${tag}: "A new stop is open" is said aloud`);
    await shot(R, 'map-unlocked');
    await layout(R, 'map after a stop');

    // ── 11. Ways back: Esc one level at a time; leaving a round half way ──
    await press(R, page.locator(`.reading-stop[data-stop="${first.id}"]`));
    await page.locator('.reading-stopscreen').waitFor();
    check((await page.locator('.reading-intro-best').innerText()).includes('★'.repeat(expStars)) && /START AGAIN/.test(await page.locator('.reading-start').innerText()),
      `${tag}: a played stop shows its best stars and START AGAIN`);
    if (keys) {
      await page.keyboard.press('Enter');                       // START
      await page.locator('.reading-learn').waitFor();
      await page.keyboard.press('Escape');
      check(await page.locator('.reading-stopscreen').count() === 1, `${tag}: Esc on a learn card → the stop`);
      await page.keyboard.press('Escape');
      check(await page.locator('.reading-road').count() === 1, `${tag}: Esc on the stop → the road`);
      await page.keyboard.press('Escape');
      check(await page.locator('.hub').count() === 1, `${tag}: Esc on the road → the hub`);
      check(await tabTo(R, () => document.activeElement.classList.contains('reading-hubcard')), `${tag}: Tab reaches the road card again`);
      await page.keyboard.press('Enter');
      await page.locator('.reading-road').waitFor();
      await press(R, page.locator(`.reading-stop[data-stop="${first.id}"]`));
      await page.locator('.reading-stopscreen').waitFor();
    } else {
      await press(R, page.locator('.reading-back'));
      check(await page.locator('.reading-road').count() === 1, `${tag}: ← ROAD goes back to the map`);
      await press(R, page.locator('.reading-back'));
      check(await page.locator('.hub').count() === 1, `${tag}: ← MY HUB goes back to the hub`);
      await press(R, page.locator('.reading-hub-go'));
      check(await page.locator('.reading-stopscreen').count() === 1 && (await page.locator('.reading-intro-title').innerText()).trim() === next.title,
        `${tag}: GO ▶ on the hub card opens the next stop`);
      await press(R, page.locator('.reading-back'));
      await press(R, page.locator(`.reading-stop[data-stop="${first.id}"]`));
      await page.locator('.reading-stopscreen').waitFor();
      // The briefing's ← BACK goes back to the stop.
      await press(R, page.locator('.reading-intro-more .reading-btn', { hasText: 'GAMES' }));
      await page.locator('.briefing').waitFor();
      await press(R, page.locator('.quiz-top .exit-btn'));
      check(await page.locator('.reading-stopscreen').count() === 1, `${tag}: ← BACK on the briefing returns to the stop`);
    }
    await clearRec(page);
    await press(R, page.locator('.reading-intro-more .reading-btn', { hasText: 'GAMES' }));
    await page.locator('.briefing').waitFor();
    if (keys) await page.keyboard.press('Enter'); else await press(R, page.locator('.briefing-go'));
    await page.locator('.question-frame').waitFor();
    check(await page.evaluate(() => document.body.classList.contains('reading-in-round')), `${tag}: the round knows it is a road round`);
    await answerQ(R, false);
    if (keys) await page.keyboard.press('Escape'); else await press(R, page.locator('.quiz-top .exit-btn'));
    await page.locator('#exit-modal-exit').waitFor();
    await press(R, page.locator('#exit-modal-exit'));
    await page.waitForTimeout(150);
    check(await page.locator('.reading-stopscreen').count() === 1 && (await page.locator('.reading-intro-title').innerText()).trim() === first.title,
      `${tag}: leaving a round half way goes back to the stop`);
    st = await store(page, pid);
    check(st.stars[first.id] === expStars && st.plays[first.id] === 1 && (await events(page)).some(e => e.n === 'roundExit'), `${tag}: leaving early changes no stars`);
    check(!(await page.evaluate(() => document.body.classList.contains('reading-in-round'))), `${tag}: road-round styling is cleared`);

    // ── 12. Finish the land: a bigger party, a sticker, a trophy flag ──
    if (opts.land) {
      await press(R, page.locator('.reading-back'));
      await page.locator('.reading-road').waitFor();
      await press(R, page.locator(`.reading-stop[data-stop="${next.id}"]`));
      await page.locator('.reading-stopscreen').waitFor();
      await clearRec(page);
      if (K) {
        // Learn → a story she reads herself, with a Tricky Word marked.
        await press(R, page.locator('.reading-start'));
        await page.locator('.reading-learn').waitFor();
        for (let i = 0; i < next.learn.length; i++) {
          if (keys) await page.keyboard.press('ArrowRight'); else await press(R, page.locator('.reading-next'));
          await page.waitForTimeout(90);
        }
        await page.locator('.reading-story').waitFor();
        check(await page.locator('.reading-mode.is-read').count() === 1 && await page.locator('.reading-tip').count() === 1, `${tag}: stop 2's story is hers to read`);
        const trickyPage = next.story.pages.findIndex(p => /\ba\b/i.test(p));
        for (let p = 0; p < trickyPage; p++) {
          if (keys) await page.keyboard.press('ArrowRight'); else await press(R, page.locator('.reading-next'));
          await page.waitForTimeout(90);
        }
        check(await page.locator('.reading-page .reading-word.is-tricky').count() >= 1 && await page.locator('.reading-legend').count() === 1,
          `${tag}: the Tricky Word "a" is starred, with a key`);
        await shot(R, 'story-read');
        await layout(R, 'read story');
        for (let p = trickyPage; p < next.story.pages.length; p++) {
          if (keys) await page.keyboard.press('ArrowRight'); else await press(R, page.locator('.reading-next'));
          await page.waitForTimeout(90);
        }
        await press(R, page.locator('.reading-play'));
      } else {
        await press(R, page.locator('.reading-intro-more .reading-btn', { hasText: 'GAMES' }));
      }
      const seen2 = await playRound(R, false);
      check(seen2.some(q => q.review === first.id && /Review/.test(q.dom.tag)), `${tag}: the round mixes in a review item from the finished stop`);
      await page.waitForTimeout(2300);
      const doneText2 = await page.locator('.reading-done').innerText();
      check(doneText2.includes(`${firstLand.title.toUpperCase()} COMPLETE`), `${tag}: the result says ${firstLand.title.toUpperCase()} COMPLETE!`);
      const ev2 = await events(page);
      check(ev2.some(e => e.n === 'readingLand' && e.land === firstLand.id) && ev2.some(e => e.n === 'awardSticker' && e.pid === pid),
        `${tag}: readingLand and awardSticker (a bonus sticker) are emitted`);
      const troph = await page.evaluate(pid => state.profiles[pid].trophies.slice(), pid);
      check(troph.includes('reading_stop') && troph.includes('reading_land'), `${tag}: ROAD TRIP and LAND HERO trophies`);
      await page.locator('.reading-done').scrollIntoViewIfNeeded();
      await shot(R, 'complete-land');
      await clearRec(page);
      await press(R, page.locator('.reading-done-go'));
      await page.locator('.reading-road').waitFor();
      await page.waitForTimeout(1400);
      check(await page.locator(`.reading-land.is-done[data-land="${firstLand.id}"] .reading-flag`).count() === 1, `${tag}: the finished land flies a trophy flag`);
      check((await sounds(page)).includes('win') && await page.locator('.fun-toast', { hasText: 'COMPLETE' }).count() >= 1, `${tag}: land party: win sound and a banner`);
      if (K) {
        check(await page.locator('.reading-land.is-locked').count() === 0 && !/is-locked/.test(await cls(otherLand.stops[0].id)), `${tag}: the next land opens`);
        check((await spoken(page)).some(t => t.includes(`You finished ${firstLand.title}`)), `${tag}: "You finished ${firstLand.title}!" is said`);
      }
      await shot(R, 'map-land-done');
      await layout(R, 'map, land done');
    }

    // ── 13. Progress survives a reload ──
    const before = await store(page, pid);
    await page.reload();
    await page.evaluate(() => document.fonts.ready);
    await spies(page);
    check(JSON.stringify(await store(page, pid)) === JSON.stringify(before), `${tag}: road progress is saved and reloaded`);
    await page.evaluate(pid => pickProfile(pid), pid);
    await page.locator('.reading-hubcard').waitFor();
    const badge = await page.locator('.reading-hubcard .fun-card-badge').innerText();
    const totalStars = Object.values(before.stars).reduce((a, b) => a + b, 0);
    check(badge.includes(String(totalStars)), `${tag}: the hub card shows ⭐ ${totalStars}`);

    // ── 14. A normal round still plays with the module loaded ──
    if (opts.normal) {
      const roadBefore = JSON.stringify(await store(page, pid));
      await clearRec(page);
      await press(R, page.locator('.pack-card').first());
      await page.locator('.briefing-go, .question-frame').first().waitFor();
      const pk = await page.evaluate(() => currentPack.id);
      if (await page.locator('.briefing-go').count()) {
        check(await page.locator('.reading-briefing').count() === 0, `${tag}: a normal briefing is left alone`);
        if (keys) await page.keyboard.press('Enter'); else await press(R, page.locator('.briefing-go'));
      }
      await page.locator('.question-frame').first().waitFor();
      let n = 0;
      for (; n < 16; n++) { if (await page.locator('.complete').count()) break; await answerQ(R, false); }
      await page.locator('.complete').waitFor();
      check(pk !== 'reading_road' && n >= 5, `${tag}: a normal round (${pk}) plays start to finish (${n} questions)`);
      check(await page.locator('.reading-done').count() === 0 && /ROUND 1 DONE/.test(await page.locator('.complete-title').innerText()), `${tag}: its complete screen is the game's own`);
      check(JSON.stringify(await store(page, pid)) === roadBefore && !(await events(page)).some(e => e.n === 'readingStop'), `${tag}: a normal round leaves the road alone`);
      await press(R, page.locator('.complete .complete-nav', { hasText: 'BACK TO PACKS' }));
      await page.locator('.hub').waitFor();
    }

    // ── 15. Parent controls ──
    if (opts.parent) {
      await press(R, page.locator('.parent-link'));
      await page.locator('.reading-parent').waitFor();
      check(await page.locator('.reading-parent-kid').count() === 3, `${tag}: parent page lists the road for all three children`);
      const mine = await page.locator(`#reading-parent-${pid}`).innerText();
      const cur2 = STOP((await store(page, pid)).current);
      check(mine.includes(`⭐ ${totalStars} of ${STOPS.length * 3}`) && mine.includes(cur2.title), `${tag}: parent row shows ⭐ ${totalStars} and the current stop "${cur2.title}"`);
      const g3row = await page.locator('#reading-parent-g3').innerText();
      check(/not started yet/.test(g3row) && g3row.includes('Will start at') && g3row.includes(STOP(FIRST.g3).title), `${tag}: an unstarted child shows where they will start`);
      await page.locator('.reading-parent').scrollIntoViewIfNeeded();
      await shot(R, 'parent');
      await layout(R, 'parent');
      // Move the 3rd grader on (keyboard: ↓ on the select).
      const target = STOPS[STOPS.findIndex(s => s.id === FIRST.g3) + 1].id;
      if (keys) {
        await page.locator('#reading-move-g3').focus();
        await page.keyboard.press('ArrowDown');
      } else await page.locator('#reading-move-g3').selectOption(target);
      await page.waitForTimeout(150);
      const g3 = await store(page, 'g3');
      check(!!g3 && g3.current === target && g3.reach === target && g3.placed === true, `${tag}: moving the 3rd grader puts them at ${target}`);
      check(/Saved/.test(await page.locator('#reading-saved-g3').innerText()), `${tag}: the move says Saved`);
      if (keys) check(await focused(page, '#reading-move-g3'), `${tag}: focus stays on the select`);
      // Unlock every stop on, then off: stars are kept.
      const starsBefore = JSON.stringify((await store(page, pid)).stars);
      const toggle = async () => {
        if (keys) { await page.locator(`#reading-all-${pid}`).focus(); await page.keyboard.press(' '); }
        else await press(R, page.locator(`label[for="reading-all-${pid}"]`));
        await page.waitForTimeout(150);
      };
      await toggle();
      check((await store(page, pid)).unlockAll === true && await page.locator(`#reading-all-${pid}`).isChecked(), `${tag}: "Unlock every stop" turns on`);
      await toggle();
      const after = await store(page, pid);
      check(after.unlockAll === false && JSON.stringify(after.stars) === starsBefore, `${tag}: and off again; stars are kept`);
      // The moved child's road.
      await press(R, page.locator('.switch-btn', { hasText: 'BACK TO GAME' }));
      await press(R, page.locator(`.profile-card[onclick*="'g3'"]`));
      await page.locator('.reading-hubcard').waitFor();
      check(/NEXT STOP/.test(await page.locator('.reading-hubcard').innerText()) && (await page.locator('.reading-hubcard').innerText()).includes(STOP(target).title),
        `${tag}: the 3rd grader's card shows the stop the parent chose`);
      await press(R, hubCard(R));
      await page.locator('.reading-road').waitFor();
      const g3cls = await page.evaluate(() => [...document.querySelectorAll('.reading-stop')].map(b => b.dataset.stop + ':' + (b.classList.contains('is-locked') ? 'L' : 'O')));
      check(g3cls.every(c => c.endsWith(':O')) && await page.locator(`.reading-stop.is-current[data-stop="${target}"]`).count() === 1,
        `${tag}: every stop up to the chosen one is open (${g3cls.join(' ')})`);
    }
  } catch (e) {
    check(false, `${tag}: run crashed — ${e.message.split('\n')[0]}`);
    try { await shot(R, 'CRASH'); } catch (e2) {}
  }
  check(errors.length === 0, `${tag}: no page or console errors` + (errors.length ? ' — ' + errors.slice(0, 4).join(' | ') : ''));
  await ctx.close();
  log.push(`  (${Math.round((Date.now() - t0) / 1000)}s)`);
  return log;
}

// ═══════════════════════════════════════════════════════════════
// SMALLER PASSES
// ═══════════════════════════════════════════════════════════════
// Placement for each child, star maths, and old or broken saved data.
async function runPlacement(browser) {
  const log = ['\n── placement, stars, broken data (laptop, mouse) ──'];
  const check = mkCheck(log);
  const vp = { name: 'placement', w: 1440, h: 900, input: 'mouse' };
  const { ctx, page, errors } = await newPage(browser, vp);
  const R = { vp, pid: 'g5', tag: 'placement', lastTap: 0, shotN: 0, check, page };
  try {
    for (const pid of ['k', 'g3', 'g5']) {
      await page.evaluate(() => renderProfileSelect());
      await press(R, page.locator(`.profile-card[onclick*="'${pid}'"]`));
      check(await store(page, pid) === null, `${pid}: no road data before the first open`);
      await press(R, hubCard(R));
      await page.locator('.reading-road').waitFor();
      const st = await store(page, pid);
      const expect = FIRST[pid];
      const want = { k: 'the very first stop', g3: 'the first land for grade 2 and up', g5: 'the first grade 4-5 land' }[pid];
      check(st.current === expect && st.reach === expect && Object.keys(st.stars).length === 0, `${pid}: placed at ${expect} (${want}), no stars`);
      const open = await page.evaluate(() => [...document.querySelectorAll('.reading-stop:not(.is-locked)')].map(b => b.dataset.stop));
      const idx = STOPS.findIndex(s => s.id === expect);
      check(JSON.stringify(open) === JSON.stringify(STOPS.slice(0, idx + 1).map(s => s.id)), `${pid}: open stops are the ones up to the placement (${open.join(', ')})`);
    }
    // Star maths, through the real roundEnd handler.
    const stars = await page.evaluate(() => {
      const pack = PACKS.g3.find(p => p.id === 'reading_road');
      const id = pack._readingStop = READING_ROAD.lands[1].stops[0].id;
      const out = [];
      for (const [score, total, fixed] of [[7, 10, 1], [8, 10, 0], [6, 10, 4], [5, 10, 4], [10, 10, 0], [0, 10, 0]]) {
        FUN.emit('roundEnd', { profileId: 'g3', pack, score, total, fixed, xpEarned: 0, bestStreak: 0, perfect: score === total });
        const e = window.__ev.filter(x => x.n === 'readingStop').pop();
        out.push([e.stars, state.profiles.g3.fun.reading.stars[id]]);
      }
      return out;
    });
    check(JSON.stringify(stars) === JSON.stringify([[1, 1], [2, 2], [2, 2], [1, 2], [3, 3], [1, 3]]),
      `stars: 7+1 fixed→1 (75%), 8→2, 6+4 fixed→2 (80%), 5+4 fixed→1 (best stays 2), perfect→3, a worse round keeps 3 (${JSON.stringify(stars)})`);
    // Old or broken data: repaired on open, stars clamped, never lost.
    await page.evaluate(id => {
      state.profiles.g5.fun = { reading: { current: 'no-such-stop', reach: 42, stars: { [id]: 7, junk: 'x', neg: -2 }, placed: true, plays: 'oops', unlockAll: 'yes' } };
      saveState();
    }, FIRST.g5);
    await page.reload();
    await spies(page);
    await page.evaluate(() => pickProfile('g5'));
    await page.locator('.reading-hubcard').waitFor();
    await press(R, hubCard(R));
    await page.locator('.reading-road').waitFor();
    const fixed = await store(page, 'g5');
    check(fixed.stars[FIRST.g5] === 3 && !('neg' in fixed.stars) && fixed.unlockAll === false && typeof fixed.plays === 'object' &&
      STOPS.some(s => s.id === fixed.current), `broken saved data is repaired (current ${fixed.current}, stars ${JSON.stringify(fixed.stars)})`);
    check(await page.locator('.reading-stop').count() === STOPS.length, 'the map still draws with repaired data');
    // A child who has never opened the road can still play a normal round and see the card.
    await page.evaluate(() => { delete state.profiles.k.fun; renderProfileSelect(); pickProfile('k'); });
    check(await page.locator('.reading-hubcard').count() === 1 && await store(page, 'k') === null, 'a profile with no fun data at all still gets the card');
  } catch (e) { check(false, 'placement run crashed — ' + e.message.split('\n')[0]); }
  check(errors.length === 0, 'placement: no page or console errors' + (errors.length ? ' — ' + errors.slice(0, 3).join(' | ') : ''));
  await ctx.close();
  return log;
}

// The data file spliced after the module, and no data at all.
async function runBuilds(browser) {
  const log = ['\n── build order and missing data ──'];
  const check = mkCheck(log);
  const vp = { name: 'builds', w: 820, h: 1180, input: 'mouse' };
  {
    const { ctx, page, errors } = await newPage(browser, vp, HTML_REVERSED);
    await page.evaluate(() => pickProfile('k'));
    await page.locator('.reading-hubcard').waitFor();
    await page.locator('.reading-hubcard .fun-card-top').click();
    await page.locator('.reading-road').waitFor();
    check(await page.locator('.reading-stop').count() === STOPS.length, 'data spliced AFTER the module still loads the road');
    check(errors.length === 0, 'reversed build: no errors' + (errors.length ? ' — ' + errors.join(' | ') : ''));
    await ctx.close();
  }
  {
    const { ctx, page, errors } = await newPage(browser, vp, HTML_NODATA);
    await page.evaluate(() => pickProfile('g5'));
    await page.locator('.hub').waitFor();
    check(await page.locator('.reading-hubcard').count() === 0, 'no data: no road card, the hub is unchanged');
    await page.evaluate(() => { readingOpenMap(); });
    check(/still being built/.test(await page.locator('.reading-empty').innerText()), 'no data: the road says it is still being built');
    await page.evaluate(() => renderParentDash());
    check(await page.locator('.reading-parent').count() === 0, 'no data: no parent block');
    check(errors.length === 0, 'no-data build: no errors' + (errors.length ? ' — ' + errors.join(' | ') : ''));
    await ctx.close();
  }
  return log;
}

// Every stop of the real content (READING_ROAD in the game file): each learn card,
// each story page and each question of its round renders without an error.
async function runRealContent(browser) {
  const log = ['\n── the real content (READING_ROAD in the game file) ──'];
  const check = mkCheck(log);
  if (!HAVE_REAL) { log.push('  (the game file has no reading-data module — skipped)'); return log; }
  const vp = { name: 'real', w: 820, h: 1180, input: 'mouse' };
  const { ctx, page, errors } = await newPage(browser, vp, HTML_REAL);
  try {
    const r = await page.evaluate(() => {
      pickProfile('g5');
      const out = { stops: 0, cards: 0, pages: 0, questions: 0, bad: [] };
      const road = readingRoad();
      FUN.store('g5', 'reading').unlockAll = true;
      for (const s of road.stops) {
        out.stops++;
        try {
          readingOpenStop(s.id, { quiet: true });
          (s.learn || []).forEach((c, i) => { readingLearn(s.id, i); out.cards++; });
          const n = s.story && s.story.pages ? s.story.pages.length : 0;
          for (let p = 0; p <= n && n; p++) { readingStory(s.id, p); out.pages++; }
          const pack = PACKS.g5.find(p => p.id === 'reading_road');
          pack._readingStop = s.id; currentPack = pack;
          const qs = getQuestions(pack, 'g5');
          if (!qs.length) out.bad.push(s.id + ': empty round');
          questions = qs;
          for (qIdx = 0; qIdx < qs.length; qIdx++) { renderQuestion(); out.questions++; }
        } catch (e) { out.bad.push(s.id + ': ' + e.message); }
      }
      currentPack = null; questions = []; qIdx = 0;
      return out;
    });
    check(r.bad.length === 0, `real content: ${r.stops} stops, ${r.cards} learn cards, ${r.pages} story pages, ${r.questions} questions render` + (r.bad.length ? ' — ' + r.bad.slice(0, 4).join(' | ') : ''));
  } catch (e) { check(false, 'real content run crashed — ' + e.message.split('\n')[0]); }
  check(errors.length === 0, 'real content: no page or console errors' + (errors.length ? ' — ' + errors.slice(0, 3).join(' | ') : ''));
  await ctx.close();
  return log;
}

// ═══════════════════════════════════════════════════════════════
// Each build must load cleanly before anything else runs: a syntax error in a
// spliced module takes the whole app script down with it.
async function preflight(browser) {
  const bad = [];
  for (const f of [HTML, HTML_REVERSED, HTML_NODATA].concat(HAVE_REAL ? [HTML_REAL] : [])) {
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto('file://' + f);
    const ok = await page.evaluate(() => typeof FUN !== 'undefined' && typeof readingOpenMap === 'function' &&
      Object.values(PACKS).every(list => list.some(p => p.id === 'reading_road')));
    if (!ok || errs.length) bad.push(`${path.basename(f)}: ${ok ? '' : 'the app or the module did not load. '}${errs.join(' | ')}`);
    await page.close();
  }
  return bad;
}

(async () => {
  const t0 = Date.now();
  const browser = await chromium.launch({ executablePath: app.CHROMIUM });
  const pre = await preflight(browser);
  if (pre.length) {
    console.log('reading.test: a build does not load —\n  ' + pre.join('\n  '));
    await browser.close();
    console.log('reading: FAIL — a build does not load');
    process.exit(1);
  }
  const SCREENS = [
    { name: 'ipad-touch', w: 820, h: 1180, input: 'touch' },
    { name: 'ipad-mouse', w: 820, h: 1180, input: 'mouse' },
    { name: 'ipad-keys', w: 820, h: 1180, input: 'keys' },
    { name: 'laptop-touch', w: 1440, h: 900, input: 'touch' },
    { name: 'laptop-mouse', w: 1440, h: 900, input: 'mouse' },
    { name: 'laptop-keys', w: 1440, h: 900, input: 'keys' },
  ];
  const PHONE = { name: 'phone-touch', w: 390, h: 844, input: 'touch' };
  const jobs = [];
  const flows = QUICK ? [SCREENS[0], SCREENS[5]] : SCREENS;
  for (const pid of ['k', 'g5']) {
    for (const vp of flows) {
      // Every run plays a whole stop; the land finish, the parent page and a
      // normal round are spread over the runs so each input mode does each.
      const full = vp.name === 'ipad-touch' || vp.name === 'laptop-mouse' || vp.name === 'laptop-keys' || vp.name === 'ipad-keys';
      jobs.push(() => runFlow(browser, vp, pid, { land: full || vp.name === 'laptop-touch', normal: full || vp.name === 'ipad-mouse', parent: true }));
    }
    if (!QUICK) jobs.push(() => runFlow(browser, PHONE, pid, { land: true, normal: false, parent: true }));
  }
  jobs.push(() => runPlacement(browser), () => runBuilds(browser), () => runRealContent(browser));
  // A few at a time; each run's log prints as one block.
  const CONC = 3;
  let next = 0;
  await Promise.all(Array.from({ length: CONC }, async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      const log = await job();
      console.log(log.join('\n'));
    }
  }));
  await browser.close();
  const secs = Math.round((Date.now() - t0) / 1000);
  console.log(`\nscreenshots: tools/${path.relative(app.TOOLS, SHOTS)}/`);
  if (failures.length) console.log('failures:\n  ' + failures.join('\n  '));
  const skipped = HAVE_REAL ? '' : '; skipped the real content (no reading-data module)';
  console.log(`reading: ${failures.length ? 'FAIL' : 'PASS'} — ${passes} checks passed, ${failures.length} failed (${secs}s)${skipped}`);
  process.exit(failures.length ? 1 : 0);
})().catch(e => { console.error(e); console.log('reading: FAIL — crashed: ' + (e && e.message)); process.exit(1); });
