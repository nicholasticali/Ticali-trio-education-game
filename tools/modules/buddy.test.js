// Brain Buddy — end-to-end test.
//   node modules/buddy.test.js [app.html]
// On the game file (the repo's, $TT_APP, or the one named), with the buddy
// module and every other one built in: for the kindergartener (k) and the
// fifth grader (g5), on an iPad in portrait (820×1180, touch) and a 1440×900
// laptop (mouse + keyboard), walks every path: first-visit chooser, "maybe
// later", asked again next visit, picking and naming, the hub card at every
// stage, the buddy room (pet, more, close three ways, change buddy, back),
// quiz-bar reactions, level-ups with and without a stage change, both
// trophies, the round-complete reaction, and a normal round played start to
// finish. A lighter pass runs at 390px wide and with reduced motion. Fails on
// any page error, console error, horizontal overflow, or a buddy tap target
// under 44px (56px for the kindergartener). Screenshots go to
// tools/out/shots/buddy/.
const { chromium } = require('playwright');
const path = require('path');
const app = require('./app');

const HTML = app.APP;
// The suite is for the buddy module as the game file has it: without it, it fails.
if (!app.has('buddy')) { console.log('buddy: FAIL — the game file has no buddy module'); process.exit(1); }
const SHOTS = app.shots('buddy');
console.log('app: ' + HTML);

let passes = 0, fails = 0;
const failList = [];
function ok(cond, msg) {
  if (cond) passes++;
  else { fails++; failList.push(msg); console.log('    FAIL ' + msg); }
}
const wait = ms => new Promise(r => setTimeout(r, ms));

const NAMES = { dragon: ['Ember', 'Blaze', 'Sparky'], robot: ['Bolt', 'Gizmo', 'Beep'], terrapin: ['Shelly', 'Testudo', 'Mossy'], crab: ['Pinchy', 'Clawdia', 'Sandy'] };
const NEGATIVE = /disappoint|\bbad\b|\bsad\b|fail|terrible|poor|wrong|lazy|shame/i;

// A tap on a touch device, a click with a mouse. The app swallows a second
// touchend within 320ms (double-tap-zoom guard), so taps are spaced out.
async function press(page, vp, loc) {
  // Left where the last click was, the pointer can sit on the very edge of a
  // control whose hover lifts it 2 px (the app's hover style), so it flickers
  // in and out of hover and never holds still for Playwright. Park it in the
  // corner first; the click then moves it onto the control, as a person does.
  if (!vp.touch) await page.mouse.move(1, 1);
  await loc.scrollIntoViewIfNeeded();
  if (vp.touch) await loc.tap(); else await loc.click();
  await page.waitForTimeout(450);   // the app drops a second press on the same spot within 400 ms of a screen change
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
    const transient = el => el.closest('.fun-confetti, .fun-toast, .trophy-pop, .xp-pop, .streak-pop, .buddy-fx, .buddy-heart');
    const over = [];
    for (const el of document.querySelectorAll('body *')) {
      if (transient(el) || !vis(el)) continue;
      const b = el.getBoundingClientRect();
      if (b.right > W + 1 || b.left < -1) over.push(desc(el) + ` [${Math.round(b.left)}..${Math.round(b.right)} of ${W}]`);
    }
    const small = [];
    for (const el of document.querySelectorAll('button, [role=button], [role=checkbox], input[type=text]')) {
      if (transient(el) || !vis(el)) continue;
      const b = el.getBoundingClientRect();
      const mine = !!el.closest('[class*="buddy-"]');
      small.push({ d: desc(el), w: b.width, h: b.height, mine });
    }
    const app = document.getElementById('app');
    return { over, small, docOver: document.documentElement.scrollWidth > W + 1, appOver: app.scrollWidth > app.clientWidth + 1 };
  });
  ok(!r.docOver && !r.appOver, `${label}: page scrolls horizontally`);
  ok(r.over.length === 0, `${label}: elements overflow the viewport: ${r.over.slice(0, 4).join(' | ')}`);
  const floor = pid === 'k' ? 55.5 : 43.5;
  const mineSmall = r.small.filter(s => s.mine && (s.w < floor || s.h < floor));
  ok(mineSmall.length === 0, `${label}: buddy tap targets under ${Math.round(floor)}px: ${mineSmall.map(s => `${s.d} ${Math.round(s.w)}x${Math.round(s.h)}`).join(' | ')}`);
  const appSmall = r.small.filter(s => !s.mine && (s.w < 43.5 || s.h < 43.5));
  if (appSmall.length) console.log(`    note (${label}, app's own controls under 44px, not this module): ${appSmall.slice(0, 3).map(s => `${s.d} ${Math.round(s.w)}x${Math.round(s.h)}`).join(' | ')}`);
}

