// Reset all progress, and undo it.
//   node reset.js [app.html]
// Through the parent dashboard (PIN 0000): with nothing reset yet there is no
// undo button; RESET wipes the 5th grader's 1234 XP to 0 and reloads; the
// dashboard then offers the undo, which brings the 1234 XP back; after the
// undo the button is gone. No JS errors.
const { chromium } = require('playwright');
const path = require('path');
const APP = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'Ticali_Trio_Family_Edition.html'));
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
(async () => {
  const b = await chromium.launch({ executablePath: CHROMIUM }); const ctx = await b.newContext(); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.type() === 'prompt' ? d.accept('0000') : d.accept());
  await p.goto(APP); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  await p.evaluate(() => { state.profiles.g5.xp = 1234; saveState(); parentGate(); });
  const before = await p.evaluate(() => !!document.querySelector('[onclick="restoreBeforeReset()"]'));
  await Promise.all([p.waitForNavigation(), p.evaluate(() => document.querySelector('.reset-btn').click())]); await p.waitForTimeout(300);
  const afterReset = await p.evaluate(() => state.profiles.g5.xp);
  await p.evaluate(() => parentGate()); await p.waitForTimeout(200);
  const undoShown = await p.evaluate(() => !!document.querySelector('[onclick="restoreBeforeReset()"]'));
  await Promise.all([p.waitForNavigation(), p.evaluate(() => document.querySelector('[onclick="restoreBeforeReset()"]').click())]); await p.waitForTimeout(300);
  const restored = await p.evaluate(() => state.profiles.g5.xp);
  await p.evaluate(() => parentGate()); await p.waitForTimeout(200);
  const goneAfter = await p.evaluate(() => !document.querySelector('[onclick="restoreBeforeReset()"]'));
  await b.close();
  const fails = [];
  if (before) fails.push('an undo button before any reset');
  if (afterReset !== 0) fails.push(`after RESET the 5th grader has ${afterReset} XP, not 0`);
  if (!undoShown) fails.push('no undo button after the reset');
  if (restored !== 1234) fails.push(`after the undo the 5th grader has ${restored} XP, not 1234`);
  if (!goneAfter) fails.push('the undo button is still there after the undo');
  errs.forEach(e => fails.push('JS error ' + e));
  fails.forEach(f => console.log('FAIL ' + f));
  console.log(fails.length ? `reset: FAIL — ${fails.length} problems` : 'reset: PASS — RESET clears progress, the undo brings it back, then the undo is gone');
  process.exit(fails.length ? 1 : 0);
})();
