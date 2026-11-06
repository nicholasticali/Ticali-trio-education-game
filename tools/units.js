// The school year, unit by unit, and Mix & Match.
//   node units.js [app.html]
// - YEAR_PLAN, the year laid out unit by unit for every grade K-5 (written into
//   the game by units-build.js): every topic of every plan is either a topic
//   pack, in the profile that owns its grade with that grade's tier, or a
//   "coming soon" tile that cannot be opened; every topic pack deals a full,
//   well-formed round of ten (three rounds each) with no page error; and no
//   hidden pack (the old broad packs whose questions now live in topic packs,
//   or a mode's own) is anywhere in a child's hub with every unit opened, a
//   grade library (which shows each of its packs exactly once), the Mix &
//   Match picker, a boss battle's pool or the Big Thinker's.
// - The unit class is on, from the date (the game's clock, classClockNow, is
//   faked): the first day of school (K 31 August, grades 1-5 24 August), before
//   it, 5 November (cross-checked with the calendar's own count), after
//   Thanksgiving, after winter break and after the last day, for every subject
//   of every grade, against a count made here from YEAR_CALENDAR; grades 3-5
//   word work follows the reading unit; the hub marks the same unit.
// - The parent dashboard's "Where is class now?": a unit set by hand moves
//   that child's 📍 NOW IN CLASS and the unit marked in the hub, is saved and
//   survives a reload, leaves the other children alone, and "back to
//   automatic" (the button or the menu's Automatic) returns to the calendar.
// - Mix & Match by touch on an iPad (a double tap on the button opens the
//   picker and does nothing else; THIS UNIT, SELECT NONE, three packs from
//   three subjects; ✕ and a tap outside close it), with the keyboard only on a
//   laptop (a doubled Enter, focus inside, Tab and Shift+Tab stay in it, Esc
//   closes it and focus goes back, Space ticks a box, Enter plays), and just
//   looking from the title screen: a whole round of ten from the packs picked,
//   evenly spread, at most two puzzles, XP to the child playing, a round added
//   to each picked pack and no best score touched; the last pick remembered;
//   for a visitor, no storage write at all and the save byte-identical.
// - Old saves: a save from before the year plan (no version, no unitNow), last
//   year's profile keys, broken unitNow values, a newer version, and scores of
//   packs that are hidden now all load, keep their progress and play.
// - No repeats: the Big Thinker never deals a puzzle twice (a topic shares its
//   puzzles with the pack they came from), no topic pack asks a question twice
//   in a round (a topic gathers questions from several packs), grade 4's mixed
//   fraction generators stay in their topic's unit, and a Mix & Match round
//   counts for the picked packs that dealt a question in it, not the rest. A
//   quick double tap on a path's SHOW button or a review subject opens it and
//   does nothing else; the kindergartener's Mix & Match has a 🔊 on each pack.
// - The hub and a library at 390x844, 820x1180 and 1366x768, the picker too:
//   no sideways scrolling, and on the touch screens no tap target under 44px.
//   Screenshots in out/shots/units/.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const APP = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'Ticali_Trio_Family_Edition.html'));
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const OUT = path.join(__dirname, 'out', 'shots', 'units');
const KEY = 'tapChampions_v3';
fs.mkdirSync(OUT, { recursive: true });

let bad = 0, good = 0;
const ok = (cond, msg) => { if (cond) { good++; console.log('  ok   ' + msg); } else { bad++; console.log('  FAIL ' + msg); } };
const wait = (page, ms) => page.waitForTimeout(ms);
const errors = [];

// A family's save from before the year plan: no version, no unitNow.
const kid = (xp, extra) => Object.assign({ xp, trophies: ['warmup', 'streak_3'], packs: { demo: { best: 9, total: 10 } },
  rounds: { demo: 2 }, reviews: [], correct: 40, attempts: 50, bestStreak: 7, summerMode: false, autoRead: false, history: [] }, extra || {});
const SAVE = { profiles: { k: kid(320, { autoRead: true }), g3: kid(1210), g5: kid(2405) }, parent: { reportRequired: true, secondChance: true } };

async function open(browser, vp, save) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.touch, deviceScaleFactor: 1 });
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
  await page.evaluate(([k, s]) => { localStorage.clear(); if (s) localStorage.setItem(k, JSON.stringify(s)); }, [KEY, save === undefined ? SAVE : save]);
  await page.reload(); await wait(page, 500);
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
  for (let i = 0; i < (max || 60); i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(test, arg)) return true;
  }
  return false;
}
const saved = page => page.evaluate(k => localStorage.getItem(k), KEY);
const savedKid = async (page, pid) => JSON.parse(await saved(page)).profiles[pid];
async function chooseBuddyIfAsked(page, how) {
  if (!(await page.locator('.buddy-choose').count())) return;
  await press(page, how, page.locator('.buddy-tile').first()); await wait(page, 450);
  await press(page, how, page.locator('.buddy-go')); await wait(page, 450);
}
// A sticker or buddy pop-up after a round is the game's own celebration: let it go.
async function closePopups(page) {
  for (const sel of ['#stk-overlay', '#buddy-room']) if (await page.locator(sel).count()) { await page.keyboard.press('Escape'); await wait(page, 300); }
}