async function newPage(browser, vp, extra) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.touch, deviceScaleFactor: 1 }, extra || {}));
  ctx.setDefaultTimeout(12000);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
  page.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss().catch(() => {}); });
  await page.goto('file://' + HTML);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.evaluate(() => {
    // Record what would be read aloud (headless Chromium has no voices).
    window.__spoken = [];
    window.speakText = function (t) { window.__spoken.push(String(t)); };
    window.__levelUps = [];
    FUN.on('levelUp', e => window.__levelUps.push(e));
  });
  return { ctx, page, errors };
}

const store = (page, pid) => page.evaluate(pid => JSON.parse(JSON.stringify(FUN.store(pid, 'buddy'))), pid);
const spokenHas = (page, s) => page.evaluate(s => window.__spoken.some(t => t.includes(s)), s);
// The toast's words (the buddy's picture beside them is not text).
const lastToast = page => page.evaluate(() => {
  const t = [...document.querySelectorAll('.fun-toast')].pop();
  if (!t) return '';
  return (t.querySelector('.buddy-toast-msg') || t).textContent.replace(/\s+/g, ' ').trim();
});

// Start a deterministic round (raw, unshuffled questions) through the real engine.
async function startControlled(page, vp, qs) {
  await page.evaluate(qs => {
    const pk = PACKS[currentProfile.id].find(p => p.tier === 'now' && !p.getQuestions && p.id !== 'think_mix');
    startPack(pk.id);
    questions = qs.map(q => JSON.parse(JSON.stringify(q)));
    qIdx = 0;
  }, qs);
  if (await page.locator('.briefing-go').count()) await press(page, vp, page.locator('.briefing-go'));
  else await page.evaluate(() => renderQuestion());
  await page.waitForSelector('.question-frame');
}
const mc = (text, correct, extra) => Object.assign({ type: 'mc', text, options: ['Apple', 'Rock', 'Shoe', 'Cloud'], correct, why: 'Only one of these is a fruit.', hint: 'Which one grows on a tree?' }, extra || {});
const tf = (statement, answer) => ({ type: 'tf', statement, answer, why: 'The sun is a very hot star.' });

async function qb(page) {
  return page.evaluate(() => {
    const el = document.getElementById('buddy-qb');
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { cls: el.className, h: b.height, w: b.width, pe: getComputedStyle(el).pointerEvents,
             fx: [...el.querySelectorAll('.buddy-fx')].map(f => f.className + ':' + f.textContent),
             stage: (el.querySelector('.buddy-av') || {}).className || '' };
  });
}
async function next(page, vp) { await press(page, vp, page.locator('#fb .next-btn')); }

