// Family Team Goal — end-to-end test.
//   node modules/family.test.js [app.html] [part,part…]
// On the game file (the repo's, $TT_APP, or the one named), with the family
// module and every other one built in (buddy, stickers, boss, missions,
// reading, sprint): clears localStorage, and for the kindergartener (k) and
// the fifth grader (g5) — on an iPad in portrait (820×1180, touch,
// locator.tap) and a 1440×900 laptop (mouse clicks) — walks every path through
// real rounds of the real engine:
//   the title panel (three-colour meter, "N / 150 ⭐ this week", a key to
//   each child's colour in a fixed order with no per-child numbers, 🔊), the
//   hub card ("you added N this week"), the
//   round-complete strip ("+N ⭐ for the family team"), a round that reaches
//   the goal (celebration, kindergartener hears it), GOAL REACHED on the title
//   with confetti once a week, the parent dashboard (reward + target with
//   validation, each child's stars, "Mark as claimed ✓" and undo, last weeks),
//   persistence across reload, the week rolling over (history, base reset,
//   keep 8), a round running past Sunday midnight, leaving a round early,
//   missions bonus XP counting as stars, and a normal round start to finish.
// Extra passes: the 3rd grader (10 XP a star), keyboard only, a 390px phone,
// reduced motion, an old save with no family data, malformed stored data,
// two tabs, a real speed sprint (when the game has the sprint module) whose
// XP turns into stars (and the sprint that reaches the goal celebrates), a
// double tap on "Mark as claimed ✓", and the pure star arithmetic.
// "fixes" covers what play-testing found: the kindergartener's "goal
// reached" counted as heard only once spoken (and following her to the next
// screen), a background tab catching up instead of saving over a claim,
// the other tab's goal written back to the save, a merge that never invents
// stars or crashes on a broken row, and an emoji-only reward read aloud.
// Fails on any page error, console error, [fun] warning, unexpected dialog,
// horizontal overflow, or a tap target under 44px (56px for anything of this
// module the kindergartener taps — the title panel, her hub card and strip).
// The optional part list (logic, flows, ipad-k, g3, midnight, keyboard, sizes,
// motion, saves, fixes, together, sprint) runs just those parts.
const { chromium } = require('playwright');
const path = require('path');
const app = require('./app');

const HTML = app.APP;
// The suite is for the family module as the game file has it: without it, it fails.
if (!app.has('family')) { console.log('family: FAIL — the game file has no family module'); process.exit(1); }
// The sprint pass: the same game, when it has the sprint module.
const HTML_SPRINT = app.APP;
const HAVE_SPRINT = app.has('sprint');
const SHOTS = app.shots('family');
console.log('app: ' + HTML);

let passes = 0, fails = 0;
const failList = [];
function ok(cond, msg) {
  if (cond) passes++;
  else { fails++; failList.push(msg); console.log('    FAIL ' + msg); }
}
const wait = ms => new Promise(r => setTimeout(r, ms));
// Words that would rank the children or make one feel behind.
const RANKING = /\b(most|top|winner|won|beat|best|ahead|behind|first place|mvp|champion|more than|less than|lazy|only you|lost|missed|fail)\b/i;

const VPS = {
  ipad:   { name: 'ipad',   width: 820,  height: 1180, touch: true },
  laptop: { name: 'laptop', width: 1440, height: 900,  touch: false },
  phone:  { name: 'phone',  width: 390,  height: 844,  touch: true },
  land:   { name: 'ipad-land', width: 1180, height: 820, touch: true },
};
const PER = { k: 5, g3: 10, g5: 15 };

// Wednesday 28 October 2026 at noon, Eastern time; its week starts Monday 26 October.
const DAY = n => new Date(Date.UTC(2026, 9, 28 + n, 16, 0, 0));
const WEEK0 = '2026-10-26', WEEK1 = '2026-11-02', WEEKM1 = '2026-10-19';

async function press(page, vp, loc) {
  await loc.scrollIntoViewIfNeeded();
  if (vp.touch) await loc.tap(); else await loc.click();
  await page.waitForTimeout(450);
}

async function layout(page, vp, pid, label) {
  const r = await page.evaluate(() => {
    const W = document.documentElement.clientWidth;
    const vis = el => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      const b = el.getBoundingClientRect();
      return b.width > 0 && b.height > 0;
    };
    const desc = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
      (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '') +
      ' "' + (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28) + '"';
    const transient = el => el.closest('.fun-confetti, .fun-toast, .trophy-pop, .xp-pop, .streak-pop');
    const over = [];
    for (const el of document.querySelectorAll('body *')) {
      if (transient(el) || !vis(el)) continue;
      const b = el.getBoundingClientRect();
      if (b.right > W + 1 || b.left < -1) over.push(desc(el) + ` [${Math.round(b.left)}..${Math.round(b.right)} of ${W}]`);
    }
    const small = [];
    for (const el of document.querySelectorAll('button, [role=button], [role=checkbox], input')) {
      if (transient(el) || !vis(el)) continue;
      const b = el.getBoundingClientRect();
      const mine = el.closest('.family-panel') ? 'title' : el.closest('.family-card, .family-done') ? 'kid' : el.closest('.family-parent') ? 'parent' : '';
      small.push({ d: desc(el), w: b.width, h: b.height, mine });
    }
    const app = document.getElementById('app');
    return { over, small, docOver: document.documentElement.scrollWidth > W + 1, appOver: app.scrollWidth > app.clientWidth + 1 };
  });
  ok(!r.docOver && !r.appOver, `${label}: page scrolls horizontally`);
  ok(r.over.length === 0, `${label}: elements overflow the viewport: ${r.over.slice(0, 4).join(' | ')}`);
  // The title panel is the kindergartener's too; her hub card and strip are hers.
  const floorOf = s => s.mine === 'title' || (s.mine === 'kid' && pid === 'k') ? 55.5 : 43.5;
  const mineSmall = r.small.filter(s => s.mine && (s.w < floorOf(s) || s.h < floorOf(s)));
  ok(mineSmall.length === 0, `${label}: family tap targets too small: ${mineSmall.map(s => `${s.d} ${Math.round(s.w)}x${Math.round(s.h)}`).join(' | ')}`);
  const appSmall = r.small.filter(s => !s.mine && (s.w < 43.5 || s.h < 43.5));
  if (appSmall.length) console.log(`    note (${label}, other controls under 44px, not this module): ${appSmall.slice(0, 3).map(s => `${s.d} ${Math.round(s.w)}x${Math.round(s.h)}`).join(' | ')}`);
}

// Records speech, sounds and confetti (headless Chromium has no voices).
async function instrument(page) {
  await page.evaluate(() => {
    window.__spoken = [];
    window.speakText = function (t) { window.__spoken.push(String(t)); };
    window.__sounds = [];
    const orig = window.funSound;
    window.funSound = function (n) { window.__sounds.push(n); return orig(n); };
    window.__confetti = [];
    const oc = window.funConfetti;
    window.funConfetti = function (o) { window.__confetti.push(JSON.stringify(o || {})); return oc(o); };
  });
}

async function newPage(browser, vp, dayN, extra, html) {
  const ctx = await browser.newContext(Object.assign({
    viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.touch, deviceScaleFactor: 1, timezoneId: 'America/New_York',
  }, extra || {}));
  ctx.setDefaultTimeout(12000);
  await ctx.addInitScript(require('./together').quietBuddy);   // every module built in: see together.js
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type() === 'error') errors.push('console.error: ' + m.text());
    if (m.type() === 'warning' && /\[fun\]|\[save\]/.test(m.text())) errors.push('warning: ' + m.text());
  });
  page.on('dialog', d => {
    if (d.type() === 'prompt' && /Parent PIN/.test(d.message())) { d.accept('0000').catch(() => {}); return; }
    errors.push('dialog: ' + d.message()); d.dismiss().catch(() => {});
  });
  await page.clock.setSystemTime(DAY(dayN));
  await page.goto('file://' + (html || HTML));
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.family-panel');
  await instrument(page);
  return { ctx, page, errors };
}
async function reloadPage(page) {
  await page.reload();
  await page.waitForSelector('.profile-card');
  await instrument(page);
}

const fam = page => page.evaluate(() => JSON.parse(JSON.stringify(state.family)));
const now = page => page.evaluate(() => { const n = familyNow(); return { kids: n.kids, total: n.total, target: n.target, reached: n.reached, claimed: n.claimed, left: n.left, week: n.f.week, lastOpen: !!n.lastOpen }; });
const text = (page, sel) => page.locator(sel).first().innerText().then(t => t.replace(/\s+/g, ' ').trim());
const kidsOrder = page => page.evaluate(() => [...document.querySelectorAll('.family-panel .family-kid')].map(e => e.getAttribute('aria-label')));
// The shared title screen is a team, not a scoreboard: the key to the meter
// names each child (K, 3rd, 5th) and shows no per-child numbers.
async function noScoreboard(page, label) {
  const r = await page.evaluate(() => ({
    keys: [...document.querySelectorAll('.family-panel .family-kid')].map(e => e.innerText.replace(/\s+/g, ' ').trim()),
    labels: [...document.querySelectorAll('.family-panel .family-kid')].map(e => e.getAttribute('aria-label')),
  }));
  ok(r.keys.length === 3 && /K$/.test(r.keys[0]) && /3rd$/i.test(r.keys[1]) && /5th$/i.test(r.keys[2]) &&
     r.keys.every(k => !/\d+\s*⭐|⭐/.test(k)) && r.labels.every(l => !/\d/.test(l.replace(/3rd|5th/g, ''))),
    `${label}: the title's key names the children with no per-child numbers (${r.keys.join(' | ')})`);
}
// Give the family `stars` more stars for one child (XP straight onto the profile, as any module would).
const addStars = (page, pid, stars) => page.evaluate(([pid, n]) => { state.profiles[pid].xp += n * PROFILES[pid].xpPer; saveState(); }, [pid, stars]);
// Child-facing family text never ranks the children.
async function noRanking(page, label) {
  const t = await page.evaluate(() => [...document.querySelectorAll('.family-panel, .family-card, .family-done')].map(e => e.innerText).join(' \n ') +
    ' \n ' + [...document.querySelectorAll('.family-panel .js-speak, .family-card .js-speak, .family-done .js-speak')].map(b => b.getAttribute('data-speak-text')).join(' \n '));
  const m = t.match(RANKING);
  ok(!m, `${label}: no ranking words for the children (found "${m && m[0]}")`);
}
// The three profile cards are fully on the first screen (the panel never pushes them off).
async function cardsOnScreen(page, label) {
  const r = await page.evaluate(() => {
    document.getElementById('app').scrollTop = 0;
    const H = window.innerHeight;
    return [...document.querySelectorAll('.profile-card')].map(c => { const b = c.getBoundingClientRect(); return b.top >= -1 && b.bottom <= H + 1; });
  });
  ok(r.length === 3 && r.every(Boolean), `${label}: all three profile cards on the first screen (${JSON.stringify(r)})`);
}

