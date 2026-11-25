// Reset all progress, and undo it.
//   node reset.js [app.html]
// Through the parent dashboard (PIN 0000): with nothing reset yet there is no
// undo button; RESET wipes the 5th grader's 1234 XP to 0 and reloads; the
// dashboard then offers the undo, whose question names each child's XP in the
// save it brings back and in the one here now, and which brings the 1234 XP
// back. The undo swaps the two saves, so nothing played since is lost: after
// more play (1300 XP) the same button switches back to the reset save, and
// again to the 1300 XP. No JS errors.
const { chromium } = require('playwright');
const path = require('path');
const APP = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'Ticali_Trio_Family_Edition.html'));
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
(async () => {
  const b = await chromium.launch({ executablePath: CHROMIUM }); const ctx = await b.newContext(); const p = await ctx.newPage();
  const errs = [], asked = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => { asked.push(d.message()); return d.type() === 'prompt' ? d.accept('0000') : d.accept(); });
  const undoButton = () => p.evaluate(() => !!document.querySelector('[onclick="restoreBeforeReset()"]'));
  const undo = async () => {
    await p.evaluate(() => parentGate()); await p.waitForTimeout(200);
    await Promise.all([p.waitForNavigation(), p.evaluate(() => document.querySelector('[onclick="restoreBeforeReset()"]').click())]);
    await p.waitForTimeout(300);
    return p.evaluate(() => state.profiles.g5.xp);
  };
  await p.goto(APP); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  await p.evaluate(() => { state.profiles.g5.xp = 1234; saveState(); parentGate(); });
  const before = await undoButton();
  await Promise.all([p.waitForNavigation(), p.evaluate(() => document.querySelector('.reset-btn').click())]); await p.waitForTimeout(300);
  const afterReset = await p.evaluate(() => state.profiles.g5.xp);
  await p.evaluate(() => parentGate()); await p.waitForTimeout(200);
  const undoShown = await undoButton();
  asked.length = 0;
  const restored = await undo();
  const question = asked.find(m => /Switch back/.test(m)) || '';
  await p.evaluate(() => { state.profiles.g5.xp = 1300; saveState(); });
  await p.evaluate(() => parentGate()); await p.waitForTimeout(200);
  const stillOffered = await undoButton();
  const backToReset = await undo();
  const backAgain = await undo();
  await b.close();
  const fails = [];
  if (before) fails.push('an undo button before any reset');
  if (afterReset !== 0) fails.push(`after RESET the 5th grader has ${afterReset} XP, not 0`);
  if (!undoShown) fails.push('no undo button after the reset');
  if (!/\(K: 0 XP, 3rd: 0 XP, 5th: 1234 XP\)\?/.test(question) || !/here now \(K: 0 XP, 3rd: 0 XP, 5th: 0 XP\)/.test(question)) fails.push(`the undo's question does not name both saves' XP: "${question}"`);
  if (restored !== 1234) fails.push(`after the undo the 5th grader has ${restored} XP, not 1234`);
  if (!stillOffered) fails.push('after the undo there is no button to switch back');
  if (backToReset !== 0) fails.push(`switching back again gives the 5th grader ${backToReset} XP, not the reset save's 0`);
  if (backAgain !== 1300) fails.push(`and switching back once more gives ${backAgain} XP, not the 1300 played after the undo`);
  errs.forEach(e => fails.push('JS error ' + e));
  fails.forEach(f => console.log('FAIL ' + f));
  console.log(fails.length ? `reset: FAIL — ${fails.length} problems` : 'reset: PASS — RESET clears progress, the undo brings it back and keeps what it replaced, so nothing played since is lost');
  process.exit(fails.length ? 1 : 0);
})();