// Answer whatever question is showing, correctly, through the UI.
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
        if (ch === ' ') continue;
        const idx = await page.evaluate(ch => [...document.querySelectorAll('.numpad-key')].findIndex(k => k.textContent.trim() === ch), ch);
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
async function runFull(browser, vp, pid) {
  const tag = `${vp.name}-${pid}`;
  console.log(`\n▶ ${tag}`);
  const { ctx, page, errors } = await newPage(browser, vp);
  const shot = name => page.screenshot({ path: path.join(SHOTS, `${tag}-${name}.png`) });
  const isK = pid === 'k';
  const type1 = isK ? 'dragon' : 'robot';
  const type2 = isK ? 'terrapin' : 'crab';

  // ── 1. First visit: the chooser replaces the hub ──
  await press(page, vp, page.locator(`.profile-card[onclick*="'${pid}'"]`));
  await page.waitForSelector('.buddy-choose');
  await page.waitForTimeout(450);
  ok(await page.locator('.hub').count() === 0, 'chooser replaces the hub on first visit');
  ok(await page.locator('.buddy-tile').count() === 6, 'six buddies offered');
  const titleText = await page.locator('.buddy-choose-title').textContent();
  ok(/Choose your Brain Buddy/i.test(titleText), 'chooser title');
  const kinds = await page.locator('.buddy-tile-kind').allTextContents();
  ok(['Dragon', 'Unicorn', 'Robot', 'Fox', 'Terrapin', 'Blue Crab'].every(k => kinds.includes(k)), 'all six kinds present: ' + kinds.join(','));
  ok(await page.locator('.buddy-tile', { hasText: 'Terrapin' }).textContent().then(t => /state reptile/i.test(t)), 'terrapin is labelled Maryland state reptile');
  if (isK) {
    ok(await page.locator('.buddy-tile .js-speak').count() === 6, 'K: every buddy has a 🔊');
    ok(await spokenHas(page, 'Choose your Brain Buddy'), 'K: chooser read aloud (autoRead)');
  } else {
    ok(await page.locator('.buddy-tile .js-speak').count() === 0, 'g5: no per-tile speakers');
    ok(!(await spokenHas(page, 'Choose your Brain Buddy')), 'g5: not read aloud (autoRead off)');
  }
  await shot('01-chooser');
  await layout(page, vp, pid, 'chooser');

  // ── 2. Maybe later → invite card; not asked again this visit ──
  await press(page, vp, page.locator('.buddy-later'));
  await page.waitForSelector('.hub');
  ok(await page.locator('.buddy-card--invite').count() === 1, 'maybe later → invite card in the play zone');
  ok(!(await store(page, pid)).type, 'maybe later stores no buddy');
  await page.waitForTimeout(300);
  await shot('02-hub-invite');
  await layout(page, vp, pid, 'hub invite');
  await page.evaluate(() => renderHub());
  await page.waitForTimeout(150);
  ok(await page.locator('.buddy-choose').count() === 0, 'same visit: re-rendering the hub does not re-ask');
  // the invite card opens the chooser
  await press(page, vp, page.locator('.buddy-card--invite'));
  ok(await page.locator('.buddy-choose').count() === 1, 'tapping the invite card opens the chooser');
  await press(page, vp, page.locator('.buddy-later'));
  // next visit: switch → title → same child → asked again
  await press(page, vp, page.locator('.switch-btn', { hasText: 'SWITCH' }));
  await press(page, vp, page.locator(`.profile-card[onclick*="'${pid}'"]`));
  await page.waitForTimeout(200);
  ok(await page.locator('.buddy-choose').count() === 1, 'next visit: asked again');

  // ── 3. Pick and name ──
  await press(page, vp, page.locator(`.buddy-tile[data-type="${type1}"]`));
  await page.waitForTimeout(450);
  ok(await page.locator(`.buddy-tile[data-type="${type1}"].on[aria-pressed="true"]`).count() === 1, 'tapped buddy is selected');
  ok(await page.locator('.buddy-tile.on').count() === 1, 'only one buddy selected');
  ok(await page.locator('.buddy-chip').count() === 3, 'three preset names');
  const chipNames = await page.locator('.buddy-chip-name').allTextContents();
  ok(JSON.stringify(chipNames) === JSON.stringify(NAMES[type1]), 'preset names for ' + type1);
  if (isK) {
    ok(await page.locator('.buddy-chip .js-speak').count() === 3, 'K: every name has a 🔊');
    ok(await page.locator('#buddy-own-input').count() === 0, 'K: no typing needed (no text box)');
    ok(await spokenHas(page, 'Now pick a name'), 'K: name step read aloud');
  } else {
    ok(await page.locator('#buddy-own-input').count() === 1, 'g5: may type their own name');
  }
  await shot('03-picked');
  await layout(page, vp, pid, 'chooser with name panel');
  await press(page, vp, page.locator('.buddy-chip').nth(1));
  ok(await page.locator('.buddy-chip').nth(1).evaluate(el => el.classList.contains('on')), 'name chip selects');
  ok((await page.locator('#buddy-preview-name').textContent()) === NAMES[type1][1], 'preview shows the picked name');
  let expectName = NAMES[type1][1];
  if (!isK) {
    const input = page.locator('#buddy-own-input');
    await input.fill('Supercalifragilistic');
    ok((await input.inputValue()).length <= 12, 'own name capped at 12 characters');
    await input.fill('<b>Zap</b>');
    ok(!/[<>]/.test(await input.inputValue()), 'own name strips markup characters');
    await input.fill('Captain Byte');
    ok((await page.locator('#buddy-preview-name').textContent()) === 'Captain Byte', 'preview follows the typed name');
    ok(await page.locator('.buddy-chip.on').count() === 0, 'typing a name deselects the chips');
    expectName = 'Captain Byte';
    await shot('03b-typed-name');
  }
  await press(page, vp, page.locator('.buddy-go'));
  await page.waitForSelector('.buddy-card:not(.buddy-card--invite)');
  let s = await store(page, pid);
  ok(s.type === type1 && s.name === expectName, `buddy saved (${s.type}/${s.name})`);
  ok(typeof s.lastLevel === 'number', 'last level seen is remembered');
  ok((await lastToast(page)).includes(expectName), 'welcome toast names the buddy');
  if (isK) { await page.waitForTimeout(400); ok(await spokenHas(page, 'is your Brain Buddy'), 'K: welcome read aloud'); }
  ok(await page.evaluate(() => JSON.parse(localStorage.getItem(STORAGE_KEY)).profiles[currentProfile.id].fun.buddy.type), 'buddy persisted to localStorage');
  await page.waitForTimeout(500);
  await shot('04-hub-buddy');
  await layout(page, vp, pid, 'hub with buddy');
  ok(await page.locator('.fun-zone .buddy-card .buddy-card-name').textContent() === expectName, 'hub card shows the name');
  ok(/EGG/.test(await page.locator('.buddy-card').textContent()), 'new child starts at EGG');
  ok(/XP to hatch/i.test(await page.locator('.buddy-card-next').textContent()), 'hub card shows XP to next stage');

  // ── 4. Buddy room ──
  await press(page, vp, page.locator('.buddy-card'));
  await page.waitForSelector('#buddy-room .buddy-room');
  const line1 = (await page.locator('#buddy-line').textContent()).trim();
  ok(line1.length > 10 && line1.includes(expectName), 'room opens with a hello from the buddy');
  ok((await page.locator('#buddy-say .js-speak').getAttribute('data-speak-text')) === line1, 'room 🔊 reads the current line');
  if (isK) { await page.waitForTimeout(400); ok(await spokenHas(page, line1), 'K: room line read aloud'); }
  await shot('05-room');
  await layout(page, vp, pid, 'room');
  await press(page, vp, page.locator('.buddy-room-stage'));
  ok(await page.locator('.buddy-heart').count() >= 1, 'petting makes hearts');
  const line2 = (await page.locator('#buddy-line').textContent()).trim();
  ok(line2 && line2 !== line1, 'petting: buddy says something new');
  await shot('06-room-pet');
  await press(page, vp, page.locator('.buddy-more'));
  const line3 = (await page.locator('#buddy-line').textContent()).trim();
  ok(line3 && line3 !== line2, 'tell me more: a new line');
  // Facts come from the buddy's own (checked) list.
  const factOk = await page.evaluate(({ lines, type }) => {
    const facts = BUDDY_TYPES[type].facts;
    const f = lines.filter(l => /^(Did you know\?|Fun fact:)/.test(l));
    return f.length >= 1 && f.every(l => facts.some(x => l.endsWith(x)));
  }, { lines: [line2, line3], type: type1 });
  ok(factOk, 'a true fact from the buddy\'s list appears within two taps');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  ok(await page.locator('#buddy-room').count() === 0, 'Escape closes the room');
  await press(page, vp, page.locator('.buddy-card'));
  if (vp.touch) await page.touchscreen.tap(8, 8); else await page.mouse.click(8, 8);
  await page.waitForTimeout(250);
  ok(await page.locator('#buddy-room').count() === 0, 'tapping outside closes the room');
  await press(page, vp, page.locator('.buddy-card'));
  await press(page, vp, page.locator('.buddy-close'));
  ok(await page.locator('#buddy-room').count() === 0, 'CLOSE closes the room');
  if (!vp.touch) {
    await page.locator('.buddy-card').focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    ok(await page.locator('#buddy-room').count() === 1, 'keyboard: Enter on the card opens the room');
    for (let i = 0; i < 9; i++) await page.keyboard.press('Tab');
    ok(await page.evaluate(() => !!document.activeElement.closest('#buddy-room')), 'keyboard: Tab stays inside the room');
    await page.keyboard.press('Shift+Tab');
    ok(await page.evaluate(() => !!document.activeElement.closest('#buddy-room')), 'keyboard: Shift+Tab stays inside the room');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    ok(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('buddy-card')), 'keyboard: focus returns to the card');
  }

  // ── 5. Change buddy (keeps progress) and Back ──
  await page.evaluate(pid => { state.profiles[pid].xp = 40; saveState(); renderHub(); }, pid);
  await press(page, vp, page.locator('.buddy-card'));
  await press(page, vp, page.locator('.buddy-change'));
  await page.waitForSelector('.buddy-choose');
  ok(/Change your Brain Buddy/i.test(await page.locator('.buddy-choose-title').textContent()), 'change mode title');
  ok(await page.locator(`.buddy-tile[data-type="${type1}"].on`).count() === 1, 'change mode starts on the current buddy');
  ok(/BACK/.test(await page.locator('.buddy-later').textContent()), 'change mode has BACK');
  await shot('07-change');
  await press(page, vp, page.locator('.buddy-later'));
  ok((await store(page, pid)).type === type1, 'BACK changes nothing');
  await press(page, vp, page.locator('.buddy-card'));
  await press(page, vp, page.locator('.buddy-change'));
  if (!vp.touch) {
    await page.locator(`.buddy-tile[data-type="${type2}"]`).focus();
    await page.keyboard.press(' ');
    await page.waitForTimeout(200);
    ok(await page.locator(`.buddy-tile[data-type="${type2}"].on`).count() === 1, 'keyboard: Space picks a buddy');
  } else await press(page, vp, page.locator(`.buddy-tile[data-type="${type2}"]`));
  await press(page, vp, page.locator('.buddy-chip').nth(0));
  await press(page, vp, page.locator('.buddy-go'));
  await page.waitForSelector('.buddy-card');
  s = await store(page, pid);
  ok(s.type === type2 && s.name === NAMES[type2][0] && s.changes === 1, `changed buddy (${s.type}/${s.name}/${s.changes})`);
  ok(await page.evaluate(pid => state.profiles[pid].xp, pid) === 40, 'changing buddy keeps XP');
  const name = NAMES[type2][0];
  await press(page, vp, page.locator('.buddy-card'));
  ok((await page.locator('#buddy-line').textContent()).includes(name), 'the new buddy introduces itself');
  await press(page, vp, page.locator('.buddy-close'));

  // ── 6. Every stage on the hub card ──
  const STAGES = [[1, 'egg', 'EGG'], [2, 'egg', 'EGG'], [3, 'baby', 'BABY'], [6, 'explorer', 'EXPLORER'], [10, 'hero', 'HERO'], [15, 'legend', 'LEGEND']];
  for (const [L, id, nm] of STAGES) {
    await page.evaluate(({ pid, L }) => { state.profiles[pid].xp = (L - 1) * 150 + 20; FUN.store(pid, 'buddy').lastLevel = L; renderHub(); }, { pid, L });
    await page.waitForTimeout(200);
    const card = page.locator('.buddy-card');
    ok(await card.locator(`.buddy-st-${id}`).count() === 1, `L${L}: drawn as ${id}`);
    ok((await card.textContent()).includes(nm), `L${L}: card names the stage ${nm}`);
    if (L === 2) ok(await card.locator('.buddy-crack').count() === 1, 'L2: the egg is cracking');
    if (L === 6) ok(await card.locator('.buddy-bag').count() === 1, 'explorer has a 🎒');
    if (L === 10) ok(await card.locator('.buddy-cape').count() === 1 && await card.locator('.buddy-aura').count() === 1, 'hero has cape and aura');
    if (L === 15) ok(await card.locator('.buddy-crown').count() === 1 && /Top stage/i.test(await card.textContent()), 'legend has a 👑 and is the top stage');
    if (L < 15) ok(/\d+ XP to/.test(await card.locator('.buddy-card-next').textContent()), `L${L}: XP to the next stage`);
    await card.screenshot({ path: path.join(SHOTS, `${tag}-08-stage-L${L}.png`) });
  }
  await press(page, vp, page.locator('.buddy-card'));
  await page.waitForTimeout(350);
  ok(await page.locator('.buddy-track-step.now').textContent().then(t => t.includes('LEGEND')), 'room stage track marks LEGEND');
  ok(/legend/i.test(await page.locator('#buddy-line').textContent()), 'first visit after evolving: the buddy shows off its new look');
  await shot('09-room-legend');
  await layout(page, vp, pid, 'room legend');
  await press(page, vp, page.locator('.buddy-close'));
  ok(await page.locator('.buddy-card--new').count() === 0, 'visiting the room clears the new-look badge');
  // level-up noticed on the hub (XP from somewhere else)
  await page.evaluate(pid => { FUN.store(pid, 'buddy').lastLevel = 4; state.profiles[pid].xp = 4 * 150; renderHub(); }, pid);
  await page.waitForTimeout(150);
  ok((await page.evaluate(() => window.__levelUps.slice(-1)[0])).level === 5, 'hub notices a level-up and emits levelUp');
  ok((await lastToast(page)).includes('LEVEL 5!'), 'hub level-up toast');

  // ── 7. Quiz bar reactions + an evolving level-up ──
  const before = isK ? { xp: 295, lvl: 2, to: 3, cur: 'egg', stage: 'BABY', st: 'baby', trophy: 'buddy_hatched' }
                     : { xp: 1340, lvl: 9, to: 10, cur: 'explorer', stage: 'HERO', st: 'hero', trophy: 'buddy_hero' };
  await page.evaluate(({ pid, b }) => {
    const d = state.profiles[pid];
    d.xp = b.xp; d.trophies = d.trophies.filter(t => t !== 'buddy_hatched' && t !== 'buddy_hero');
    FUN.store(pid, 'buddy').lastLevel = b.lvl; saveState(); renderHub();
  }, { pid, b: before });
  const QS = [
    mc('Which one is a fruit?', 0),
    mc('Which one is a fruit? (try 2)', 0),
    tf('The sun is cold.', false),
    mc('Pick the fruit.', 0), mc('Pick the fruit again.', 0), mc('One more fruit.', 0),
    mc('Last one: which is a fruit?', 0),
  ];
  await startControlled(page, vp, QS);
  let f = await qb(page);
  ok(f && f.h <= 44.5 && f.w <= 44.5, `quiz-bar face is small (${f && Math.round(f.w)}x${f && Math.round(f.h)})`);
  ok(f && f.pe === 'none', 'quiz-bar face never blocks taps');
  ok(f && f.stage.includes('buddy-st-' + before.cur), 'face shows the current stage (' + before.cur + ')');
  await shot('10-quiz');
  await layout(page, vp, pid, 'quiz');
  // Q1 right → happy jump + ❤️, and the level-up
  await press(page, vp, page.locator('.choice').nth(0));
  f = await qb(page);
  ok(/buddy-qb--happy/.test(f.cls) && f.fx.some(x => x.includes('❤️')), 'right → happy jump + ❤️');
  const lu = await page.evaluate(() => window.__levelUps.slice(-1)[0]);
  ok(lu && lu.level === before.to && lu.profileId === pid, `levelUp emitted {profileId:${pid}, level:${before.to}}`);
  const t1 = await lastToast(page);
  ok(t1.includes(`LEVEL ${before.to}!`) && t1.includes(`${name} is now a ${before.stage}!`), `evolution toast: "${t1}"`);
  ok(new RegExp('buddy-st-' + before.st).test(f.stage), 'the face evolves on the spot');
  ok(await page.evaluate(({ pid, t }) => state.profiles[pid].trophies.includes(t), { pid, t: before.trophy }), `trophy ${before.trophy} awarded`);
  ok((await store(page, pid)).lastLevel === before.to, 'last level seen updated');
  await shot('11-quiz-right-levelup');
  await page.waitForTimeout(950);
  f = await qb(page);
  ok(!/buddy-qb--happy/.test(f.cls) && f.fx.length === 0, 'reaction is over within 900ms');
  await next(page, vp);
  // Q2 wrong → 🤔, then right → 🌟
  await press(page, vp, page.locator('.choice').nth(1));
  f = await qb(page);
  ok(await page.locator('.think-box').count() === 1, 'engine shows THINK AGAIN');
  ok(/buddy-qb--think/.test(f.cls) && f.fx.some(x => x.includes('🤔')), 'retry → 🤔 thought bubble');
  await shot('12-quiz-think');
  await page.waitForTimeout(300);
  await press(page, vp, page.locator('.choice').nth(0));
  f = await qb(page);
  ok(/buddy-qb--fixed/.test(f.cls) && f.fx.some(x => x.includes('🌟')), 'fixed after a hint → 🌟 sparkle');
  await next(page, vp);
  // Q3 true/false wrong → wobble + 💪
  await press(page, vp, page.locator('.true-btn'));
  f = await qb(page);
  ok(/buddy-qb--wrong/.test(f.cls) && f.fx.some(x => x.includes('💪')), 'final wrong → gentle wobble + 💪');
  await shot('13-quiz-wrong');
  await next(page, vp);
  // Q4-6 right → streak 3 → 🔥
  for (let i = 0; i < 3; i++) {
    await press(page, vp, page.locator('.choice').nth(0));
    f = await qb(page);
    ok(/buddy-qb--fire/.test(f.cls) === (i === 2), `streak ${i + 1}: fire ${i === 2 ? 'on' : 'off'}`);
    await next(page, vp);
  }
  f = await qb(page);
  ok(/buddy-qb--fire/.test(f.cls), 'fire glow carries onto the next question');
  await page.waitForTimeout(300);
  await shot('14-quiz-fire');
  // Q7 wrong, wrong → streak broken, fire off
  await press(page, vp, page.locator('.choice').nth(1));
  f = await qb(page);
  ok(!/buddy-qb--fire/.test(f.cls), 'a miss puts the fire out');
  await page.waitForTimeout(300);
  await press(page, vp, page.locator('.choice').nth(2));
  await press(page, vp, page.locator('#fb .next-btn'));       // FINISH ROUND
  await page.waitForSelector('.complete');
  await page.waitForTimeout(1200);
  ok(await page.locator('.buddy-done.buddy-done--good').count() === 1, 'round reaction: good round');
  const doneText = await page.locator('.buddy-done').textContent();
  ok(doneText.includes(`grew into a ${before.stage}`), 'round reaction celebrates the evolution');
  ok(!NEGATIVE.test(await page.locator('.buddy-done .buddy-bubble-text').textContent()), 'round reaction is never negative');
  ok(await page.locator('.buddy-done .js-speak').count() === 1, 'round reaction has a 🔊');
  if (isK) ok(await spokenHas(page, 'grew into a baby'), 'K: round reaction read aloud');
  await shot('15-complete');
  await layout(page, vp, pid, 'complete');

  // ── 8. Tough round + a level-up with no stage change ──
  const plain = isK ? { xp: 445, lvl: 3, to: 4 } : { xp: 1645, lvl: 11, to: 12 };
  await page.evaluate(({ pid, b }) => { state.profiles[pid].xp = b.xp; FUN.store(pid, 'buddy').lastLevel = b.lvl; }, { pid, b: plain });
  await startControlled(page, vp, [mc('Which one is a fruit?', 0), tf('The sun is cold.', false), tf('Ice is hot.', false)]);
  await press(page, vp, page.locator('.choice').nth(0));
  const t2 = await lastToast(page);
  ok(t2 === `LEVEL ${plain.to}!`, `plain level-up toast: "${t2}"`);
  await next(page, vp);
  await press(page, vp, page.locator('.true-btn')); await next(page, vp);
  await press(page, vp, page.locator('.true-btn'));
  await press(page, vp, page.locator('#fb .next-btn'));
  await page.waitForSelector('.complete');
  await page.waitForTimeout(600);
  ok(await page.locator('.buddy-done.buddy-done--tough').count() === 1, 'tough round gets the encouraging reaction');
  const tough = await page.locator('.buddy-done .buddy-bubble-text').textContent();
  ok(!NEGATIVE.test(tough) && /(proud|kept going|finished)/i.test(tough), `tough-round line is kind: "${tough}"`);
  ok((await page.locator('.buddy-done').textContent()).includes(`LEVEL ${plain.to}`), 'round reaction mentions the new level');
  await shot('16-complete-tough');

  // ── 9. A normal round, start to finish, with the module loaded ──
  await press(page, vp, page.locator('.next-btn', { hasText: 'BACK TO PACKS' }));
  await page.waitForSelector('.hub');
  await press(page, vp, page.locator('.pack-card').first());
  if (await page.locator('.briefing-go').count()) await press(page, vp, page.locator('.briefing-go'));
  const types = [];
  for (let n = 0; n < 12; n++) {
    if (await page.locator('.complete').count()) break;
    await page.waitForSelector('.question-frame');
    ok(await page.locator('#buddy-qb').count() === 1, `normal round Q${n + 1}: buddy rides along`);
    types.push(await answerCorrect(page, vp));
    await page.waitForSelector('#fb .next-btn');
    await press(page, vp, page.locator('#fb .next-btn'));
  }
  await page.waitForSelector('.complete');
  ok(await page.locator('.complete').count() === 1, `normal round finished (${types.length} questions: ${[...new Set(types)].join(',')})`);
  ok(types.length === 10, 'normal round had 10 questions');
  ok(await page.locator('.buddy-done').count() === 1, 'buddy reacts on the normal complete screen');
  await page.waitForTimeout(800);
  await shot('17-normal-complete');

  // ── 10. buddyFace for other modules ──
  const face = await page.evaluate(pid => buddyFace(pid), pid);
  ok(face.includes('buddy-av') && face.includes(isK ? '🐢' : '🦀'), 'buddyFace(pid) returns the buddy');
  ok(await page.evaluate(() => buddyFace('g3')) === '', 'buddyFace is empty for a child with no buddy');

  ok(errors.length === 0, 'no page errors: ' + errors.join(' | '));
  await ctx.close();
}