const mc = n => ({ type: 'mc', text: `Which one is a fruit? (${n})`, options: ['Apple', 'Rock', 'Shoe', 'Cloud'], correct: 0, why: 'An apple grows on a tree.', hint: 'Which one can you eat?' });
const tf = () => ({ type: 'tf', statement: 'The sun is a star.', answer: true, why: 'The sun is a very hot star.' });

// A round through the real engine with known questions: R right · W wrong (true/false).
//   opts.exitAfter: leave the round before question i.  opts.before(i): run before answering question i.
async function playRound(page, vp, plan, opts) {
  opts = opts || {};
  const qs = plan.map((a, i) => a === 'W' ? tf() : mc(i + 1));
  await page.evaluate(qs => {
    const pk = PACKS[currentProfile.id].find(p => p.tier === 'now' && !p.getQuestions && p.id !== 'think_mix');
    startPack(pk.id);
    questions = qs.map(q => JSON.parse(JSON.stringify(q)));
    qIdx = 0;
    if (!document.querySelector('.briefing-go')) renderQuestion();
  }, qs);
  if (await page.locator('.briefing-go').count()) await press(page, vp, page.locator('.briefing-go'));
  await page.waitForSelector('.question-frame');
  for (let i = 0; i < plan.length; i++) {
    if (opts.exitAfter === i) {
      await press(page, vp, page.locator('.exit-btn'));
      await press(page, vp, page.locator('#exit-modal-exit'));
      await page.waitForSelector('.hub');
      return;
    }
    if (opts.before) await opts.before(i);
    if (plan[i] === 'W') await press(page, vp, page.locator('.false-btn'));
    else {
      const idx = await page.evaluate(() => { const q = questions[qIdx]; return [...document.querySelectorAll('.choice')].findIndex(c => /Apple/.test(c.textContent)); });
      await press(page, vp, page.locator('.choice').nth(Math.max(0, idx)));
    }
    await page.waitForSelector('#fb .next-btn');
    await press(page, vp, page.locator('#fb .next-btn'));
  }
  await page.waitForSelector('.complete');
}
async function backToHub(page, vp) {
  await press(page, vp, page.locator('.complete .next-btn').nth(1));
  await page.waitForSelector('.family-card');
  await closeOverlays(page);
}
// A sticker that arrived outside a round opens over the hub; close it like a child would.
async function closeOverlays(page) {
  await page.waitForTimeout(600);
  if (await page.locator('#stk-overlay').count()) { await page.evaluate(() => { try { stickersCloseOverlay(); } catch (e) {} }); await page.waitForTimeout(300); }
  if (await page.locator('.buddy-overlay, #buddy-overlay').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
}
async function toTitle(page, vp) {
  await closeOverlays(page);
  await press(page, vp, page.locator('.hub-stats .switch-btn', { hasText: 'SWITCH' }));
  await page.waitForSelector('.family-panel');
}
async function pick(page, vp, pid) {
  await press(page, vp, page.locator(`.profile-card[onclick*="'${pid}'"]`));
  await page.waitForSelector('.family-card');
  await closeOverlays(page);
}
async function openParent(page, vp) {
  await page.evaluate(() => { document.getElementById('app').scrollTop = 0; });
  await press(page, vp, page.locator('.parent-link'));
  await page.waitForSelector('.family-parent');
}

// Answer whatever question is showing, correctly, through the UI (any type).
async function answerCorrect(page, vp) {
  const q = await page.evaluate(() => {
    const q = questions[qIdx];
    return { type: q.type || 'mc', correct: q.correct, answer: q.answer, accepted: q.acceptedAnswers, n: (q.items || []).length,
             shuffle: q._shuffle, groups: q.type === 'sort' ? q.items.map(i => i.g) : null,
             pa: q.partA && q.partA.correct, pb: q.partB && q.partB.correct };
  });
  if (q.type === 'mc') await press(page, vp, page.locator('.choice').nth(q.correct));
  else if (q.type === 'tf') await press(page, vp, page.locator(q.answer ? '.true-btn' : '.false-btn'));
  else if (q.type === 'typed' || q.type === 'fib' || q.type === 'showwork') {
    if (q.type === 'showwork') { await page.locator('#workDone').check(); await page.waitForTimeout(150); }
    const v = String(q.accepted[0]);
    if (await page.locator('.numpad-key').count()) {
      for (const ch of v) {
        // A mixed number such as 4 3/4 gets a SPACE key on the pad.
        const idx = await page.evaluate(ch => [...document.querySelectorAll('.numpad-key')].findIndex(k => ch === ' ' ? k.getAttribute('aria-label') === 'SPACE' : k.textContent.trim() === ch), ch);
        if (idx < 0 && ch === ' ') continue;
        await press(page, vp, page.locator('.numpad-key').nth(idx));
      }
    } else await page.locator('#typedInput').fill(v);
    await press(page, vp, page.locator('.typed-submit'));
  } else if (q.type === 'order') {
    for (let pos = 0; pos < q.n; pos++) {
      const idx = await page.evaluate(pos => { const q = questions[qIdx]; return q._shuffle.filter(i => !qState.slots.includes(i)).indexOf(pos); }, pos);
      await press(page, vp, page.locator('.order-item').nth(idx));
    }
    await press(page, vp, page.locator('.puzzle-check'));
  } else if (q.type === 'sort') {
    for (let r = 0; r < q.shuffle.length; r++) await press(page, vp, page.locator('.sort-row').nth(r).locator('.sort-btn').nth(q.groups[q.shuffle[r]]));
    await press(page, vp, page.locator('.puzzle-check'));
  } else if (q.type === 'multi') {
    for (const i of q.correct) await press(page, vp, page.locator('.choice').nth(i));
    await press(page, vp, page.locator('.puzzle-check'));
  } else if (q.type === 'twopart') {
    await press(page, vp, page.locator('.part-choice[data-part="A"]').nth(q.pa));
    await page.waitForTimeout(300);
    await press(page, vp, page.locator('.part-choice[data-part="B"]').nth(q.pb));
  }
  return q.type;
}

// ═══════════════════════════════════════════════════════════════
// The arithmetic and the data, without any UI
// ═══════════════════════════════════════════════════════════════
async function logicChecks(browser) {
  console.log('\n▶ logic');
  const { ctx, page, errors } = await newPage(browser, VPS.laptop, 0);
  let f = await fam(page);
  ok(f.reward === 'Family movie night 🎬' && f.target === 150, 'defaults: Family movie night 🎬, 150 stars');
  ok(f.week === WEEK0 && JSON.stringify(f.history) === '[]' && f.claimedWeek === '', 'defaults: this week, no history, nothing claimed');
  ok(f.base.k === 0 && f.base.g3 === 0 && f.base.g5 === 0, 'defaults: base is each child\'s XP');
  ok(await page.evaluate(() => JSON.parse(localStorage.getItem(STORAGE_KEY)).family.target) === 150, 'the family goal is saved with the game');

  // Stars, not XP: one question's worth of XP for that child's grade.
  await page.evaluate(() => { state.profiles.k.xp = 200; state.profiles.g3.xp = 320; state.profiles.g5.xp = 600; });
  let n = await now(page);
  ok(n.kids.k === 40 && n.kids.g3 === 32 && n.kids.g5 === 40 && n.total === 112, `stars: 200/5 + 320/10 + 600/15 = 112 (got ${JSON.stringify(n.kids)} ${n.total})`);
  ok(n.left === 38 && !n.reached, '38 to go, not reached');
  await page.evaluate(() => { state.profiles.k.xp += 7; state.profiles.g5.xp += 14; });
  n = await now(page);
  ok(n.kids.k === 41 && n.kids.g5 === 40, 'part stars round down (k +7 XP = +1 star, g5 +14 XP = +0)');
  await page.evaluate(() => { state.profiles.k.xp = 207; state.profiles.g5.xp = 600; });

  // XP below the base (a reset) starts again from there: never negative.
  await page.evaluate(() => { state.family.base.g3 = 500; });
  n = await now(page);
  ok(n.kids.g3 === 0 && (await fam(page)).base.g3 === 320, 'a base above the XP is repaired: 0 stars, base = XP');
  await page.evaluate(() => { state.family.base.g3 = 0; });

  // Malformed data is repaired, not trusted.
  const repaired = await page.evaluate(() => {
    const out = {};
    state.family = 'garbage'; familyState(); out.str = JSON.parse(JSON.stringify(state.family));
    state.family = [1, 2]; familyState(); out.arr = Array.isArray(state.family) ? 'array' : state.family.reward;
    state.family = { reward: 42, target: 'lots', week: 'soon', base: [1], history: 'x', claimedWeek: 5, cheered: {}, told: null };
    familyState(); out.bad = JSON.parse(JSON.stringify(state.family));
    state.family.target = 5000; familyState(); out.big = state.family.target;
    state.family.target = 3; familyState(); out.small = state.family.target;
    state.family.target = '200'; familyState(); out.str200 = state.family.target;
    state.family.target = 149.6; familyState(); out.frac = state.family.target;
    state.family.reward = '  Pizza\n\tparty   🍕  ' + 'x'.repeat(80); familyState(); out.reward = state.family.reward;
    state.family.reward = '   '; familyState(); out.blank = state.family.reward;
    state.family.base = { k: 'NaN', g3: -5, g5: null }; familyState(); out.base = JSON.parse(JSON.stringify(state.family.base));
    state.family.history = [null, { week: 'x' }, { week: '2026-10-12', k: 3, g3: '7', g5: -2, target: 'q' }, ...Array.from({ length: 12 }, (_, i) => ({ week: '2026-0' + (1 + (i % 9)) + '-05', k: 1, g3: 1, g5: 1, target: 10, claimed: 'yes' }))];
    familyState(); out.hist = JSON.parse(JSON.stringify(state.family.history));
    return out;
  });
  ok(repaired.str.reward === 'Family movie night 🎬' && repaired.str.target === 150 && repaired.str.week === WEEK0, 'a string instead of the goal is replaced by a fresh goal');
  ok(repaired.arr === 'Family movie night 🎬', 'an array instead of the goal is replaced');
  ok(repaired.bad.reward === 'Family movie night 🎬' && repaired.bad.target === 150 && repaired.bad.week === WEEK0 &&
     Array.isArray(repaired.bad.history) && repaired.bad.claimedWeek === '' && repaired.bad.cheered === '' && repaired.bad.told === '' &&
     repaired.bad.base.k === 207 && repaired.bad.base.g5 === 600, 'every malformed field is repaired');
  ok(repaired.big === 1000 && repaired.small === 10 && repaired.str200 === 200 && repaired.frac === 150, `targets are kept to 10-1000 whole stars (${repaired.big}, ${repaired.small}, ${repaired.str200}, ${repaired.frac})`);
  ok(repaired.reward === 'Pizza party 🍕 ' + 'x'.repeat(44) || (Array.from(repaired.reward).length <= 60 && /^Pizza party 🍕 x+$/.test(repaired.reward)), `a reward is one clean line of at most 60 characters ("${repaired.reward}")`);
  ok(repaired.blank === 'Family movie night 🎬', 'a blank reward goes back to the default');
  ok(repaired.base.k === 207 && repaired.base.g3 === 320 && repaired.base.g5 === 600, 'unreadable bases count from now');
  ok(repaired.hist.length === 8 && repaired.hist.every(h => /^\d{4}-\d{2}-\d{2}$/.test(h.week) && h.claimed === false && h.total === h.k + h.g3 + h.g5), 'history: bad rows dropped, 8 kept, totals recomputed');

  // The week rolls over: last week's totals into history, base = XP now.
  const roll = await page.evaluate(() => {
    state.family = null; state.profiles.k.xp = 100; state.profiles.g3.xp = 100; state.profiles.g5.xp = 150;
    familyState();
    state.profiles.k.xp += 50; state.profiles.g3.xp += 90; state.profiles.g5.xp += 300;    // 10 + 9 + 20 = 39
    state.family.week = '2026-10-19';
    state.family.claimedWeek = '2026-10-19';
    familySeen = null;
    const f = familyState();
    return { hist: JSON.parse(JSON.stringify(f.history)), base: JSON.parse(JSON.stringify(f.base)), week: f.week, stars: familyNow().total };
  });
  ok(roll.week === WEEK0 && roll.hist.length === 1, 'new week: one history row');
  const h0 = roll.hist[0] || {};
  ok(h0.week === WEEKM1 && h0.k === 10 && h0.g3 === 9 && h0.g5 === 20 && h0.total === 39 && h0.target === 150 && h0.reached === false && h0.claimed === true,
    `new week: last week's totals recorded (${JSON.stringify(h0)})`);
  ok(roll.base.k === 150 && roll.base.g3 === 190 && roll.base.g5 === 450 && roll.stars === 0, 'new week: base = every child\'s XP, so this week starts at 0');
  const keep = await page.evaluate(() => {
    for (let i = 0; i < 11; i++) { state.family.week = ['2025-01-06', '2025-02-03', '2025-03-03', '2025-04-07', '2025-05-05', '2025-06-02', '2025-07-07', '2025-08-04', '2025-09-01', '2025-10-06', '2025-11-03'][i]; familySeen = null; familyState(); }
    return state.family.history.map(h => h.week);
  });
  ok(keep.length === 8 && keep[7] === '2025-11-03', `history keeps the newest 8 weeks (${keep.join(',')})`);
  // A clock that went backwards records nothing and keeps counting.
  const back = await page.evaluate(() => {
    state.profiles.k.xp += 25;
    const before = familyNow().total;
    const h = state.family.history.length;
    state.family.week = '2027-03-01';
    const f = familyState();
    return { same: f.history.length === h, week: f.week, stars: familyNow().total, before };
  });
  ok(back.same && back.week === WEEK0 && back.stars === back.before && back.stars === 5, 'a clock set back: nothing recorded, stars kept');
  // Never ranked: the panel lists K, 3rd, 5th in that order whoever has the most.
  for (const top of ['g5', 'k', 'g3']) {
    await page.evaluate(top => { state.family = null; familyState(); state.profiles[top].xp += 100 * PROFILES[top].xpPer; renderProfileSelect(); }, top);
    const order = await kidsOrder(page);
    ok(order.length === 3 && /^kindergarten/.test(order[0]) && /^3rd/.test(order[1]) && /^5th/.test(order[2]), `children in a fixed order when ${top} has the most (${order.join(' | ')})`);
  }
  await noRanking(page, 'logic title');
  ok(errors.length === 0, `logic: no page/console errors: ${errors.slice(0, 5).join(' | ')}`);
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════
// One child on one device: every path
// ═══════════════════════════════════════════════════════════════
async function runFlow(browser, vp, pid) {
  const tag = `${vp.name}-${pid}`;
  console.log(`\n▶ ${tag}`);
  const { ctx, page, errors } = await newPage(browser, vp, 0);
  const isK = pid === 'k';
  const other = isK ? 'g5' : 'k';
  let shotN = 0;
  const shot = async (name, full) => page.screenshot({ path: path.join(SHOTS, `${tag}-${String(++shotN).padStart(2, '0')}-${name}.png`), fullPage: !!full });

  // ── 1. Title screen, fresh ──
  let t = await text(page, '.family-panel');
  ok(/FAMILY TEAM GOAL/.test(t) && /Family movie night 🎬/.test(t), 'title: panel with the reward');
  ok(/0 \/ 150 ⭐ this week/.test(t), `title: 0 / 150 ⭐ this week (${t.slice(0, 120)})`);
  ok(/Every right answer adds a ⭐/.test(t), 'title: how to fill it, when empty');
  ok(await page.locator('.family-panel .family-seg').count() === 0, 'title: an empty meter');
  ok(await page.locator('.family-panel .family-kid').count() === 3, 'title: a key to each child\'s colour');
  await noScoreboard(page, `${tag} title fresh`);
  await layout(page, vp, pid, `${tag} title`);
  if (vp.name === 'ipad' || vp.name === 'laptop') await cardsOnScreen(page, `${tag} title`);
  await page.evaluate(() => { window.__spoken = []; });
  await press(page, vp, page.locator('.family-panel .js-speak'));
  ok(await page.evaluate(() => window.__spoken.some(s => /Family team goal/.test(s) && /150 stars/.test(s) && !/\d\/\d/.test(s))), 'title: 🔊 reads the goal aloud (no "/" read as a fraction)');
  await shot('title-fresh');

  // ── 2. Some stars from everyone ──
  await page.evaluate(() => { state.profiles.k.xp += 200; state.profiles.g3.xp += 320; state.profiles.g5.xp += 600; saveState(); renderProfileSelect(); });
  await page.waitForTimeout(1500);
  t = await text(page, '.family-panel');
  ok(/112 \/ 150 ⭐ this week/.test(t), 'title: 112 / 150 ⭐ this week');
  ok(/38 more ⭐ to go/.test(t), 'title: 38 more to go');
  const segs = await page.evaluate(() => [...document.querySelectorAll('.family-panel .family-seg')].map(s => ({ w: s.getBoundingClientRect().width, c: s.getAttribute('style') })));
  const meterW = await page.evaluate(() => document.querySelector('.family-panel .family-meter').clientWidth);
  ok(segs.length === 3 && /--p-k/.test(segs[0].c) && /--p-g3/.test(segs[1].c) && /--p-g5/.test(segs[2].c), 'title: three segments in each child\'s colour, K then 3rd then 5th');
  const sum = segs.reduce((a, s) => a + s.w, 0);
  ok(Math.abs(sum / meterW - 112 / 150) < 0.03, `title: the meter is ${Math.round(sum / meterW * 100)}% full (112 of 150)`);
  const chips = await kidsOrder(page);
  ok(/^kindergarten$/.test(chips[0]) && /^3rd grade$/.test(chips[1]) && /^5th grade$/.test(chips[2]), `title: the key, K then 3rd then 5th (${chips.join(' | ')})`);
  // 40, 32 and 40 stars are in the meter, never printed beside each child on the shared screen.
  ok(!/\b(40|32)\s*⭐/.test(t), 'title: no child\'s own count on the shared screen');
  await noScoreboard(page, `${tag} title 112`);
  await noRanking(page, `${tag} title`);
  await layout(page, vp, pid, `${tag} title 112`);
  if (vp.name === 'ipad' || vp.name === 'laptop') await cardsOnScreen(page, `${tag} title 112`);
  await shot('title-112');

  // ── 3. The hub card ──
  await pick(page, vp, pid);
  const zone = await page.evaluate(() => [...document.querySelectorAll('.fun-zone > .fun-card')].map(c => c.className));
  ok(zone.length >= 2 && /family-card/.test(zone[zone.length - 1]), `hub: the TEAM GOAL card is in the play zone, last (order 60) (${zone.length} cards)`);
  t = await text(page, '.family-card');
  ok(/TEAM GOAL/.test(t) && /112\/150 ⭐/.test(t), 'hub: TEAM GOAL 112/150 ⭐');
  ok(/You added 40 ⭐ this week!/.test(t), `hub: you added 40 this week (${t})`);
  ok(await page.locator('.family-card .js-speak').count() === (isK ? 1 : 0), 'hub: a 🔊 for the kindergartener only');
  if (isK) {
    await page.evaluate(() => { window.__spoken = []; });
    await press(page, vp, page.locator('.family-card .js-speak'));
    ok(await page.evaluate(() => window.__spoken.some(s => /Team goal/.test(s) && /You added 40 stars/.test(s))), 'hub: k hears the goal and her 40 stars');
  }
  await noRanking(page, `${tag} hub`);
  await page.locator('.family-card').scrollIntoViewIfNeeded();
  await layout(page, vp, pid, `${tag} hub`);
  await shot('hub-card');

  // ── 4. A round adds stars: "+N ⭐ for the family team" ──
  const xp0 = await page.evaluate(pid => state.profiles[pid].xp, pid);
  const st0 = (await now(page)).kids[pid];
  await playRound(page, vp, ['R', 'R', 'R', 'R', 'W']);
  await page.waitForTimeout(400);
  const xp1 = await page.evaluate(pid => state.profiles[pid].xp, pid);
  const st1 = (await now(page)).kids[pid];
  ok(st1 - st0 === Math.floor((xp1 - 0) / PER[pid]) - Math.floor((xp0 - 0) / PER[pid]) && st1 - st0 >= 4, `round: stars follow XP (${xp0}→${xp1} XP, ${st0}→${st1} stars)`);
  t = await text(page, '.family-done');
  ok(new RegExp(`\\+${st1 - st0} ⭐ for the family team!`).test(t), `complete: +${st1 - st0} ⭐ for the family team (${t})`);
  ok(new RegExp(`${112 + st1 - st0} / 150 ⭐`).test(t), 'complete: the team total');
  ok(await page.locator('.family-done .js-speak').count() === (isK ? 1 : 0), 'complete: a 🔊 for the kindergartener only');
  await page.locator('.family-done').scrollIntoViewIfNeeded();
  await layout(page, vp, pid, `${tag} complete`);
  await noRanking(page, `${tag} complete`);
  await shot('complete-added');
  await backToHub(page, vp);
  t = await text(page, '.family-card');
  ok(new RegExp(`You added ${40 + st1 - st0} ⭐ this week!`).test(t), `hub after: you added ${40 + st1 - st0} (${t})`);

  // ── 5. Leaving a round early still counts the answers given ──
  const st2 = (await now(page)).kids[pid];
  await playRound(page, vp, ['R', 'R', 'R', 'R'], { exitAfter: 2 });
  const st3 = (await now(page)).kids[pid];
  ok(st3 - st2 >= 2, `left early: the 2 right answers still count (${st2}→${st3})`);
  await page.waitForSelector('.family-card');
  ok(new RegExp(`You added ${st3} ⭐`).test(await text(page, '.family-card')), 'left early: the hub card shows them');

  // ── 6. Missions bonus XP counts too ──
  const before = await now(page);
  const bonus = await page.evaluate(pid => {
    if (typeof missionsStore !== 'function') return null;
    const s = missionsStore(pid);
    s.bonus = false;
    const xp = state.profiles[pid].xp;
    s.ids = ['rounds1', 'inarow3', 'rounds2']; s.done = []; s.c = missionsNewCounters(); s.c.rounds = 5; s.c.run = 5;
    missionsCheck(pid);
    return state.profiles[pid].xp - xp;
  }, pid);
  await closeOverlays(page);
  const after = await now(page);
  ok(bonus === PER[pid] * 3 && after.kids[pid] - before.kids[pid] === 3, `missions bonus (${bonus} XP) adds ${after.kids[pid] - before.kids[pid]} stars`);
  ok(new RegExp(`You added ${after.kids[pid]} ⭐`).test(await text(page, '.family-card')), 'missions bonus: the hub card updates in place');
  await closeOverlays(page);

  // ── 7. The round that reaches the goal ──
  // The brother or sister brings the team to 3 short; this child's round finishes it.
  let cur = await now(page);
  await addStars(page, other, cur.target - 3 - cur.total);
  await page.evaluate(() => { window.__spoken = []; window.__sounds = []; window.__confetti = []; renderHub(); });
  await closeOverlays(page);
  ok((await now(page)).left === 3, 'set up: 3 stars to go');
  ok(/3 to go|You added/.test(await text(page, '.family-card')), 'hub: still counting');
  await playRound(page, vp, ['R', 'R', 'R', 'R', 'W']);
  await page.waitForTimeout(1900);
  cur = await now(page);
  ok(cur.reached && !cur.claimed, 'the goal is reached');
  t = await text(page, '.family-done');
  ok(/🎉 TEAM GOAL REACHED!/.test(t) && /Show a grown-up to claim: Family movie night 🎬/.test(t), `complete: TEAM GOAL REACHED (${t})`);
  ok(await page.evaluate(() => window.__sounds.includes('levelup')), 'complete: a fanfare');
  ok(await page.evaluate(() => window.__confetti.some(c => /🎬/.test(c))), 'complete: confetti with the reward\'s emoji');
  if (isK) {
    await page.waitForTimeout(2500);
    ok(await page.evaluate(() => window.__spoken.some(s => /reached the team goal/.test(s))), 'complete: k hears that the family reached the goal');
    ok((await fam(page)).told === WEEK0, 'k is told once this week');
  }
  await noRanking(page, `${tag} reached`);
  await page.locator('.family-done').scrollIntoViewIfNeeded();
  await layout(page, vp, pid, `${tag} complete reached`);
  await shot('complete-reached');
  await backToHub(page, vp);
  t = await text(page, '.family-card');
  ok(/GOAL REACHED!/.test(t) && /Show a grown-up/.test(t), 'hub: GOAL REACHED');
  await page.locator('.family-card').scrollIntoViewIfNeeded();
  await shot('hub-reached');
  // Another round after the goal: no second celebration.
  await page.evaluate(() => { window.__sounds = []; window.__confetti = []; });
  await playRound(page, vp, ['R', 'R']);
  await page.waitForTimeout(1600);
  t = await text(page, '.family-done');
  ok(!/TEAM GOAL REACHED/.test(t) && /goal reached ✓/.test(t), 'complete: later rounds just add to it');
  ok(!(await page.evaluate(() => window.__sounds.includes('levelup'))), 'complete: no second fanfare');
  await backToHub(page, vp);

  // ── 8. The title screen celebrates once a week ──
  await page.evaluate(() => { window.__confetti = []; window.__sounds = []; window.__spoken = []; });
  await toTitle(page, vp);
  await page.waitForTimeout(400);
  t = await text(page, '.family-panel');
  ok(/GOAL REACHED!/.test(t) && /Show a grown-up to claim: Family movie night 🎬/.test(t), `title: GOAL REACHED! Show a grown-up to claim: <reward> (${t.slice(0, 160)})`);
  ok(await page.locator('.family-panel.is-reached').count() === 1, 'title: the panel turns gold');
  ok(await page.evaluate(() => window.__confetti.length === 1 && document.querySelectorAll('.fun-confetti').length >= 1), 'title: confetti the first time it is seen this week');
  ok((await fam(page)).cheered === WEEK0, 'title: the celebration is remembered for this week');
  await page.evaluate(() => { window.__spoken = []; });
  await press(page, vp, page.locator('.family-panel .js-speak'));
  ok(await page.evaluate(() => window.__spoken.some(s => /reached the team goal/.test(s) && /Show a grown-up/.test(s))), 'title: 🔊 says the goal is reached');
  await layout(page, vp, pid, `${tag} title reached`);
  if (vp.name === 'ipad' || vp.name === 'laptop') await cardsOnScreen(page, `${tag} title reached`);
  await noRanking(page, `${tag} title reached`);
  await shot('title-reached');
  await pick(page, vp, other);
  await page.evaluate(() => { window.__confetti = []; });
  await toTitle(page, vp);
  await page.waitForTimeout(400);
  ok(await page.evaluate(() => window.__confetti.length === 0), 'title: no confetti the second time this week');

  // ── 9. The parent dashboard, through the real PIN gate ──
  await openParent(page, vp);
  t = await text(page, '.family-parent');
  ok(/Family Team Goal/.test(t) && /Family total/.test(t), 'parent: the family block');
  cur = await now(page);
  ok(new RegExp(`${cur.total} / 150 ⭐`).test(t), 'parent: the family total');
  for (const p of ['k', 'g3', 'g5']) ok(t.includes(`${cur.kids[p]} ⭐`), `parent: ${p}'s stars this week`);
  ok(/Goal reached!/.test(t), 'parent: says the goal is reached');
  // How stars work, accurately: only the XP sources this build has, and Explore Any Grade's rate.
  const has = await page.evaluate(() => ({ sprint: typeof sprintStart === 'function', boss: typeof bossStart === 'function', missions: typeof missionsDef === 'function' }));
  ok(/Every kind of XP counts: rounds/.test(t) && /boss battles/.test(t) === has.boss && /daily-missions bonus/.test(t) === has.missions && /speed sprints/.test(t) === has.sprint,
    `parent: lists only the XP sources this build has (${JSON.stringify(has)})`);
  ok(/Explore Any\s+Grade\) is worth that grade's XP/.test(t) && /about half a star/.test(t), 'parent: says another grade\'s pack is worth that grade\'s XP, and a second try about half a star');
  ok(/their own stars only, never a ranking/.test(t), 'parent: says what the children see');
  ok(/count starts again each Monday \(the reward and target stay until you change them\)/.test(t), 'parent: says the count restarts on Monday but the goal stays');
  ok(await page.locator('#family-claim:not([disabled])').count() === 1, 'parent: "Mark as claimed ✓" is ready');
  // The button says what it does (a green "Mark as claimed ✓" read as if it were already claimed).
  ok(/^Mark as claimed ✓$/i.test(await text(page, '#family-claim')) && /Press it once/.test(await text(page, '.family-parent-claim')), `parent: the claim button is an action, "Mark as claimed ✓" (${await text(page, '#family-claim')})`);
  await page.locator('.family-parent').scrollIntoViewIfNeeded();
  await layout(page, vp, pid, `${tag} parent`);
  await shot('parent');
  // Validation: nothing saved until both fields are right.
  const fill = async (id, v) => { await page.locator(id).fill(v); };
  // A number box sanitises what it is given ("abc" reads as ""), so the values are set directly here.
  const put = (id, v) => page.evaluate(([id, v]) => { document.querySelector(id).value = v; }, [id, v]);
  for (const [reward, target, re] of [['', '200', /type a reward/], ['   ', '200', /type a reward/], ['Pizza party 🍕', '5', /10 to 1000/], ['Pizza party 🍕', '1001', /10 to 1000/], ['Pizza party 🍕', '12.5', /whole number/], ['Pizza party 🍕', '-20', /10 to 1000/], ['Pizza party 🍕', 'abc', /10 to 1000/], ['Pizza party 🍕', '', /10 to 1000/],
                                   // Too long: refused and explained, never silently cut off.
                                   ['Pizza party at the Annapolis harbor with all of the cousins 🍕🎉', '200', /keep the reward to 60 characters \(it has 6[1-9]\)/]]) {
    await put('#family-reward', reward); await put('#family-target', target);
    await press(page, vp, page.locator('#family-save'));
    const msg = await text(page, '#family-saved');
    const f = await fam(page);
    ok(re.test(msg) && f.reward === 'Family movie night 🎬' && f.target === 150, `parent: "${reward}" / "${target}" is refused (${msg})`);
  }
  ok(await page.locator('[aria-invalid="true"]').count() === 1, 'parent: the field to fix is marked');
  ok(Number(await page.locator('#family-reward').getAttribute('maxlength')) > 60, 'parent: the reward box lets a grown-up type past 60, so a long reward is explained, not cut off'); 
  await shot('parent-invalid');
  await fill('#family-reward', '  Pizza party 🍕  '); await fill('#family-target', '300');
  await press(page, vp, page.locator('#family-save'));
  let f = await fam(page);
  ok(f.reward === 'Pizza party 🍕' && f.target === 300, 'parent: reward and target saved');
  ok(/Saved/.test(await text(page, '#family-saved')), 'parent: says saved');
  ok(await page.locator('#family-claim').count() === 0 && /appears here once the goal is reached/.test(await text(page, '.family-parent-claim')), 'parent: with a higher target the goal is not reached, claim waits');
  await fill('#family-target', '150');
  await press(page, vp, page.locator('#family-save'));
  ok((await fam(page)).target === 150, 'parent: target back to 150');
  await press(page, vp, page.locator('#family-claim'));
  f = await fam(page);
  ok(f.claimedWeek === WEEK0, 'parent: Mark as claimed ✓ marks this week');
  ok(/claimed for this week/.test(await text(page, '.family-parent')) && await page.locator('#family-unclaim').count() === 1, 'parent: shows claimed, with undo');
  await press(page, vp, page.locator('#family-unclaim'));
  ok((await fam(page)).claimedWeek === '', 'parent: undo');
  // A grown-up's quick double tap on "Mark as claimed ✓": the undo button takes
  // its place, and the second tap must not undo the claim.
  await page.locator('#family-claim').scrollIntoViewIfNeeded();
  const cb = await page.locator('#family-claim').boundingBox();
  const cx = cb.x + cb.width / 2, cy = cb.y + cb.height / 2;
  if (vp.touch) await page.touchscreen.tap(cx, cy); else await page.mouse.click(cx, cy);
  const under = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e && e.closest('button') ? e.closest('button').id : ''; }, [cx, cy]);
  await page.waitForTimeout(120);
  if (vp.touch) await page.touchscreen.tap(cx, cy); else await page.mouse.click(cx, cy);
  await page.waitForTimeout(450);
  ok(under === 'family-unclaim', `parent: after the claim, the undo button is under the finger (${under})`);
  ok((await fam(page)).claimedWeek === WEEK0 && await page.locator('#family-unclaim').count() === 1, 'parent: a double tap on "Mark as claimed ✓" claims once and does not undo it');
  await page.locator('.family-parent').scrollIntoViewIfNeeded();
  await layout(page, vp, pid, `${tag} parent claimed`);
  await shot('parent-claimed');
  await press(page, vp, page.locator('.parent-dash > .switch-btn').first());
  await page.waitForSelector('.family-panel');
  t = await text(page, '.family-panel');
  ok(/✓ CLAIMED!/.test(t) && /Enjoy Pizza party 🍕/.test(t) && /a fresh bar on Monday/.test(t), 'title: claimed, enjoy the reward, a fresh bar on Monday (the same goal, counted again)');
  await shot('title-claimed');

  // ── 10. Persistence across reload ──
  const keepXp = await page.evaluate(() => Object.fromEntries(Object.keys(state.profiles).map(p => [p, state.profiles[p].xp])));
  const keepNow = await now(page);
  await reloadPage(page);
  f = await fam(page);
  const n2 = await now(page);
  ok(f.reward === 'Pizza party 🍕' && f.target === 150 && f.claimedWeek === WEEK0 && f.cheered === WEEK0, 'reload: the goal, the claim and the celebration are kept');
  ok(JSON.stringify(n2.kids) === JSON.stringify(keepNow.kids) && n2.total === keepNow.total, 'reload: this week\'s stars are the same');
  ok(await page.evaluate(k => Object.keys(state.profiles).every(p => state.profiles[p].xp === k[p]), keepXp), 'reload: XP untouched');
  ok(/✓ CLAIMED!/.test(await text(page, '.family-panel')), 'reload: the title still shows it');
  await page.waitForTimeout(300);
  ok(await page.locator('.fun-confetti').count() === 0, 'reload: no confetti again');

  // ── 11. Next week: history, a fresh meter, nothing taken away ──
  await page.clock.setSystemTime(DAY(7));
  await reloadPage(page);
  await page.waitForTimeout(300);
  f = await fam(page);
  ok(f.week === WEEK1 && f.history.length === 1, 'next week: last week went into history');
  const h = f.history[0] || {};
  ok(h.week === WEEK0 && h.total === keepNow.total && h.k === keepNow.kids.k && h.g3 === keepNow.kids.g3 && h.g5 === keepNow.kids.g5 && h.reached && h.claimed && h.reward === 'Pizza party 🍕',
    `next week: last week's totals (${JSON.stringify(h)})`);
  ok(await page.evaluate(k => Object.keys(state.profiles).every(p => state.profiles[p].xp === k[p] && state.family.base[p] === k[p]), keepXp), 'next week: XP kept, base = XP');
  t = await text(page, '.family-panel');
  ok(/0 \/ 150 ⭐ this week/.test(t) && !/GOAL REACHED/.test(t), 'next week: a fresh meter');
  ok(!/Last week/.test(t), 'next week: a claimed last week needs no reminder');
  await pick(page, vp, pid);
  ok(/Every right answer adds a ⭐ for the team!/.test(await text(page, '.family-card')), 'next week: the hub card starts over kindly');
  await openParent(page, vp);
  t = await text(page, '.family-parent');
  ok(/Oct 26 – Nov 1/.test(t) && new RegExp(`${keepNow.total} / 150 ⭐ · reached · claimed ✓`).test(t), `parent: last week in the past weeks list`);
  await page.locator('.family-hist-row').first().scrollIntoViewIfNeeded();
  await shot('parent-history');

  // ── 12. Reached but not claimed last week: a gentle reminder, and the grown-up can claim it late ──
  await page.evaluate(() => {
    state.family.history[state.family.history.length - 1].claimed = false;
    saveState(); renderProfileSelect();
  });
  t = await text(page, '.family-panel');
  ok(/Last week's goal was reached too! Ask a grown-up about: Pizza party 🍕/.test(t), 'title: last week\'s unclaimed reward is remembered');
  await layout(page, vp, pid, `${tag} title last week`);
  if (vp.name === 'ipad' || vp.name === 'laptop') await cardsOnScreen(page, `${tag} title last week`);
  await shot('title-last-week');
  await openParent(page, vp);
  ok(await page.locator('#family-claim-last').count() === 1, 'parent: last week can be claimed late');
  await press(page, vp, page.locator('#family-claim-last'));
  f = await fam(page);
  ok(f.history[f.history.length - 1].claimed === true && f.claimedWeek === WEEK0, 'parent: last week marked claimed, this week untouched');
  ok(await page.locator('#family-claim-last').count() === 0, 'parent: the late claim is done');

  // ── 13. A normal round, start to finish, the app's own way ──
  await press(page, vp, page.locator('.parent-dash > .switch-btn').first());
  await pick(page, vp, pid);
  await page.evaluate(() => { document.getElementById('app').scrollTop = 0; });
  await press(page, vp, page.locator('.pack-card').first());
  if (await page.locator('.briefing-go').count()) await press(page, vp, page.locator('.briefing-go'));
  await page.waitForSelector('.question-frame');
  const total = await page.evaluate(() => questions.length);
  for (let i = 0; i < total; i++) {
    await answerCorrect(page, vp);
    await page.waitForSelector('#fb .next-btn');
    await press(page, vp, page.locator('#fb .next-btn'));
  }
  await page.waitForSelector('.complete');
  ok(total === 10, 'normal round has 10 questions');
  ok(/ROUND \d+ DONE/.test(await page.locator('.complete-title').innerText()), 'normal round reaches the complete screen');
  t = await text(page, '.family-done');
  const mine = (await now(page)).kids[pid];
  ok(new RegExp(`\\+${mine} ⭐ for the family team!`).test(t) && mine >= 10, `normal round: +${mine} ⭐ for the family team (${t})`);
  await page.locator('.family-done').scrollIntoViewIfNeeded();
  await shot('normal-complete');
  await backToHub(page, vp);

  ok(errors.length === 0, `${tag}: no page/console errors: ${errors.slice(0, 5).join(' | ')}`);
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════
// The 3rd grader: 10 XP a star
// ═══════════════════════════════════════════════════════════════
async function runG3(browser) {
  const tag = 'laptop-g3';
  console.log(`\n▶ ${tag}`);
  const vp = VPS.laptop;
  const { ctx, page, errors } = await newPage(browser, vp, 0);
  await pick(page, vp, 'g3');
  ok(/Every right answer adds a ⭐ for the team!/.test(await text(page, '.family-card')), 'g3 hub: an empty week');
  ok(await page.locator('.family-card .js-speak').count() === 0, 'g3 hub: no 🔊 (reads on their own)');
  await playRound(page, vp, ['R', 'R', 'R']);
  const xp = await page.evaluate(() => state.profiles.g3.xp);
  const n = await now(page);
  ok(n.kids.g3 === Math.floor(xp / 10) && n.kids.g3 >= 3, `g3: ${xp} XP = ${n.kids.g3} stars`);
  ok(new RegExp(`\\+${n.kids.g3} ⭐ for the family team!`).test(await text(page, '.family-done')), 'g3 complete: stars for the team');
  await page.screenshot({ path: path.join(SHOTS, `${tag}-01-complete.png`) });
  await backToHub(page, vp);
  ok(new RegExp(`You added ${n.kids.g3} ⭐ this week!`).test(await text(page, '.family-card')), 'g3 hub: you added');
  await page.locator('.family-card').scrollIntoViewIfNeeded();
  await layout(page, vp, 'g3', `${tag} hub`);
  await page.screenshot({ path: path.join(SHOTS, `${tag}-02-hub.png`) });
  await toTitle(page, vp);
  const chips = await kidsOrder(page);
  ok(chips[1] === '3rd grade' && !new RegExp(`\\b${n.kids.g3}\\s*⭐`).test(await text(page, '.family-panel .family-kids')), 'g3: the title keys the 3rd grader in the middle, without a count of their own');
  await noScoreboard(page, `${tag} title`);
  ok(errors.length === 0, `${tag}: no page/console errors: ${errors.slice(0, 5).join(' | ')}`);
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════
// A round that runs past Sunday midnight puts each answer in its own week
// ═══════════════════════════════════════════════════════════════
async function runMidnight(browser) {
  const tag = 'midnight-g5';
  console.log(`\n▶ ${tag}`);
  const vp = VPS.laptop;
  const { ctx, page, errors } = await newPage(browser, vp, 0);
  // Sunday 1 November 2026, 11:58 pm Eastern (standard time from 2 am that day).
  await page.clock.setSystemTime(new Date(Date.UTC(2026, 10, 2, 4, 58, 0)));
  await reloadPage(page);
  await page.waitForSelector('.family-panel');
  ok((await fam(page)).week === WEEK0, 'Sunday night is still this week');
  await pick(page, vp, 'g5');
  await playRound(page, vp, ['R', 'R', 'R', 'R'], {
    before: async i => {
      if (i === 2) await page.clock.setSystemTime(new Date(Date.UTC(2026, 10, 2, 5, 0, 30)));   // Monday 12:00:30 am
    },
  });
  const f = await fam(page);
  const n = await now(page);
  const h = f.history[f.history.length - 1] || {};
  ok(f.week === WEEK1 && h.week === WEEK0, 'the week turned over mid-round');
  ok(h.g5 === 2 && n.kids.g5 === 2, `two answers before midnight count for last week, two after for this week (last ${h.g5}, this ${n.kids.g5})`);
  ok(new RegExp('\\+2 ⭐ for the family team!').test(await text(page, '.family-done')), 'complete: only this week\'s stars are counted for this round');
  ok(errors.length === 0, `${tag}: no page/console errors: ${errors.slice(0, 5).join(' | ')}`);
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════
// Keyboard only (laptop, no touch): Tab / Enter / Space
// ═══════════════════════════════════════════════════════════════
async function tabTo(page, test, max, arg) {
  for (let i = 0; i < (max || 60); i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(test, arg)) return true;
  }
  return false;
}
// The app's controls ease their outline in, so look once it has settled.
const focusRing = page => page.waitForTimeout(250).then(() => page.evaluate(() => {
  const a = document.activeElement; const cs = getComputedStyle(a);
  return a.matches(':focus-visible') && cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2;
}));
async function runKeyboard(browser, pid) {
  const tag = `keyboard-${pid}`;
  console.log(`\n▶ ${tag}`);
  const vp = VPS.laptop;
  const { ctx, page, errors } = await newPage(browser, vp, 0);
  await page.evaluate(() => { state.profiles.k.xp += 100; state.profiles.g5.xp += 300; saveState(); renderProfileSelect(); });
  await instrument(page);
  ok(await tabTo(page, () => !!document.activeElement && !!document.activeElement.closest('.family-panel .js-speak')), 'Tab reaches the title 🔊');
  ok(await focusRing(page), 'the focused 🔊 shows a focus ring');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  ok(await page.evaluate(() => window.__spoken.some(s => /Family team goal/.test(s))), 'Enter on the title 🔊 reads it');
  await page.screenshot({ path: path.join(SHOTS, `${tag}-01-title-focus.png`) });
  await page.evaluate(() => { document.activeElement.blur(); });
  ok(await tabTo(page, pid => { const a = document.activeElement; return !!a && (a.getAttribute('onclick') || '').includes(`'${pid}'`); }, 60, pid), 'Tab reaches the profile card');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.family-card');
  if (pid === 'k') {
    ok(await tabTo(page, () => !!document.activeElement && !!document.activeElement.closest('.family-card .js-speak'), 120), 'k: Tab reaches the hub card 🔊');
    ok(await focusRing(page), 'k: the hub card 🔊 shows a focus ring');
    await page.evaluate(() => { window.__spoken = []; });
    await page.keyboard.press(' ');
    await page.waitForTimeout(200);
    ok(await page.evaluate(() => window.__spoken.some(s => /Team goal/.test(s))), 'k: Space on the hub 🔊 reads it');
  }
  // A round by keyboard.
  await page.evaluate(() => {
    const pk = PACKS[currentProfile.id].find(p => p.tier === 'now' && p.subject === 'math');
    startPack(pk.id);
    questions = [0, 1, 2].map(i => ({ type: 'mc', text: 'Pick A ' + i, options: ['Apple', 'Rock', 'Shoe', 'Cloud'], correct: 0 }));
    qIdx = 0;
    if (!document.querySelector('.briefing-go')) renderQuestion();
  });
  if (await page.locator('.briefing-go').count()) { await page.waitForTimeout(450); await page.keyboard.press('Enter'); }
  for (let i = 0; i < 3; i++) {
    await page.waitForSelector('.question-frame');
    await page.waitForTimeout(450);
    const idx = await page.evaluate(() => [...document.querySelectorAll('.choice')].findIndex(c => /Apple/.test(c.textContent)));
    await page.keyboard.press(String(idx + 1));
    await page.waitForSelector('#fb .next-btn');
    await page.waitForTimeout(450);
    await page.keyboard.press('Enter');
  }
  await page.waitForSelector('.complete');
  ok(/for the family team!/.test(await text(page, '.family-done')), 'keyboard round: the family strip');
  // The parent dashboard by keyboard: type, Enter saves; Space claims.
  await page.evaluate(() => { state.profiles.g3.xp += 2000; saveState(); renderParentDash(); });
  await page.waitForSelector('.family-parent');
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  ok(await tabTo(page, () => document.activeElement && document.activeElement.id === 'family-claim', 80), 'Tab reaches "Mark as claimed ✓"');
  ok(await focusRing(page), '"Mark as claimed ✓" shows a focus ring');
  await page.keyboard.press(' ');
  await page.waitForTimeout(300);
  ok((await fam(page)).claimedWeek === WEEK0, 'Space claims the reward');
  ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'family-unclaim'), 'focus moves to the undo button');
  ok(await tabTo(page, () => document.activeElement && document.activeElement.id === 'family-reward', 20), 'Tab reaches the reward field');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('Ice cream trip 🍦');
  await page.keyboard.press('Tab');
  ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'family-target'), 'Tab moves to the target');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('2000');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  ok((await fam(page)).target === 150 && /10 to 1000/.test(await text(page, '#family-saved')), 'Enter with 2000: refused, kindly explained');
  ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'family-target'), 'focus goes to the field to fix');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('200');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  const f = await fam(page);
  ok(f.reward === 'Ice cream trip 🍦' && f.target === 200, 'Enter saves the goal');
  await page.locator('.family-parent').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(SHOTS, `${tag}-02-parent.png`) });
  ok(errors.length === 0, `${tag}: no page/console errors: ${errors.slice(0, 5).join(' | ')}`);
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════
// Narrow phone and iPad landscape: layout only
// ═══════════════════════════════════════════════════════════════
async function runSizes(browser) {
  for (const vp of [VPS.phone, VPS.land]) {
    const tag = vp.name;
    console.log(`\n▶ ${tag}`);
    const { ctx, page, errors } = await newPage(browser, vp, 0);
    await page.evaluate(() => {
      state.family.reward = 'A trip to the Baltimore aquarium with grandma and grandpa 🐠';
      state.profiles.k.xp += 250; state.profiles.g3.xp += 1000; state.profiles.g5.xp += 900; saveState(); renderProfileSelect();
    });
    await page.waitForTimeout(800);
    await layout(page, vp, 'k', `${tag} title`);
    ok(await page.evaluate(() => { const c = document.querySelector('.profile-card').getBoundingClientRect(); return c.top < window.innerHeight; }), `${tag}: the first profile card is on the first screen`);
    await page.locator('.family-panel').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SHOTS, `${tag}-01-title.png`) });
    await pick(page, vp, 'k');
    await page.locator('.family-card').scrollIntoViewIfNeeded();
    await layout(page, vp, 'k', `${tag} hub`);
    await page.screenshot({ path: path.join(SHOTS, `${tag}-02-hub.png`) });
    await playRound(page, vp, ['R', 'R']);
    await page.locator('.family-done').scrollIntoViewIfNeeded();
    await layout(page, vp, 'k', `${tag} complete`);
    await page.screenshot({ path: path.join(SHOTS, `${tag}-03-complete.png`) });
    // "56 / 150 ⭐" and "94 to go" each stay on one line (a phone used to show "· 94 / to go").
    const broken = await page.evaluate(() => [...document.querySelectorAll('.family-done .family-nb')].filter(e => e.getClientRects().length !== 1).map(e => e.textContent));
    ok(await page.locator('.family-done .family-nb').count() === 2 && broken.length === 0, `${tag} complete: the count's pieces never break mid-way (${broken.join(' | ')})`);
    await page.evaluate(() => { state.family.history = [{ week: '2026-10-19', k: 30, g3: 50, g5: 70, target: 150, claimed: true, reward: 'Pizza 🍕' }]; renderParentDash(); });
    await page.locator('.family-parent').scrollIntoViewIfNeeded();
    await layout(page, vp, 'k', `${tag} parent`);
    await page.screenshot({ path: path.join(SHOTS, `${tag}-04-parent.png`) });
    await page.locator('.family-form').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SHOTS, `${tag}-05-parent-form.png`) });
    ok(errors.length === 0, `${tag}: no page/console errors: ${errors.slice(0, 5).join(' | ')}`);
    await ctx.close();
  }
}