// Answer the question on screen, right, with this device's input.
async function answer(page, how) {
  const q = await page.evaluate(() => {
    const q = questions[qIdx];
    return { type: q.type || 'mc', correct: q.correct, answer: q.answer, accepted: q.acceptedAnswers, items: q.items,
      pa: q.partA, pb: q.partB, sort: q.type === 'sort' ? q._shuffle.map(i => q.items[i].g) : null };
  });
  const t = q.type;
  if (how === 'keys') {
    if (t === 'mc') return page.keyboard.press(String(q.correct + 1));
    if (t === 'tf') return page.keyboard.press(q.answer ? 't' : 'f');
    if (t === 'multi') { for (const i of q.correct) await page.keyboard.press(String(i + 1)); return page.keyboard.press('Enter'); }
    if (t === 'twopart') { await page.keyboard.press(String(q.pa.correct + 1)); await wait(page, 150); return page.keyboard.press(String(q.pb.correct + 1)); }
  }
  if (t === 'mc') return press(page, how, page.locator('.choice').nth(q.correct));
  if (t === 'tf') return press(page, how, page.locator(q.answer ? '.true-btn' : '.false-btn'));
  if (t === 'typed' || t === 'fib' || t === 'showwork') {
    if (t === 'showwork' && !(await page.locator('#workDone').isChecked())) {
      const box = page.locator('#workDone');
      if (how === 'keys') { await box.focus(); await page.keyboard.press('Space'); } else if (how === 'tap') await box.tap(); else await box.click();
    }
    const value = String(q.accepted[0]);
    const numeric = /^[0-9.,:/$%()\- ]+$/.test(value);
    const pad = await page.locator('.numpad-key').count();
    if (how === 'keys' || !pad || !numeric) {
      if (pad && !numeric && how !== 'keys') await press(page, how, page.locator('.numpad-toggle'));
      if (!(await page.locator('.numpad-key').count()) || how !== 'keys') { await page.locator('#typedInput').focus(); await page.locator('#typedInput').fill(''); }
      await page.keyboard.type(value);
      return page.keyboard.press('Enter');
    }
    await press(page, how, page.locator('.numpad-key.clear'));
    for (const ch of value) {
      // A mixed number such as 4 3/4 gets a SPACE key on the pad.
      const idx = await page.evaluate(ch => [...document.querySelectorAll('.numpad-key')].findIndex(k => ch === ' ' ? k.getAttribute('aria-label') === 'SPACE' : k.textContent.trim() === ch), ch);
      if (idx >= 0) await press(page, how, page.locator('.numpad-key').nth(idx));
    }
    return press(page, how, page.locator('.typed-submit'));
  }
  if (t === 'order') {
    for (let pos = 0; pos < q.items.length; pos++) await press(page, how, page.locator(`.order-item[onclick="orderPlace(${pos})"]`));
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
    await press(page, how, page.locator('.part-choice[data-part="A"]').nth(q.pa.correct)); await wait(page, 300);
    return press(page, how, page.locator('.part-choice[data-part="B"]').nth(q.pb.correct));
  }
  throw new Error('unknown question type ' + t);
}
// From the briefing to the round-complete screen; returns the round dealt.
async function playFromBriefing(page, how) {
  if (await page.locator('.briefing-go').count()) {
    if (how === 'keys') await page.keyboard.press('Enter'); else await press(page, how, page.locator('.briefing-go'));
    await wait(page, 450);
  }
  const dealt = await page.evaluate(() => questions.map(q => ({ pack: q._mixPack || null, type: q.type || 'mc' })));
  for (let n = 0; n < 14; n++) {
    if (await page.locator('.complete').count()) break;
    if (!(await page.locator('.question-frame').count())) throw new Error(`q${n + 1}: no question on screen`);
    await answer(page, how); await wait(page, 380);
    if (await page.locator('.think-box').count() && !(await page.locator('#fb .next-btn').count())) { await answer(page, how); await wait(page, 380); }
    const next = page.locator('#fb .next-btn');
    if (!(await next.count())) throw new Error(`q${n + 1}: answering did not finish the question`);
    if (how === 'keys') await page.keyboard.press('Enter'); else await press(page, how, next);
    await wait(page, 450);
  }
  if (!(await page.locator('.complete').count())) throw new Error('the round did not reach its end');
  return dealt;
}
// The page width, and on a touch screen every tap target, as smoke.js and screens.js measure them.
async function audit(page, touch) {
  return page.evaluate(touch => {
    const small = [];
    document.querySelectorAll('button, .pack-card, [role="button"], .mix-opt, select').forEach(el => {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none') return;
      if (el.closest('[inert]')) return;
      if (r.height < 43.5 || r.width < 39.5) small.push(`${(el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : el.tagName)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    });
    return { over: document.documentElement.scrollWidth > innerWidth + 2, small: touch ? [...new Set(small)] : [] };
  }, !!touch);
}
// A full-page screenshot of the app's own scrolling screen.
async function shot(page, name) {
  const vp = page.viewportSize();
  const h = await page.evaluate(() => Math.max(document.getElementById('app').scrollHeight, innerHeight));
  await page.setViewportSize({ width: vp.width, height: Math.min(h, 14000) }); await wait(page, 250);
  await page.screenshot({ path: path.join(OUT, name + '.png') });
  await page.setViewportSize(vp); await wait(page, 150);
}

// ─── 1. The plan in the game: packs, coming soon, full rounds, no hidden pack ───
async function integrity(browser) {
  console.log('\n▶ the year plan: every topic a pack or coming soon; full rounds; no hidden pack anywhere');
  const { ctx, page } = await open(browser, { name: 'data', width: 1366, height: 768 }, null);
  const r = await page.evaluate(() => {
    const out = { problems: [], grades: {}, rounds: 0, hubCards: 0, libCards: 0 };
    const bad = m => { if (out.problems.length < 40) out.problems.push(m); };
    if (typeof YEAR_PLAN === 'undefined') { bad('the game has no YEAR_PLAN'); return out; }
    const HOME = { K: 'k', 1: 'k', 2: 'g3', 3: 'g3', 4: 'g5', 5: 'g5' };
    const TIER = { K: 'now', 1: 'ahead', 2: 'review', 3: 'now', 4: 'review', 5: 'now' };
    const TYPES = new Set(['mc', 'tf', 'typed', 'fib', 'showwork', 'order', 'sort', 'multi', 'twopart']);
    const PUZ = new Set(['order', 'sort', 'multi', 'twopart']);
    allPacks();
    const every = Object.values(PACKS).flat();
    const hiddenIds = new Set(every.filter(pk => pk.hidden).map(pk => pk.id));
    const playable = {}, soon = {};
    for (const [g, P] of Object.entries(YEAR_PLAN)) {
      const G = out.grades[g] = { topics: 0, packs: 0, soon: 0 };
      playable[g] = []; soon[g] = [];
      if (P.home !== HOME[g] || P.tier !== TIER[g]) bad(`grade ${g}: home ${P.home}, tier ${P.tier}`);
      for (const s of P.subjects) {
        if (!s.units.length) bad(`grade ${g} ${s.key}: no units`);
        for (const u of s.units) {
          if (!(u.days > 0)) bad(`grade ${g} ${u.id}: no days`);
          for (const id of u.topics) {
            G.topics++;
            const st = TOPIC_STATE[id];
            const as = every.filter(pk => pk.id === id);
            if (!st) { bad(`${id}: not installed`); continue; }
            if (!st.playable) {
              G.soon++; soon[g].push(id);
              if (as.length) bad(`${id}: coming soon, yet a pack`);
              continue;
            }
            G.packs++; playable[g].push(id);
            if (as.length !== 1) { bad(`${id}: ${as.length} packs`); continue; }
            const pk = as[0];
            if (!pk.topic || pk.hidden || pk.home !== HOME[g] || pk.tier !== TIER[g] || pk.grade !== g || pk.subject !== s.key || pk.unit !== u.id)
              bad(`${id}: pack is ${JSON.stringify({ topic: pk.topic, hidden: pk.hidden, home: pk.home, tier: pk.tier, grade: pk.grade, subject: pk.subject, unit: pk.unit })}`);
            if (!Array.isArray(BANKS['T_' + id])) bad(`${id}: no bank`);
            // Three rounds: ten well-formed questions, at most two puzzles.
            for (let n = 0; n < 3; n++) {
              let qs = [];
              try { qs = getQuestions(pk, pk.home); } catch (e) { bad(`${id}: threw ${e.message}`); break; }
              out.rounds++;
              if (qs.length !== 10) bad(`${id}: dealt ${qs.length}`);
              if (qs.filter(q => PUZ.has(q.type) && (THINK_ITEMS[id] || []).some(x => x.items === q.items && x.text === q.text)).length > 2) bad(`${id}: more than two of its puzzles`);
              for (const q of qs) {
                const t = q.type || 'mc';
                if (!TYPES.has(t)) bad(`${id}: question of type ${t}`);
                if (!q.why) bad(`${id}: a question with no why`);
                if (t === 'mc' && !(Array.isArray(q.options) && q.options.length === 4 && q.correct >= 0 && q.correct < 4)) bad(`${id}: a malformed multiple choice`);
              }
            }
            // A topic with generated math deals generated and written questions.
            if (pk.generated && BANKS['T_' + id].length >= 3) {
              const bank = new Set(BANKS['T_' + id].map(q => plainText(q.text || q.statement || '')));
              const qs = getQuestions(pk, pk.home);
              const written = qs.filter(q => bank.has(plainText(q.text || q.statement || ''))).length;
              if (!written || written === qs.length) bad(`${id}: generated topic dealt ${written} written of ${qs.length}`);
            }
          }
        }
      }
      for (const a of P.allYear) {
        const pk = every.find(x => x.id === a);
        if (pk && pk.hidden) bad(`all-year pack ${a} is hidden`);
      }
    }
    for (const pk of every) if ((pk.tier === 'warmup' || pk.tier === 'misa') && pk.hidden) bad(`${pk.tier} pack ${pk.id} is hidden`);
    if (!every.some(pk => pk.inTopics)) bad('no old pack is hidden: the topics took nothing over');

    // Each child's hub, with every subject and unit opened.
    const own = { k: 'K', g3: '3', g5: '5' };
    const side = { k: ['1'], g3: ['2'], g5: ['4'] };
    for (const pid of Object.keys(PROFILES)) {
      currentProfile = PROFILES[pid];
      buddyAsked[pid] = true;
      renderHub();
      for (let n = 0; n < 60; n++) {
        const t = document.querySelector('[data-ytoggle][aria-expanded="false"]');
        if (!t) break;
        t.click();
      }
      const ids = [...document.querySelectorAll('.hub .pack-card')].map(c => (c.getAttribute('onclick') || '').replace(/^startPack\('|'\)$/g, ''));
      out.hubCards += ids.length;
      for (const id of ids) if (hiddenIds.has(id)) bad(`${pid} hub: hidden pack ${id} on a card`);
      for (const g of [own[pid], ...side[pid]]) {
        for (const id of playable[g]) if (!ids.includes(id)) bad(`${pid} hub: topic ${id} (grade ${g}) has no card`);
        for (const id of soon[g]) if (![...document.querySelectorAll('.hub .topic-soon')].some(t => t.closest('.yunit'))) bad(`${pid} hub: no coming-soon tile`);
      }
      const soonTiles = [...document.querySelectorAll('.hub .topic-soon')];
      if (soonTiles.some(t => t.matches('[onclick], [role="button"], .pack-card') || t.querySelector('.pack-card'))) bad(`${pid} hub: a coming-soon tile can be opened`);
      const wantSoon = [own[pid], ...side[pid]].reduce((n, g) => n + soon[g].length, 0);
      const ownSoonInStrip = document.querySelectorAll('.now-strip .topic-soon').length;
      if (soonTiles.length - ownSoonInStrip < wantSoon) bad(`${pid} hub: ${soonTiles.length - ownSoonInStrip} coming-soon tiles in the year paths, ${wantSoon} topics coming soon`);
      // Boss battles and the Big Thinker.
      for (const pk of bossPoolPacks(pid)) if (pk.hidden) bad(`${pid} boss pool: hidden pack ${pk.id}`);
      for (let n = 0; n < 3; n++) for (const q of bossBuildRound(pid)) if (hiddenIds.has(q._bossPack)) bad(`${pid} boss round: from hidden pack ${q._bossPack}`);
      for (const pk of thinkPacksFor(pid)) if (pk.hidden) bad(`${pid} Big Thinker pool: hidden pack ${pk.id}`);
      if (!thinkPacksFor(pid).some(pk => pk.topic)) bad(`${pid} Big Thinker pool: no topic pack`);
      if (!bossPoolPacks(pid).some(pk => pk.topic)) bad(`${pid} boss pool: no topic pack`);
    }
    // Each grade's library: each of its packs exactly once, its topics in unit order.
    for (const g of Object.keys(YEAR_PLAN)) {
      currentProfile = PROFILES.g5;
      renderGrade(g);
      const ids = [...document.querySelectorAll('.hub .pack-card')].map(c => (c.getAttribute('onclick') || '').replace(/^startPack\('|'\)$/g, ''));
      out.libCards += ids.length;
      const want = gradePacks(g).map(pk => pk.id);
      if (ids.length !== want.length || new Set(ids).size !== ids.length || want.some(id => !ids.includes(id))) bad(`grade ${g} library: ${ids.length} cards (${new Set(ids).size} different), ${want.length} packs`);
      for (const id of ids) if (hiddenIds.has(id)) bad(`grade ${g} library: hidden pack ${id}`);
      if (document.querySelectorAll('.hub .topic-soon').length !== soon[g].length) bad(`grade ${g} library: ${document.querySelectorAll('.hub .topic-soon').length} coming-soon tiles, ${soon[g].length} topics`);
      const order = [...document.querySelectorAll('.hub .yunit')].map(u => u.dataset.unit);
      const units = YEAR_PLAN[g].subjects.flatMap(s => s.units.map(u => u.id));
      if (order.filter(id => !units.includes(id)).length) bad(`grade ${g} library: an unknown unit`);
      // Mix & Match: that grade's topic packs, and only those.
      openMixPicker(g);
      const opts = [...document.querySelectorAll('#mix-backdrop .mix-opt input')].map(i => i.value);
      if (opts.length !== playable[g].length || playable[g].some(id => !opts.includes(id))) bad(`grade ${g} picker: ${opts.length} packs, ${playable[g].length} playable topics`);
      for (const id of opts) if (hiddenIds.has(id)) bad(`grade ${g} picker: hidden pack ${id}`);
      closeMixPicker(true);
    }
    return out;
  });
  const total = Object.values(r.grades).reduce((a, g) => ({ topics: a.topics + g.topics, packs: a.packs + g.packs, soon: a.soon + g.soon }), { topics: 0, packs: 0, soon: 0 });
  console.log('  ' + Object.entries(r.grades).map(([g, x]) => `grade ${g}: ${x.topics} topics, ${x.packs} packs, ${x.soon} coming soon`).join(' · '));
  r.problems.forEach(p => console.log('       ' + p));
  ok(!r.problems.length, `${total.topics} topics: ${total.packs} packs, ${total.soon} coming soon; ${r.rounds} rounds dealt; ${r.hubCards} hub cards and ${r.libCards} library cards checked`);
  // A topic waiting for its questions (none may be, once every gap is written):
  // one topic of the unit now taken out of the packs, as if it had too few.
  const soonTile = await page.evaluate(() => {
    const res = [];
    for (const pid of ['k', 'g5']) {
      const grade = OWN_GRADE[pid];
      const b = yearBlocks(grade)[0];
      const id = yearUnitTopics(yearBlockUnit(grade, b, pid)).find(x => yearPack(x));
      const list = PACKS[pid], at = list.findIndex(p => p.id === id);
      const pk = list.splice(at, 1)[0];
      currentProfile = PROFILES[pid];
      renderHub();
      const tiles = [...document.querySelectorAll('.hub .topic-soon')].filter(t => (t.getAttribute('aria-label') || '').startsWith(plainText(YEAR_INFO[id].t)));
      const card = [...document.querySelectorAll('.hub .pack-card')].some(c => (c.getAttribute('onclick') || '').includes(`'${id}'`));
      openMixPicker(grade);
      const offered = [...document.querySelectorAll('#mix-backdrop .mix-opt input')].some(i => i.value === id);
      closeMixPicker(true);
      list.splice(at, 0, pk);
      res.push({ pid, id, card, offered,
        inStrip: tiles.some(t => t.closest('.now-strip')), inPath: tiles.some(t => t.closest('.yunit')),
        openable: tiles.some(t => t.matches('[onclick], [role="button"], .pack-card') || t.querySelector('.pack-card, [onclick*="startPack"]')),
        voice: pid !== 'k' || (tiles.length > 0 && tiles.every(t => !!t.querySelector('.pack-voice'))) });
    }
    renderHub();
    return res;
  });
  for (const x of soonTile) ok(x.inStrip && x.inPath && !x.openable && !x.card && x.voice && !x.offered,
    `${x.pid}: a topic with too few questions (${x.id}, simulated) is a coming-soon tile in NOW IN CLASS and in its unit, cannot be opened${x.pid === 'k' ? ', keeps its 🔊' : ''} and is not in Mix & Match (${JSON.stringify(x)})`);
  await ctx.close();
  return total;
}

// ─── 2. The unit now, from the date ───
async function dates(browser) {
  console.log('\n▶ the unit now, from the date (the clock faked)');
  const { ctx, page } = await open(browser, { name: 'dates', width: 1366, height: 768 }, null);
  const r = await page.evaluate(() => {
    const out = { problems: [], checked: 0, spot: {} };
    const bad = m => { if (out.problems.length < 30) out.problems.push(m); };
    const C = YEAR_CALENDAR;
    const at = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d, 12).getTime(); };
    const key = d => d.toISOString().slice(0, 10);
    // An independent count: weekdays from the first day, minus the days off.
    const off = d => { const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; return d.getDay() === 0 || d.getDay() === 6 || C.noSchool.some(([a, b]) => k >= a && k <= b); };
    const count = (grade, iso) => {
      const [y, m, d] = (grade === 'K' ? C.firstDay.K : C.firstDay.other).split('-').map(Number);
      const day = new Date(y, m - 1, d), [ty, tm, td] = iso.split('-').map(Number), stop = new Date(ty, tm - 1, td);
      const [ly, lm, ld] = C.lastDay.split('-').map(Number), last = new Date(ly, lm - 1, ld);
      let n = 0, total = 0;
      for (; day <= last; day.setDate(day.getDate() + 1)) if (!off(day)) { total++; if (day < stop) n++; }
      return { n, total, after: stop > last };
    };
    const expectUnit = (sub, c) => {
      if (c.after) return sub.units[sub.units.length - 1];
      let end = 0;
      for (const u of sub.units) { end += u.days; if (c.n < end) return u; }
      return sub.units[sub.units.length - 1];
    };
    const DATES = [['the first day of school', null], ['two weeks before school', '2026-08-10'], ['5 November', '2026-11-05'],
      ['after Thanksgiving (30 November)', '2026-11-30'], ['after winter break (4 January)', '2027-01-04'], ['after the last day (20 June)', '2027-06-20']];
    for (const [label, iso0] of DATES) {
      for (const [g, P] of Object.entries(YEAR_PLAN)) {
        const iso = iso0 || (g === 'K' ? C.firstDay.K : C.firstDay.other);
        window.classClockNow = () => at(iso);
        const c = count(g, iso), got = yearSchoolDay(g);
        if (got.n !== c.n || got.total !== c.total) bad(`${g} ${iso}: school day ${got.n} of ${got.total}, counted ${c.n} of ${c.total}`);
        for (const s of P.subjects) {
          out.checked++;
          let want = expectUnit(s, c);
          if (['3', '4', '5'].includes(g) && s.key === 'ela') {
            const r = expectUnit(P.subjects.find(x => x.key === 'reading'), c);
            want = s.units.find(u => { const m = String(u.num).match(/^(\d+)(?:-(\d+))?$/); return m && +r.num >= +m[1] && +r.num <= +(m[2] || m[1]); }) || want;
          }
          const unit = yearAutoUnit(g, s.key);
          if (!unit || unit.id !== want.id) bad(`${label}: grade ${g} ${s.key} is on ${unit && unit.id}, expected ${want.id}`);
          if (!iso0 && unit && unit.id !== s.units[0].id) bad(`first day: grade ${g} ${s.key} is not on its first unit`);
          if (iso0 === '2027-06-20' && unit && unit.id !== s.units[s.units.length - 1].id) bad(`after the last day: grade ${g} ${s.key} is not on its last unit`);
          if (iso0 === '2026-08-10' && unit && unit.id !== s.units[0].id) bad(`before school: grade ${g} ${s.key} is not on its first unit`);
        }
        if (iso0 === '2026-11-05' && g === '5') Object.assign(out.spot, { n: got.n, math: yearAutoUnit('5', 'math').num, reading: yearAutoUnit('5', 'reading').num });
        if (!iso0) out.spot.firstN = (out.spot.firstN || 0) + got.n;
      }
    }
    // The hub marks the unit the date gives, and so does NOW IN CLASS.
    window.classClockNow = () => at('2027-06-20');
    currentProfile = PROFILES.g5; buddyAsked.g5 = true; renderHub();
    const lastMath = YEAR_PLAN['5'].subjects.find(s => s.key === 'math').units.slice(-1)[0];
    out.hubLast = (document.querySelector('.ypath-own .yunit.is-now') || {}).dataset;
    out.hubLast = out.hubLast && out.hubLast.unit === lastMath.id;
    out.stripLast = [...document.querySelectorAll('.now-strip .tc-kicker')].some(k => k.textContent.includes('MATH') && k.textContent.includes('UNIT ' + lastMath.num));
    window.classClockNow = () => at(C.firstDay.K);
    currentProfile = PROFILES.k; buddyAsked.k = true; renderHub();
    const firstMath = YEAR_PLAN.K.subjects.find(s => s.key === 'math').units[0];
    out.kFirst = ((document.querySelector('.ypath-own .yunit.is-now') || {}).dataset || {}).unit === firstMath.id;
    out.totals = { K: yearSchoolDay('K').total, 5: yearSchoolDay('5').total };
    return out;
  });
  r.problems.forEach(p => console.log('       ' + p));
  ok(!r.problems.length, `${r.checked} subject-and-date checks agree with a count made here from YEAR_CALENDAR (first day, before school, 5 Nov, after Thanksgiving, after winter break, after the last day)`);
  ok(r.totals.K === 175 && r.totals[5] === 180, `the calendar gives kindergarten ${r.totals.K} school days and grades 1-5 ${r.totals[5]} (175 and 180, as the calendar notes say)`);
  ok(r.spot.firstN === 0, 'on its first day every grade is on school day 0, its first units');
  ok(r.spot.n === 48 && r.spot.math === '5' && r.spot.reading === '3', `5 November 2026: grade 5 has had ${r.spot.n} school days (48 before it, 49 with it), math unit ${r.spot.math}, reading unit ${r.spot.reading} (the plan's notes: unit 5 and Poetry)`);
  ok(r.hubLast && r.stripLast, 'after the last day the 5th grader\'s hub marks math\'s last unit, in the path and in NOW IN CLASS');
  ok(r.kFirst, 'on the first day of kindergarten her hub marks math unit 1');
  await ctx.close();
}

// ─── 3. Parent dashboard: set the unit by hand, then back to automatic ───
async function parent(browser) {
  console.log('\n▶ parent dashboard: where is class now?');
  const vp = { name: 'parent', width: 1366, height: 768 };
  const { ctx, page } = await open(browser, vp);
  await page.evaluate(() => renderParentDash()); await wait(page, 300);
  ok(await page.locator('.unitnow-block').count() === 1 && /Where is class now\?/.test(await page.locator('.unitnow-block h3').innerText()), 'the dashboard has "Where is class now?"');
  const info = await page.evaluate(() => {
    const math = YEAR_PLAN['5'].subjects.find(s => s.key === 'math');
    const auto = yearAutoUnit('5', 'math');
    const pick = math.units.find(u => u.id !== auto.id && math.units.indexOf(u) > math.units.indexOf(auto)) || math.units[0];
    const reading = YEAR_PLAN['5'].subjects.find(s => s.key === 'reading');
    return { auto: auto.id, pick: pick.id, pickNum: pick.num, selects: document.querySelectorAll('.unitnow-select').length,
      kids: document.querySelectorAll('.unitnow-kid').length, readPick: reading.units[6].id, g3auto: yearAutoUnit('3', 'math').id };
  });
  ok(info.kids === 3 && info.selects >= 15, `a menu for each subject of each child (${info.kids} children, ${info.selects} menus)`);
  const r0 = await audit(page);
  ok(!r0.over, 'the dashboard does not scroll sideways');
  await page.selectOption('#unitnow-g5-math', info.pick); await wait(page, 300);
  let d = await savedKid(page, 'g5');
  ok(d.unitNow && d.unitNow.math === info.pick, `math set by hand to ${info.pick}: saved (${JSON.stringify(d.unitNow)})`);
  ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'unitnow-g5-math'), 'focus stays on the menu');
  const said = { msg: await page.locator('#unitnow-saved').innerText(), auto: await page.locator('.unitnow-auto').count() };
  ok(/saved/i.test(said.msg) && said.auto === 1, `it says it is saved, and offers BACK TO AUTOMATIC (${JSON.stringify(said)})`);
  await page.selectOption('#unitnow-g5-reading', info.readPick); await wait(page, 300);
  await page.screenshot({ path: path.join(OUT, 'parent-set-by-hand.png') });
  // The hub follows it, after a reload too.
  await page.reload(); await wait(page, 500);
  const h = await page.evaluate(({ pick, pickNum }) => {
    currentProfile = PROFILES.g5; buddyAsked.g5 = true; renderHub();
    const now = (document.querySelector('.ypath-own .yunit.is-now') || {}).dataset || {};
    const ela = yearUnitNow('g5', 'ela');
    return { unit: now.unit, strip: [...document.querySelectorAll('.now-strip .tc-kicker')].some(k => /MATH/.test(k.textContent) && k.textContent.includes('UNIT ' + pickNum)),
      ela: ela && ela.num, elaInStrip: ela.topics.every(id => !yearPack(id) || !!document.querySelector(`.now-strip .pack-card[onclick="startPack('${id}')"]`)),
      g3: yearUnitNow('g3', 'math').id };
  }, info);
  ok(h.unit === info.pick && h.strip, `after a reload the 5th grader's hub marks math unit ${info.pickNum}, in the path and NOW IN CLASS`);
  ok(h.ela === '6-7' && h.elaInStrip, `reading set to unit 7: word work follows, to units ${h.ela}, and its packs are in NOW IN CLASS`);
  ok(h.g3 === info.g3auto, 'the 3rd grader\'s math is still automatic');
  await page.evaluate(() => renderParentDash()); await wait(page, 300);
  await page.locator('.unitnow-row.is-set .unitnow-auto').first().click(); await wait(page, 300);
  d = await savedKid(page, 'g5');
  ok(!('math' in d.unitNow) && d.unitNow.reading === info.readPick, `BACK TO AUTOMATIC: math is automatic again (${JSON.stringify(d.unitNow)})`);
  await page.selectOption('#unitnow-g5-reading', ''); await wait(page, 300);
  d = await savedKid(page, 'g5');
  ok(Object.keys(d.unitNow).length === 0, 'and the menu\'s Automatic does the same for reading');
  const back = await page.evaluate(() => { currentProfile = PROFILES.g5; renderHub(); return ((document.querySelector('.ypath-own .yunit.is-now') || {}).dataset || {}).unit; });
  ok(back === info.auto, 'the hub is back on the calendar\'s math unit');
  await ctx.close();
}

// ─── 4. Mix & Match by touch (iPad) ───
async function touchMix(browser) {
  console.log('\n▶ Mix & Match by touch, iPad 820x1180');
  const vp = { name: 'ipad', width: 820, height: 1180, touch: true };
  const { ctx, page } = await open(browser, vp);
  const before = await saved(page);
  await page.locator('.profile-card').nth(2).tap(); await wait(page, 450);
  await chooseBuddyIfAsked(page, 'tap');
  const btn = page.locator('.now-strip .mix-btn');
  ok(await btn.count() === 1, 'the 5th grader\'s hub has 🎛️ MIX & MATCH in NOW IN CLASS');
  // A quick double tap: the pop-up opens and its second tap changes nothing.
  await btn.scrollIntoViewIfNeeded();
  const b = await btn.boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await wait(page, 90);
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await wait(page, 450);
  let st = await page.evaluate(() => ({ open: !!document.getElementById('mix-backdrop'), inside: !!(document.activeElement && document.activeElement.closest('#mix-backdrop')),
    inert: app.inert, ticked: document.querySelectorAll('#mix-backdrop input:checked').length, pack: currentPack && currentPack.id, go: document.querySelector('.mix-go').disabled }));
  ok(st.open && st.inside && st.inert && st.ticked === 0 && !st.pack && st.go, `a double tap opens the picker, focus inside, the hub behind it inert, nothing ticked or started (${JSON.stringify(st)})`);
  const a = await audit(page, true);
  ok(!a.over && !a.small.length, `the picker: no sideways scroll, every target 44px or more ${a.small.join(', ')}`);
  await page.screenshot({ path: path.join(OUT, 'picker-ipad.png') });
  await page.locator('.mix-quick-btn', { hasText: 'THIS UNIT' }).tap(); await wait(page, 300);
  st = await page.evaluate(() => ({ ticked: [...document.querySelectorAll('#mix-backdrop input:checked')].map(i => i.value), want: mixNowIds('5', 'g5'), go: document.querySelector('.mix-go').textContent }));
  ok(st.ticked.length > 0 && st.ticked.length === st.want.length && st.want.every(id => st.ticked.includes(id)), `THIS UNIT ticks this unit's ${st.want.length} packs ("${st.go}")`);
  await page.locator('.mix-quick-btn', { hasText: 'SELECT NONE' }).tap(); await wait(page, 300);
  ok(await page.evaluate(() => !document.querySelector('#mix-backdrop input:checked') && document.querySelector('.mix-go').disabled), 'SELECT NONE clears them and PLAY waits for a pick');
  // ✕ and a tap outside close it.
  await page.locator('#mix-backdrop .who-close').tap(); await wait(page, 450);
  ok(await page.locator('#mix-backdrop').count() === 0 && await page.evaluate(() => !app.inert), '✕ closes it');
  await btn.tap(); await wait(page, 450);
  await page.touchscreen.tap(6, 6); await wait(page, 450);
  ok(await page.locator('#mix-backdrop').count() === 0, 'a tap outside closes it');
  // Three packs from three subjects, then play.
  await btn.tap(); await wait(page, 450);
  const picks = await page.evaluate(() => [...document.querySelectorAll('#mix-backdrop .mix-subject')].slice(0, 3).map(f => f.querySelector('.mix-opt input').value));
  for (const id of picks) await page.locator(`#mix-backdrop .mix-opt:has(input[value="${id}"])`).tap();
  await wait(page, 200);
  ok(/PLAY 10 FROM 3 PACKS/.test(await page.locator('.mix-go').innerText()), 'three ticked: "▶ PLAY 10 FROM 3 PACKS"');
  await page.locator('.mix-go').tap(); await wait(page, 450);
  const brief = await page.evaluate(() => ({ kicker: (document.querySelector('.briefing-kicker') || {}).textContent, from: (document.querySelector('.mix-from') || {}).textContent }));
  ok(/3 PACKS MIXED/.test(brief.kicker || '') && /From:/.test(brief.from || ''), `the briefing says what it mixes: "${brief.kicker}", "${(brief.from || '').slice(0, 60)}…"`);
  await page.screenshot({ path: path.join(OUT, 'mix-briefing-ipad.png') });
  let dealt = [];
  try { dealt = await playFromBriefing(page, 'tap'); ok(true, 'a whole Mix & Match round played by touch'); } catch (e) { ok(false, 'the touch round: ' + e.message); }
  const per = picks.map(id => dealt.filter(q => q.pack === id && !['order', 'sort', 'multi', 'twopart'].includes(q.type)).length);
  ok(dealt.length === 10 && dealt.every(q => picks.includes(q.pack)), `ten questions, every one from a picked pack (${dealt.length})`);
  ok(Math.max(...per) - Math.min(...per) <= 1 + (dealt.filter(q => ['order', 'sort', 'multi', 'twopart'].includes(q.type)).length ? 1 : 0), `spread evenly over the three packs (${per.join(', ')})`);
  ok(dealt.filter(q => ['order', 'sort', 'multi', 'twopart'].includes(q.type)).length <= 2, 'at most two puzzles');
  ok(/MIX & MATCH DONE/.test(await page.locator('.complete-title').innerText()), 'the round-complete screen: MIX & MATCH DONE!');
  await closePopups(page);
  const after = await saved(page);
  const B = JSON.parse(before).profiles, A = JSON.parse(after).profiles;
  ok(A.g5.xp > B.g5.xp && A.k.xp === B.k.xp && A.g3.xp === B.g3.xp, `XP to the 5th grader only (${B.g5.xp} → ${A.g5.xp})`);
  ok(picks.every(id => A.g5.rounds[id] === 1) && !A.g5.rounds[`mix_match`], `a round counted for each picked pack (${picks.map(id => A.g5.rounds[id]).join(', ')})`);
  ok(picks.every(id => !A.g5.packs[id]) && !A.g5.packs.mix_match, 'no best score written for them, or for the mix');
  // Play again: the same packs, new questions.
  await page.locator('.complete-nav', { hasText: 'PLAY AGAIN' }).tap(); await wait(page, 450);
  const again = await page.evaluate(() => questions.map(q => q._mixPack));
  ok(again.length === 10 && again.every(id => picks.includes(id)), 'PLAY AGAIN deals from the same packs');
  await page.evaluate(() => exitToHub()); await wait(page, 300);
  await page.locator('.now-strip .mix-btn').tap(); await wait(page, 450);
  const kept = await page.evaluate(() => [...document.querySelectorAll('#mix-backdrop input:checked')].map(i => i.value));
  ok(kept.length === 3 && picks.every(id => kept.includes(id)), 'the picker remembers the last pick');
  await page.locator('#mix-backdrop .who-close').tap(); await wait(page, 300);
  await page.reload(); await wait(page, 500);
  ok(!(await page.evaluate(() => JSON.stringify(Object.keys(mixLast)) !== '[]')), 'and forgets it after a reload (memory only)');
  await ctx.close();
}

// ─── 5. Mix & Match with the keyboard only (laptop) ───
async function keyboardMix(browser) {
  console.log('\n▶ Mix & Match with the keyboard only, laptop 1440x900');
  const vp = { name: 'keys', width: 1440, height: 900 };
  const { ctx, page } = await open(browser, vp);
  await page.evaluate(() => { buddyAsked.g3 = true; });
  ok(await tabTo(page, () => (document.activeElement.getAttribute('onclick') || '').includes("'g3'"), null, 20), 'Tab reaches the 3rd grader');
  await page.keyboard.press('Enter'); await wait(page, 450);
  ok(await tabTo(page, () => document.activeElement.classList.contains('mix-btn')), 'Tab reaches 🎛️ MIX & MATCH');
  ok(await page.evaluate(() => { const a = document.activeElement, cs = getComputedStyle(a); return a.matches(':focus-visible') && cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2; }), 'it shows a focus ring');
  await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await wait(page, 350);
  let st = await page.evaluate(() => ({ open: !!document.getElementById('mix-backdrop'), focus: document.activeElement.className, ticked: document.querySelectorAll('#mix-backdrop input:checked').length, pack: currentPack && currentPack.id }));
  ok(st.open && /mix-modal/.test(st.focus) && !st.ticked && !st.pack, `a doubled Enter opens it with focus on the pop-up itself, nothing ticked or started (${st.focus})`);
  await page.keyboard.press('Tab');
  ok(await page.evaluate(() => /THIS UNIT/.test(document.activeElement.textContent)), 'Tab: 📍 THIS UNIT first');
  await page.keyboard.press('Enter'); await wait(page, 250);
  const nowN = await page.evaluate(() => ({ t: document.querySelectorAll('#mix-backdrop input:checked').length, w: mixNowIds('3', 'g3').length }));
  ok(nowN.t > 0 && nowN.t === nowN.w, `Enter on it ticks this unit's ${nowN.w} packs`);
  const trail = [];
  for (let i = 0; i < 80; i++) { await page.keyboard.press('Tab'); trail.push(await page.evaluate(() => !!document.activeElement.closest('#mix-backdrop'))); }
  ok(trail.every(Boolean), 'Tab stays inside it (80 presses)');
  await page.evaluate(() => document.querySelector('#mix-backdrop .mix-quick-btn').focus());
  await page.keyboard.press('Shift+Tab');
  ok(await page.evaluate(() => document.activeElement.classList.contains('who-close')), 'Shift+Tab from the first control goes round to the last (✕)');
  await page.keyboard.press('Escape'); await wait(page, 300);
  ok(await page.locator('#mix-backdrop').count() === 0 && await page.evaluate(() => document.activeElement.classList.contains('mix-btn')), 'Esc closes it, focus back on MIX & MATCH');
  await page.keyboard.press('Enter'); await wait(page, 300);
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  ok(await page.evaluate(() => /SELECT NONE/.test(document.activeElement.textContent)), 'Tab, Tab: SELECT NONE');
  await page.keyboard.press('Enter'); await wait(page, 200);
  await page.keyboard.press('Tab');
  ok(await page.evaluate(() => document.activeElement.type === 'checkbox'), 'Tab: the first pack\'s box');
  await page.keyboard.press('Space'); await wait(page, 100);
  for (let i = 0; i < 3; i++) await page.keyboard.press('Tab');
  await page.keyboard.press('Space'); await wait(page, 100);
  const picks = await page.evaluate(() => [...document.querySelectorAll('#mix-backdrop input:checked')].map(i => i.value));
  ok(picks.length === 2, `Space ticks two boxes (${picks.join(', ')})`);
  await page.keyboard.press('Enter'); await wait(page, 200);
  ok(await page.locator('#mix-backdrop').count() === 1 && await page.evaluate(() => !currentPack), 'Enter on a box ticks nothing and starts nothing');
  ok(await tabTo(page, () => document.activeElement.classList.contains('mix-go'), null, 80), 'Tab reaches ▶ PLAY');
  await page.keyboard.press('Enter'); await wait(page, 450);
  let dealt = [];
  try { dealt = await playFromBriefing(page, 'keys'); ok(true, 'a whole Mix & Match round played with the keyboard'); } catch (e) { ok(false, 'the keyboard round: ' + e.message); }
  ok(dealt.length === 10 && dealt.every(q => picks.includes(q.pack)), 'ten questions from the two packs picked');
  const d = await savedKid(page, 'g3');
  ok(picks.every(id => d.rounds[id] === 1 && !d.packs[id]), 'a round each, no best score');
  await closePopups(page);
  ok(await tabTo(page, () => /BACK TO PACKS/.test(document.activeElement.textContent)), 'Tab reaches BACK TO PACKS');
  await page.keyboard.press('Enter'); await wait(page, 450);
  ok(await page.locator('.now-strip').count() === 1, 'Enter: back to the 3rd grader\'s hub');
  // A subject's other units, by keyboard.
  ok(await tabTo(page, () => document.activeElement.matches('.ypath-more[aria-expanded="false"]'), null, 80), 'Tab reaches a "show all units" button');
  await page.keyboard.press('Enter'); await wait(page, 300);
  ok(await page.evaluate(() => document.activeElement.classList.contains('pack-card') && !!document.querySelector('.ypath-more[aria-expanded="true"]')), 'Enter opens every unit of that subject, focus on its first pack');
  await ctx.close();
}

// ─── 6. Just looking: Mix & Match from a grade library, nothing saved ───
async function guestMix(browser) {
  console.log('\n▶ Mix & Match just looking (4th grade), laptop with a mouse');
  const vp = { name: 'guest', width: 1366, height: 768 };
  const { ctx, page } = await open(browser, vp);
  const snap = await saved(page);
  const g4 = page.locator('.title-grade[data-grade="4"]');
  await g4.scrollIntoViewIfNeeded(); await g4.click(); await wait(page, 450);
  await page.locator('.who-guest').click(); await wait(page, 450);
  const w0 = await page.evaluate(() => __writes.length);
  ok(await page.evaluate(() => guestMode && libraryGrade === '4'), 'just looking: 4th grade');
  ok(await page.locator('.ylib-bar .mix-btn').count() === 1 && await page.locator('.hub-header .switch-btn').count() === 1, 'the library has 🎛️ MIX & MATCH (its header keeps one ← ALL GRADES button)');
  await page.locator('.ylib-bar .mix-btn').click(); await wait(page, 450);
  await page.locator('.mix-quick-btn', { hasText: 'THIS UNIT' }).click(); await wait(page, 200);
  const n = await page.evaluate(() => document.querySelectorAll('#mix-backdrop input:checked').length);
  ok(n > 0, `THIS UNIT ticks the 4th grade's units now by the calendar (${n} packs)`);
  await page.locator('.mix-go').click(); await wait(page, 450);
  try { await playFromBriefing(page, 'click'); ok(true, 'a whole round played'); } catch (e) { ok(false, 'the guest round: ' + e.message); }
  ok(/Just looking: nothing from this round is saved/.test(await page.locator('.guest-note').innerText().catch(() => '')), 'the round-complete screen says nothing is saved');
  await closePopups(page);
  await page.locator('.complete-nav', { hasText: 'BACK TO PACKS' }).click(); await wait(page, 450);
  const w = await page.evaluate(n => __writes.slice(n), w0);
  ok(w.length === 0 && await saved(page) === snap, `no storage write at all; the save byte-identical${w.length ? ': ' + w.join(', ') : ''}`);
  await ctx.close();
}

// ─── 7. Old saves ───
async function oldSaves(browser) {
  console.log('\n▶ old saves');
  const cases = [
    ['a save from before the year plan', SAVE, { k: 320, g3: 1210, g5: 2405 }],
    ["last year's keys (pre-K, 2nd, 4th)", { profiles: { prek: kid(11), g2: kid(22), g4: kid(33) }, parent: { reportRequired: true } }, { k: 11, g3: 22, g5: 33 }],
    ['broken unitNow values and a unit that is not there', { profiles: { k: kid(1, { unitNow: [] }), g3: kid(2, { unitNow: 'x' }), g5: kid(3, { unitNow: { math: 'no_such_unit', science: 7 } }) } }, { k: 1, g3: 2, g5: 3 }],
    ['a newer version', Object.assign({ version: 9 }, { profiles: { k: kid(5), g3: kid(6), g5: kid(7) } }), { k: 5, g3: 6, g5: 7 }],
  ];
  for (const [name, save, xp] of cases) {
    const { ctx, page } = await open(browser, { name: 'saves', width: 1366, height: 768 }, save);
    const r = await page.evaluate(() => {
      const out = { xp: {}, unitNow: {}, version: state.version, hubs: 0 };
      for (const pid of Object.keys(PROFILES)) {
        out.xp[pid] = state.profiles[pid].xp; out.unitNow[pid] = state.profiles[pid].unitNow;
        currentProfile = PROFILES[pid]; buddyAsked[pid] = true; renderHub();
        if (document.querySelector('.now-strip') && document.querySelector('.ypath-own .yunit.is-now')) out.hubs++;
      }
      out.auto = yearUnitNow('g5', 'math').id === yearAutoUnit('5', 'math').id;
      return out;
    });
    ok(JSON.stringify(r.xp) === JSON.stringify(xp), `${name}: XP kept (${Object.values(r.xp).join(', ')})`);
    ok(r.hubs === 3 && r.auto && Object.values(r.unitNow).every(u => u && typeof u === 'object' && !Array.isArray(u)), `${name}: each hub shows its year, units on the calendar's (${JSON.stringify(r.unitNow)})`);
    ok(r.version === (save.version > 2 ? save.version : 2), `${name}: version ${r.version}`);
    await ctx.close();
  }
  // Scores of packs that are hidden now are kept through a round and a reload.
  const old = { profiles: { k: kid(1), g3: kid(2), g5: kid(3, { packs: { g5_add_sub_dec: { best: 9, total: 10 } }, rounds: { g5_add_sub_dec: 4 } }) } };
  const { ctx, page } = await open(browser, { name: 'saves', width: 1366, height: 768 }, old);
  const hidden = await page.evaluate(() => (PACKS.g5.find(p => p.id === 'g5_add_sub_dec') || {}).hidden);
  await page.evaluate(() => { pickProfile('g5'); const pk = PACKS.g5.find(p => p.topic && p.tier === 'now'); startPack(pk.id); const go = document.querySelector('.briefing-go'); if (go) go.click(); const q = questions[qIdx]; if ((q.type || 'mc') === 'mc') pickMc(q.correct); else saveState(); });
  await wait(page, 300); await page.reload(); await wait(page, 400);
  const d = await savedKid(page, 'g5');
  ok(d.packs.g5_add_sub_dec && d.packs.g5_add_sub_dec.best === 9 && d.rounds.g5_add_sub_dec === 4, `a pack hidden now (${hidden ? 'g5_add_sub_dec is hidden' : 'g5_add_sub_dec'}) keeps its best score and rounds`);
  await ctx.close();
}

// ─── 8. No repeats, rounds that stay in their unit, a double tap on a path ───
async function repeats(browser) {
  console.log('\n▶ no repeats; rounds stay in their unit; Mix & Match counts packs that dealt; a double tap on a path; the kindergartener\'s 🔊 in Mix & Match');
  const { ctx, page } = await open(browser, { name: 'repeats', width: 820, height: 1180, touch: true });
  const r = await page.evaluate(() => {
    const text = q => plainText(q.text || q.statement || (q.partA && q.partA.text) || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const sorted = a => JSON.stringify((a || []).map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).sort());
    const same = q => [q.type || 'mc', text(q), sorted(q.options), sorted(q.items), q.partA ? sorted(q.partA.options) : ''].join('|');
    // A question asked twice: the same words, unless they are about two different passages.
    const twice = qs => qs.some((q, i) => qs.some((o, j) => j < i && text(o) && text(o) === text(q) && !(o.passage && q.passage && o.passage !== q.passage)));
    const out = { think: {}, topics: [], gens: [], mix: null };
    for (const pid of Object.keys(PACKS)) {
      currentProfile = PROFILES[pid];
      let n = 0;
      for (let i = 0; i < 100; i++) { const qs = getQuestions(findPack('think_mix'), pid); if (new Set(qs.map(same)).size < qs.length) n++; }
      out.think[pid] = n;
    }
    for (const pk of allPacks().filter(p => p.topic)) {
      currentProfile = PROFILES[pk.home];
      for (let i = 0; i < 5; i++) if (twice(getQuestions(pk, pk.home))) { out.topics.push(pk.id); break; }
    }
    // Grade 4's mixed generators, narrowed to the topic's unit.
    const off = { g4m_frac_addsub: q => /Convert|Multiply/.test(q.text || ''), g4m_frac_equiv: q => /\d\.\d|[+−]/.test(q.statement || '') };
    for (const [id, bad] of Object.entries(off)) {
      const fns = [...(MATH_GENERATORS[id] || []), ...(NONMC_MATH_GENERATORS[id] || [])];
      let n = 0; for (const f of fns) for (let i = 0; i < 300; i++) if (bad(f())) n++;
      if (n) out.gens.push(`${id}: ${n} from another unit`);
    }
    // Twelve packs picked: a round counts for the ten-odd that dealt a question, not the rest.
    currentProfile = PROFILES.g5;
    const ids = Object.keys(YEAR_TOPICS).filter(t => YEAR_TOPICS[t].g === '5' && yearPack(t)).slice(0, 12);
    const d = state.profiles.g5, before = Object.assign({}, d.rounds);
    mixState = { pid: 'g5', grade: '5', ids };
    startPack(MIX_PACK_ID);
    const dealt = new Set(questions.map(q => q._mixPack));
    score = 5; finishPack();
    out.mix = { picked: ids.length, dealt: dealt.size, ok: ids.every(id => (d.rounds[id] || 0) - (before[id] || 0) === (dealt.has(id) ? 1 : 0)) };
    mixState = null;
    return out;
  });
  ok(Object.values(r.think).every(n => n === 0), `Big Thinker: no puzzle twice in a round, 100 rounds each (${JSON.stringify(r.think)})`);
  ok(!r.topics.length, `no topic pack asks a question twice in a round, five rounds each${r.topics.length ? ': ' + r.topics.slice(0, 6).join(', ') : ''}`);
  ok(!r.gens.length, `grade 4 fractions: generated questions stay in their unit${r.gens.length ? ': ' + r.gens.join('; ') : ''}`);
  ok(r.mix && r.mix.ok, `Mix & Match of ${r.mix && r.mix.picked} packs: a round for each of the ${r.mix && r.mix.dealt} that dealt a question, none for the rest`);
  // A quick double tap on a path's SHOW button or a review subject: it opens, and that is all.
  for (const [pid, sel, what] of [['g3', '.ypath-own .ypath-more:not(.ypath-earlier)', 'the 3rd grader\'s "more units"'], ['g5', '.ypath-fold', 'a 4th grade review subject']]) {
    await page.evaluate(pid => { buddyAsked[pid] = true; mixState = null; pickProfile(pid); }, pid); await wait(page, 400);
    const b = page.locator(sel).first();
    await b.scrollIntoViewIfNeeded();
    const box = await b.boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); await wait(page, 90);
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); await wait(page, 450);
    const st = await page.evaluate(() => ({ open: Object.values(yearOpen).filter(Boolean).length, round: !!document.querySelector('.quiz') }));
    ok(st.open === 1 && !st.round, `a double tap on ${what}: it opens, no round starts (${JSON.stringify(st)})`);
    await page.evaluate(() => { for (const k of Object.keys(yearOpen)) delete yearOpen[k]; });
  }
  // The kindergartener picks packs by ear: a 🔊 on each, which ticks nothing.
  await page.evaluate(() => { buddyAsked.k = true; pickProfile('k'); openMixPicker('K'); }); await wait(page, 400);
  const k = await page.evaluate(() => { const o = [...document.querySelectorAll('#mix-backdrop .mix-opt')]; return { n: o.length, say: o.filter(x => x.querySelector('.js-speak')).length }; });
  await page.locator('#mix-backdrop .mix-opt .js-speak').first().tap(); await wait(page, 300);
  const ticked = await page.evaluate(() => document.querySelectorAll('#mix-backdrop input:checked').length);
  const a = await audit(page, true);
  ok(k.n > 0 && k.say === k.n && !ticked && !a.small.length, `the kindergartener's Mix & Match: a 🔊 on all ${k.n} packs, a tap on one ticks nothing (${ticked}), every target 44px or more ${a.small.slice(0, 3).join(', ')}`);
  await ctx.close();
}

// ─── 9. Layout: the hub and a library at three sizes ───
async function layout(browser) {
  console.log('\n▶ layout: hubs and a library at 390x844, 820x1180 and 1366x768');
  for (const vp of [{ name: 'phone', width: 390, height: 844, touch: true }, { name: 'ipad', width: 820, height: 1180, touch: true }, { name: 'laptop', width: 1366, height: 768 }]) {
    const { ctx, page } = await open(browser, vp);
    for (const pid of ['k', 'g3', 'g5']) {
      await page.evaluate(pid => { buddyAsked[pid] = true; pickProfile(pid); }, pid); await wait(page, 300);
      // One subject opened, as a child would.
      await page.evaluate(() => { const t = document.querySelector('.ypath-more[aria-expanded="false"]'); if (t) t.click(); }); await wait(page, 150);
      const a = await audit(page, vp.touch);
      ok(!a.over && !a.small.length, `${vp.name} ${pid} hub: no sideways scroll, no small target ${a.small.slice(0, 4).join(', ')}`);
      await shot(page, `hub-${pid}-${vp.name}`);
    }
    await page.evaluate(() => { currentProfile = PROFILES.g3; renderGrade('3'); }); await wait(page, 300);
    let a = await audit(page, vp.touch);
    ok(!a.over && !a.small.length, `${vp.name} 3rd grade library: no sideways scroll, no small target ${a.small.slice(0, 4).join(', ')}`);
    await shot(page, `library-3-${vp.name}`);
    await page.evaluate(() => openMixPicker('3')); await wait(page, 300);
    a = await audit(page, vp.touch);
    ok(!a.over && !a.small.length, `${vp.name} picker: no sideways scroll, no small target ${a.small.slice(0, 4).join(', ')}`);
    await page.screenshot({ path: path.join(OUT, `picker-${vp.name}.png`) });
    await ctx.close();
  }
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const t0 = Date.now();
  let total = { topics: 0, packs: 0, soon: 0 };
  for (const [name, fn] of [['integrity', integrity], ['dates', dates], ['parent', parent], ['touch', touchMix], ['keys', keyboardMix], ['guest', guestMix], ['saves', oldSaves], ['repeats', repeats], ['layout', layout]]) {
    try { const r = await fn(browser); if (name === 'integrity' && r) total = r; } catch (e) { ok(false, `${name}: ${e.message.split('\n')[0]}`); }
  }
  await browser.close();
  ok(!errors.length, `no JS errors${errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''}`);
  const secs = Math.round((Date.now() - t0) / 1000);
  console.log(bad ? `units: FAIL — ${bad} of ${good + bad} checks failed (${secs}s)`
    : `units: PASS — ${good} checks: ${total.topics} unit topics (${total.packs} packs, ${total.soon} coming soon), the unit now on six dates, the parent's setting, Mix & Match by touch, keyboard and just looking, old saves, no repeats in a round (${secs}s)`);
  process.exit(bad ? 1 : 0);
})();