// A lighter pass: phone width (390px) and reduced motion.
async function runLight(browser, vp, pid, extra) {
  const tag = `${vp.name}-${pid}`;
  console.log(`\n▶ ${tag} (light)`);
  const { ctx, page, errors } = await newPage(browser, vp, extra);
  const shot = name => page.screenshot({ path: path.join(SHOTS, `${tag}-${name}.png`) });
  await press(page, vp, page.locator(`.profile-card[onclick*="'${pid}'"]`));
  await page.waitForSelector('.buddy-choose');
  await page.waitForTimeout(300);
  await shot('01-chooser');
  await layout(page, vp, pid, 'chooser');
  await press(page, vp, page.locator('.buddy-tile[data-type="crab"]'));
  await page.waitForTimeout(450);
  await shot('02-picked');
  await layout(page, vp, pid, 'name panel');
  if (pid !== 'k') await page.locator('#buddy-own-input').fill('Abcdefghijkl');
  await press(page, vp, page.locator('.buddy-go'));
  await page.waitForSelector('.buddy-card');
  await page.evaluate(pid => { state.profiles[pid].xp = 2400; FUN.store(pid, 'buddy').lastLevel = 17; renderHub(); }, pid);
  await page.waitForTimeout(300);
  await shot('03-hub');
  await layout(page, vp, pid, 'hub');
  await press(page, vp, page.locator('.buddy-card'));
  await page.waitForTimeout(350);
  await shot('04-room');
  await layout(page, vp, pid, 'room');
  await press(page, vp, page.locator('.buddy-close'));
  await page.evaluate(pid => { state.profiles[pid].xp = 295; FUN.store(pid, 'buddy').lastLevel = 2; }, pid);
  await startControlled(page, vp, [mc('Which one is a fruit?', 0), mc('Pick the fruit.', 0)]);
  await layout(page, vp, pid, 'quiz');
  await press(page, vp, page.locator('.choice').nth(1));
  ok(/buddy-qb--think/.test((await qb(page)).cls), 'reacts under ' + (extra ? 'reduced motion' : 'phone width'));
  await shot('05-quiz-think');
  await press(page, vp, page.locator('.choice').nth(0));
  await layout(page, vp, pid, 'quiz feedback');
  await next(page, vp);
  await press(page, vp, page.locator('.choice').nth(0));
  await press(page, vp, page.locator('#fb .next-btn'));
  await page.waitForSelector('.complete');
  await page.waitForTimeout(500);
  await shot('06-complete');
  await layout(page, vp, pid, 'complete');
  ok(errors.length === 0, 'no page errors: ' + errors.join(' | '));
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ executablePath: app.CHROMIUM });
  const t0 = Date.now();
  try {
    for (const vp of [{ name: 'ipad', width: 820, height: 1180, touch: true }, { name: 'laptop', width: 1440, height: 900, touch: false }]) {
      for (const pid of ['k', 'g5']) await runFull(browser, vp, pid);
    }
    await runLight(browser, { name: 'phone', width: 390, height: 844, touch: true }, 'k');
    await runLight(browser, { name: 'phone', width: 390, height: 844, touch: true }, 'g5');
    await runLight(browser, { name: 'reduced', width: 1024, height: 768, touch: false }, 'g3', { reducedMotion: 'reduce' });
  } catch (e) {
    fails++;
    failList.push('crashed: ' + (e && e.stack || e));
    console.log('  CRASH ' + (e && e.stack || e));
  }
  await browser.close();
  console.log(`\nscreenshots: tools/${path.relative(app.TOOLS, SHOTS)}/`);
  if (fails) console.log('failures:\n  ' + failList.join('\n  '));
  console.log(`buddy: ${fails ? 'FAIL' : 'PASS'} — ${passes} checks passed, ${fails} failed (${Math.round((Date.now() - t0) / 1000)}s)`);
  process.exit(fails ? 1 : 0);
})();