// ═══════════════════════════════════════════════════════════════
// Reduced motion: no confetti, no fill animation; the news still shows
// ═══════════════════════════════════════════════════════════════
async function runReducedMotion(browser) {
  console.log('\n▶ reduced-motion');
  const { ctx, page, errors } = await newPage(browser, VPS.ipad, 0, { reducedMotion: 'reduce' });
  await page.evaluate(() => { state.profiles.g5.xp += 15 * 160; saveState(); renderProfileSelect(); });
  await page.waitForTimeout(500);
  ok(await page.locator('.family-panel.is-reached').count() === 1 && /GOAL REACHED/.test(await text(page, '.family-panel')), 'reduced motion: GOAL REACHED shows');
  ok(await page.locator('.fun-confetti').count() === 0, 'reduced motion: no confetti');
  ok(await page.locator('.family-panel.is-grow').count() === 0, 'reduced motion: no fill animation');
  ok((await fam(page)).cheered === WEEK0, 'reduced motion: the moment still counts as seen');
  ok(errors.length === 0, `reduced motion: no page/console errors: ${errors.slice(0, 5).join(' | ')}`);
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════
// Saved games: an old save with no family data, malformed data, two tabs
// ═══════════════════════════════════════════════════════════════
async function runSaves(browser) {
  console.log('\n▶ saves');
  const vp = VPS.ipad;
  const { ctx, page, errors } = await newPage(browser, vp, 0);
  // An old save: last year's profile keys, no `fun`, no `family`.
  await page.evaluate(() => {
    const old = { profiles: {
      prek: { xp: 455, trophies: ['warmup'], packs: {}, rounds: {}, correct: 40, attempts: 50, bestStreak: 6 },
      g2:   { xp: 1230, trophies: [], packs: {}, rounds: {}, correct: 100, attempts: 120, bestStreak: 9 },
      g4:   { xp: 2015, trophies: [], packs: {}, rounds: {}, correct: 130, attempts: 150, bestStreak: 12 } },
      parent: { reportRequired: true } };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(old));
  });
  await reloadPage(page);
  await page.waitForSelector('.family-panel');
  let f = await fam(page);
  ok(await page.evaluate(() => state.profiles.k.xp === 455 && state.profiles.g3.xp === 1230 && state.profiles.g5.xp === 2015), 'old save: every child\'s XP kept');
  ok(f && f.base.k === 455 && f.base.g3 === 1230 && f.base.g5 === 2015 && f.reward === 'Family movie night 🎬', 'old save: the family goal starts counting from now');
  ok(/0 \/ 150 ⭐ this week/.test(await text(page, '.family-panel')), 'old save: an empty meter, nothing invented');
  ok(await page.evaluate(() => JSON.parse(localStorage.getItem(STORAGE_KEY)).profiles.k.xp === 455), 'old save: saved back with progress intact');
  await pick(page, vp, 'k');
  await playRound(page, vp, ['R', 'R']);
  ok((await now(page)).kids.k >= 2, 'old save: new stars count');
  await backToHub(page, vp);
  await page.screenshot({ path: path.join(SHOTS, 'saves-01-old-save-hub.png') });

  // Malformed family data in storage.
  for (const bad of ['"oops"', 'null', '[]', '{"reward":"","target":"lots","week":"nope","base":"?","history":[null,{"week":"x"}],"claimedWeek":7}',
                     '{"reward":"Zoo 🦁","target":250,"week":"2026-10-19","base":{"k":0,"g3":"x","g5":99999},"history":{},"claimedWeek":"2026-10-19"}']) {
    await page.evaluate(bad => {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
      s.family = JSON.parse(bad);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    }, bad);
    await reloadPage(page);
    await page.waitForSelector('.family-panel');
    f = await fam(page);
    const n = await now(page);
    ok(f && typeof f.reward === 'string' && f.reward && f.target >= 10 && f.target <= 1000 && f.week === WEEK0 && Array.isArray(f.history) &&
       ['k', 'g3', 'g5'].every(p => typeof f.base[p] === 'number') && n.total >= 0, `malformed ${bad.slice(0, 40)}: repaired`);
    ok(await page.evaluate(() => state.profiles.k.xp >= 455 && state.profiles.g5.xp === 2015), `malformed ${bad.slice(0, 20)}: progress untouched`);
    await pick(page, vp, 'g5');
    await toTitle(page, vp);
  }
  f = await fam(page);
  ok(f.reward === 'Zoo 🦁' && f.target === 250 && f.history.length === 1 && f.history[0].week === '2026-10-19' && f.history[0].claimed === true, 'malformed: good parts kept, the old week recorded');

  // Two tabs: a goal set in the other tab is not lost when this tab saves.
  const page2 = await ctx.newPage();
  page2.on('pageerror', e => errors.push('tab2 pageerror: ' + e.message));
  await page2.goto('file://' + HTML);
  await page2.waitForSelector('.family-panel');
  await page2.evaluate(() => { renderParentDash(); document.getElementById('family-reward').value = 'Bowling 🎳'; document.getElementById('family-target').value = '400'; familySaveSettings(); });
  await page.waitForTimeout(500);
  f = await fam(page);
  ok(f.reward === 'Bowling 🎳' && f.target === 400, 'two tabs: the other tab\'s goal arrives here');
  await page.evaluate(() => { state.profiles.k.xp += 50; saveState(); });
  ok(await page2.evaluate(() => JSON.parse(localStorage.getItem(STORAGE_KEY)).family.reward) === 'Bowling 🎳', 'two tabs: and is not saved over');
  await page2.close();

  ok(errors.length === 0, `saves: no page/console errors: ${errors.slice(0, 5).join(' | ')}`);
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════
// Found in play-testing, each fixed: the kindergartener's "goal reached"
// lost when she moves on before it is spoken, a background tab writing an
// old goal (or an un-claimed reward) over the grown-up's, a merge that could
// invent stars, an emoji-only reward read aloud as nothing
// ═══════════════════════════════════════════════════════════════
async function runFixes(browser) {
  console.log('\n▶ fixes');
  const vp = VPS.ipad;
  {
    // The device is busy reading the round's results (as on a real iPad);
    // she taps BACK before "goal reached" has its turn.
    const { ctx, page, errors } = await newPage(browser, vp, 0);
    await addStars(page, 'g3', 147);
    await pick(page, vp, 'k');
    await page.evaluate(() => {
      Object.defineProperty(window.speechSynthesis, 'speaking', { get: () => !!window.__busy, configurable: true });
      window.__busy = true; window.__spoken = [];
    });
    await playRound(page, vp, ['R', 'R', 'R', 'R']);
    await page.waitForTimeout(500);
    ok(await page.locator('.family-done.is-reached').count() === 1, 'told: her round reaches the goal');
    ok((await fam(page)).told === '', 'told: not marked as heard while the line is still waiting');
    await backToHub(page, vp);
    await page.evaluate(() => { window.__busy = false; });
    await page.waitForTimeout(2500);
    ok(await page.evaluate(() => window.__spoken.filter(s => /reached the team goal/.test(s)).length === 1), 'told: she hears it on her hub, where the news now is');
    ok((await fam(page)).told === WEEK0, 'told: marked as heard once spoken');
    await page.evaluate(() => { window.__spoken = []; renderHub(); });
    await page.waitForTimeout(2500);
    ok(await page.evaluate(() => !window.__spoken.some(s => /reached the team goal/.test(s))), 'told: not again this week');
    // Dropped when no screen shows the news: she started another round straight away.
    await page.evaluate(() => { state.family.told = ''; window.__busy = true; window.__spoken = []; renderHub(); });
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      const pk = PACKS.k.find(p => p.tier === 'now' && !p.getQuestions && p.id !== 'think_mix');
      startPack(pk.id);
    });
    await page.evaluate(() => { window.__busy = false; });
    await page.waitForTimeout(1800);
    ok(await page.evaluate(() => !window.__spoken.some(s => /reached the team goal/.test(s))) && (await fam(page)).told === '', 'told: a line whose screen is gone is dropped, and still counts as not heard');
    await page.evaluate(() => { exitToHub(); });
    await page.waitForSelector('.family-card');
    await page.waitForTimeout(2500);
    ok(await page.evaluate(() => window.__spoken.filter(s => /reached the team goal/.test(s)).length === 1) && (await fam(page)).told === WEEK0, 'told: so her next visit to the hub tells her');
    ok(errors.length === 0, `told: no page/console errors: ${errors.slice(0, 5).join(' | ')}`);
    await ctx.close();
  }
  {
    // A tab asleep in the background missed the grown-up's claim made in another tab.
    const { ctx, page, errors } = await newPage(browser, vp, 0);
    await addStars(page, 'g5', 160);
    await pick(page, vp, 'g5');
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
      s.family.reward = 'Bowling 🎳'; s.family.claimedWeek = s.family.week; s.family.updated = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));       // no storage event reaches this tab
      document.dispatchEvent(new Event('visibilitychange'));       // it comes back to the front
    });
    await page.waitForTimeout(100);
    ok(await page.evaluate(() => state.family.reward === 'Bowling 🎳' && state.family.claimedWeek === state.family.week), 'background tab: catches up with the other tab\'s goal and claim when it comes back');
    await playRound(page, vp, ['R', 'R']);
    const disk = await page.evaluate(() => JSON.parse(localStorage.getItem(STORAGE_KEY)).family);
    ok(disk.reward === 'Bowling 🎳' && disk.claimedWeek === WEEK0, `background tab: the child's next answers do not save over the claim (${disk.reward}, ${disk.claimedWeek})`);
    ok(/✓ Reward claimed!/.test(await text(page, '.family-done')) || /reward claimed/.test(await text(page, '.family-done')), 'background tab: the strip shows the claim');

    // The other tab saves a new goal while this tab has an answer the save does not have yet:
    // the app's own merge saves this tab's copy at once, so the goal must be in it.
    const page2 = await ctx.newPage();
    page2.on('pageerror', e => errors.push('tab2 pageerror: ' + e.message));
    await page2.goto('file://' + HTML);
    await page2.waitForSelector('.family-panel');
    await page.evaluate(() => { state.profiles.g5.attempts += 1; });   // not saved yet
    await page2.evaluate(() => { renderParentDash(); document.getElementById('family-reward').value = 'Zoo 🦁'; familySaveSettings(); });
    await page.waitForTimeout(500);
    ok(await page.evaluate(() => state.family.reward === 'Zoo 🦁' && JSON.parse(localStorage.getItem(STORAGE_KEY)).family.reward === 'Zoo 🦁'), 'two tabs: the other tab\'s goal reaches this tab and stays in the save');
    ok(await page2.evaluate(() => JSON.parse(localStorage.getItem(STORAGE_KEY)).profiles.g5.attempts === state.profiles.g5.attempts), 'two tabs: and this tab\'s newer answers are kept too');
    await page2.close();

    // A merge never invents stars: the other tab is a week ahead and has XP this tab has not seen yet.
    const r = await page.evaluate(() => {
      const theirs = JSON.parse(JSON.stringify(state));
      const xp = theirs.profiles.k.xp + 150;
      theirs.profiles.k.xp = xp; theirs.profiles.k.attempts += 30; theirs.profiles.k.correct += 30;
      theirs.family.week = '2026-11-02';
      theirs.family.base = { k: xp, g3: theirs.profiles.g3.xp, g5: theirs.profiles.g5.xp };
      theirs.family.history = [{ week: '2026-10-26', k: 30, g3: 0, g5: 160, total: 190, target: 150, reached: true, claimed: false }];
      const raw = JSON.stringify(theirs);
      localStorage.setItem(STORAGE_KEY, raw);
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: raw }));
      return xp;
    }, null);
    await page.clock.setSystemTime(DAY(7));
    await page.waitForTimeout(100);
    const after = await page.evaluate(() => { const n = familyNow(); return { k: n.kids.k, week: n.f.week, base: n.f.base.k, xp: state.profiles.k.xp }; });
    ok(after.week === WEEK1 && after.xp === r && after.base === r && after.k === 0, `merge: a week-ahead tab's base and XP arrive together, no stars invented (${JSON.stringify(after)})`);
    // A broken history row from elsewhere is skipped, not a crash.
    await page.evaluate(() => {
      const theirs = JSON.parse(localStorage.getItem(STORAGE_KEY));
      theirs.family.updated = Date.now() + 1000;
      theirs.family.history = [null, 7, { week: '2026-10-26', claimed: true }];
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: JSON.stringify(theirs) }));
    });
    await page.waitForTimeout(100);
    ok(errors.length === 0, `merge: no page/console errors: ${errors.slice(0, 5).join(' | ')}`);
    await ctx.close();
  }
  {
    // An emoji-only reward: the voice skips emoji, so it is read as "your family reward".
    const { ctx, page, errors } = await newPage(browser, vp, 0);
    await page.evaluate(() => { state.family.reward = '🍕🎉'; saveState(); renderProfileSelect(); });
    const say = await page.locator('.family-panel .js-speak').getAttribute('data-speak-text');
    ok(/to earn: your family reward\./.test(say) && /🍕🎉/.test(await text(page, '.family-panel')), `emoji reward: shown as is, read aloud as "your family reward" (${say})`);
    await page.evaluate(() => { state.family.reward = 'Pizza 🍕'; saveState(); renderProfileSelect(); });
    ok(/to earn: Pizza 🍕\./.test(await page.locator('.family-panel .js-speak').getAttribute('data-speak-text')), 'a reward with words is read as written');
    ok(errors.length === 0, `emoji reward: no page/console errors: ${errors.slice(0, 5).join(' | ')}`);
    await ctx.close();
  }
}

// ═══════════════════════════════════════════════════════════════
// The other modules are here and still do their thing
// ═══════════════════════════════════════════════════════════════
async function runTogether(browser) {
  console.log('\n▶ together');
  const vp = VPS.ipad;
  const { ctx, page, errors } = await newPage(browser, vp, 0);
  const o = await require('./together').others(page);
  ok(o.buddy && o.stickers && o.boss && o.missions, `the other modules are in this build (${JSON.stringify(o)})`);
  await pick(page, vp, 'g5');
  const cards = await page.evaluate(() => [...document.querySelectorAll('.fun-zone > .fun-card')].map(c => c.className.split(' ').filter(x => x !== 'fun-card' && x !== 'tappable')[0]));
  ok(cards.some(c => /missions/.test(c)) && cards.some(c => /stk/.test(c)) && cards.some(c => /boss/.test(c)) && /family/.test(cards[cards.length - 1]), `play zone: missions, stickers, boss, then the family card (${cards.join(', ')})`);
  await page.evaluate(() => { document.querySelector('.family-card').scrollIntoView(); });
  await page.screenshot({ path: path.join(SHOTS, 'together-01-hub.png') });
  // A boss battle's XP counts as stars too.
  const before = (await now(page)).kids.g5;
  const bossOk = await page.evaluate(() => typeof bossStart === 'function');
  if (bossOk) {
    await press(page, vp, page.locator('.boss-go'));
    if (await page.locator('.briefing-go').count()) await press(page, vp, page.locator('.briefing-go'));
    await page.waitForSelector('.question-frame');
    for (let i = 0; i < 3; i++) {
      await answerCorrect(page, vp);
      await page.waitForSelector('#fb .next-btn');
      await press(page, vp, page.locator('#fb .next-btn'));
    }
    const mid = await now(page);
    ok(mid.kids.g5 - before === 3, `boss battle: 3 zaps = 3 stars (${before}→${mid.kids.g5})`);
    await press(page, vp, page.locator('.exit-btn'));
    await press(page, vp, page.locator('#exit-modal-exit'));
    await page.waitForSelector('.family-card');
    await closeOverlays(page);
  }
  // A brother or sister reaches the goal; the kindergartener hears it on her own hub, once.
  await page.evaluate(() => { state.profiles.g3.xp += 10 * 160; saveState(); window.__spoken = []; pickProfile('k'); });
  await page.waitForTimeout(3600);
  ok(await page.evaluate(() => window.__spoken.filter(s => /reached the team goal/.test(s)).length === 1), 'k: hears "goal reached" on her hub');
  ok((await fam(page)).told === WEEK0, 'k: told once this week');
  await page.evaluate(() => { window.__spoken = []; renderHub(); });
  await page.waitForTimeout(3600);
  ok(await page.evaluate(() => !window.__spoken.some(s => /reached the team goal/.test(s))), 'k: not told again on the next visit');
  ok(errors.length === 0, `together: no page/console errors: ${errors.slice(0, 5).join(' | ')}`);
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════
// A speed sprint's XP turns into stars (a build with the sprint module too)
// ═══════════════════════════════════════════════════════════════
async function runSprint(browser, vp, pid) {
  const tag = `sprint-${vp.name}-${pid}`;
  console.log(`\n▶ ${tag}`);
  const { ctx, page, errors } = await newPage(browser, vp, 0, null, HTML_SPRINT);
  ok(await page.evaluate(() => typeof sprintStart === 'function' && typeof familyNow === 'function'), `${tag}: sprint and family are both in this build`);
  await pick(page, vp, pid);
  const zone = await page.evaluate(() => [...document.querySelectorAll('.fun-zone > .fun-card')].map(c => c.className));
  const si = zone.findIndex(c => /sprint-hubcard/.test(c)), fi = zone.findIndex(c => /family-card/.test(c));
  ok(si >= 0 && fi === zone.length - 1 && si < fi, `${tag}: the sprint card, then the family card last (${si}, ${fi} of ${zone.length})`);
  const xp0 = await page.evaluate(pid => state.profiles[pid].xp, pid);
  const st0 = (await now(page)).kids[pid];
  const sprint = async right => {
    await press(page, vp, page.locator('.sprint-go'));
    for (let i = 0; i < right; i++) {
      await page.waitForFunction(() => typeof sprintRun !== 'undefined' && sprintRun && sprintRun.phase === 'run' && sprintRun.p, null, { timeout: 12000 });
      const c = await page.evaluate(() => sprintRun.p.correct);
      if (vp.touch) await page.locator('#sprint-answers .sprint-ans').nth(c).tap();
      else await page.keyboard.press(String(c + 1));
      await page.waitForTimeout(450);
    }
    // The clock running out, as the sprint's own timer would end it.
    await page.evaluate(() => sprintFinish('time'));
    await page.waitForSelector('.sprint-end', { timeout: 8000 });
    await page.waitForTimeout(500);
  };
  await sprint(6);
  ok(!/TEAM GOAL REACHED/.test(await page.evaluate(() => [...document.querySelectorAll('.fun-toast')].map(t => t.textContent).join(' '))), `${tag}: a sprint that does not reach the goal has no team banner`);
  const xp1 = await page.evaluate(pid => state.profiles[pid].xp, pid);
  const st1 = (await now(page)).kids[pid];
  const want = Math.floor(xp1 / PER[pid]) - Math.floor(xp0 / PER[pid]);
  ok(xp1 > xp0 && st1 - st0 === want && want >= 1, `${tag}: the sprint's ${xp1 - xp0} XP is ${want} stars for the team (${st0}→${st1})`);
  await press(page, vp, page.locator('.sprint-home'));
  await page.waitForSelector('.family-card');
  await closeOverlays(page);
  const t = await text(page, '.family-card');
  ok(new RegExp(`You added ${st1} ⭐ this week!`).test(t) && new RegExp(`${st1}/150 ⭐`).test(t), `${tag}: the hub card shows the sprint's stars (${t})`);
  await page.locator('.family-card').scrollIntoViewIfNeeded();
  await layout(page, vp, pid, `${tag} hub`);
  await noRanking(page, `${tag} hub`);
  await page.screenshot({ path: path.join(SHOTS, `${tag}-01-hub.png`) });

  // The sprint that reaches the goal gets its moment on its own results
  // screen (it has no round-complete strip): a banner, a fanfare, and the
  // kindergartener hears it.
  const other = pid === 'k' ? 'g5' : 'k';
  const cur = await now(page);
  // A sprint pays a fifth of a question's XP a right answer, so 6 right is always at least one star.
  await addStars(page, other, cur.target - 1 - cur.total);
  await page.evaluate(() => { renderHub(); window.__sounds = []; window.__spoken = []; window.__confetti = []; });
  await closeOverlays(page);
  ok((await now(page)).left === 1, `${tag}: set up, 1 star to go`);
  await sprint(6);
  const toast = await page.evaluate(() => [...document.querySelectorAll('.fun-toast')].map(t => t.textContent).join(' '));
  ok(/TEAM GOAL REACHED!/.test(toast) && /Show a grown-up to claim: Family movie night 🎬/.test(toast), `${tag}: the sprint that reaches the goal says so (${toast.slice(0, 120)})`);
  await page.waitForTimeout(1200);
  ok(await page.evaluate(() => window.__sounds.includes('levelup')), `${tag}: with a fanfare`);
  await page.screenshot({ path: path.join(SHOTS, `${tag}-02-reached.png`) });
  await layout(page, vp, pid, `${tag} reached`);
  if (pid === 'k') {
    await page.waitForTimeout(2500);
    ok(await page.evaluate(() => window.__spoken.filter(s => /reached the team goal/.test(s)).length === 1), `${tag}: k hears that the family reached the goal`);
    ok((await fam(page)).told === WEEK0, `${tag}: k is told once this week`);
  }
  // Again, after the goal: no second banner.
  await page.evaluate(() => { window.__sounds = []; document.querySelectorAll('.fun-toast').forEach(t => t.remove()); });
  await press(page, vp, page.locator('.sprint-again'));
  await page.waitForFunction(() => typeof sprintRun !== 'undefined' && sprintRun && sprintRun.phase === 'run' && sprintRun.p, null, { timeout: 12000 });
  const c1 = await page.evaluate(() => sprintRun.p.correct);
  if (vp.touch) await page.locator('#sprint-answers .sprint-ans').nth(c1).tap(); else await page.keyboard.press(String(c1 + 1));
  await page.waitForTimeout(450);
  await page.evaluate(() => sprintFinish('time'));
  await page.waitForSelector('.sprint-end', { timeout: 8000 });
  await page.waitForTimeout(1300);
  ok(!/TEAM GOAL REACHED/.test(await page.evaluate(() => [...document.querySelectorAll('.fun-toast')].map(t => t.textContent).join(' '))) &&
     !(await page.evaluate(() => window.__sounds.includes('levelup'))), `${tag}: the next sprint does not celebrate again`);
  // The grown-up's "how stars work" names speed sprints in this build.
  await page.evaluate(() => renderParentDash());
  await page.waitForSelector('.family-parent');
  ok(/speed sprints/.test(await text(page, '.family-parent-about')), `${tag}: the parent text counts speed sprints when they are in the game`);
  ok(errors.length === 0, `${tag}: no page/console errors: ${errors.slice(0, 5).join(' | ')}`);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ executablePath: app.CHROMIUM });
  const run = async (name, fn) => {
    try { await fn(); } catch (e) { ok(false, `${name} threw: ${e.message.split('\n')[0]}`); console.log(e.stack.split('\n').slice(0, 4).join('\n')); }
  };
  const only = app.args.find(a => !a.startsWith('-'));
  const want = n => !only || only.split(',').includes(n);
  if (want('logic')) await run('logic', () => logicChecks(browser));
  for (const vp of [VPS.ipad, VPS.laptop]) for (const pid of ['k', 'g5']) if (want(`${vp.name}-${pid}`) || want('flows')) await run(`${vp.name}-${pid}`, () => runFlow(browser, vp, pid));
  if (want('g3')) await run('g3', () => runG3(browser));
  if (want('midnight')) await run('midnight', () => runMidnight(browser));
  for (const pid of ['k', 'g5']) if (want(`keyboard-${pid}`) || want('keyboard')) await run(`keyboard-${pid}`, () => runKeyboard(browser, pid));
  if (want('sizes')) await run('sizes', () => runSizes(browser));
  if (want('motion')) await run('motion', () => runReducedMotion(browser));
  if (want('saves')) await run('saves', () => runSaves(browser));
  if (want('fixes')) await run('fixes', () => runFixes(browser));
  if (want('together')) await run('together', () => runTogether(browser));
  if (HAVE_SPRINT && want('sprint')) {
    await run('sprint-ipad-k', () => runSprint(browser, VPS.ipad, 'k'));
    await run('sprint-laptop-g5', () => runSprint(browser, VPS.laptop, 'g5'));
  }
  await browser.close();
  if (fails) console.log('\nfailures:\n' + failList.map(f => '  - ' + f).join('\n'));
  const skipped = !HAVE_SPRINT && want('sprint') ? '; skipped the sprint pass (no sprint module)' : '';
  console.log(`\nfamily: ${fails ? 'FAIL' : 'PASS'} — ${passes} checks passed, ${fails} failed${skipped}`);
  process.exit(fails ? 1 : 0);
})();
