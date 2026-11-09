// Back up and restore progress (the parent dashboard's BACK UP PROGRESS panel).
//   node backup.js [app.html]
// Progress lives on one device, in one place (on an iPad the Home Screen icon and Safari each keep
// their own), so a grown-up can save it to a file and bring it back anywhere. Checks:
// 1. the panel is on the dashboard, its buttons big enough to tap, nothing wider than an iPhone;
// 2. BACK UP: the share sheet (iPad, iPhone) gets a dated .json file holding the whole save, a
//    closed share sheet makes nothing, and a device with no share sheet downloads the file;
// 3. COPY AS TEXT copies the same backup, or puts it in the box to copy by hand;
// 4. RESTORE FROM A FILE brings every child's progress back after a yes, keeps what was there
//    for UNDO, and a no changes nothing; RESTORE FROM THE TEXT does the same;
// 5. last year's save (old grade keys) and a bare save (not wrapped in a backup) restore too;
// 6. a file that is not a backup, or a damaged one, is refused with a message and nothing changes;
// 7. another open tab picks up the restored progress instead of saving its own over it;
// 8. no JS errors.
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const APP = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'Ticali_Trio_Family_Edition.html'));
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
let good = 0; const fails = [];
const ok = (c, m) => { if (c) { good++; console.log('  ok   ' + m); } else { fails.push(m); console.log('  FAIL ' + m); } };
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ticali-backup-'));

(async () => {
  const b = await chromium.launch({ executablePath: CHROMIUM });
  const ctx = await b.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, acceptDownloads: true });
  const errs = [];
  // Each dialog: the PIN, then whatever `answer` says to a confirm.
  let answer = true, asked = [];
  const open = async () => {
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message));
    p.on('dialog', d => { asked.push(d.message()); return d.type() === 'prompt' ? d.accept('0000') : (answer ? d.accept() : d.dismiss()); });
    await p.addInitScript(() => { const ss = window.speechSynthesis; ss.speak = u => setTimeout(() => u.onend && u.onend({}), 20); ss.getVoices = () => []; });
    return p;
  };
  const p = await open();
  await p.goto(APP); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForSelector('.title-screen');
  await p.evaluate(() => { state.profiles.k.xp = 111; state.profiles.g3.xp = 777; state.profiles.g3.attempts = 40; state.profiles.g5.xp = 1234; state.profiles.g5.trophies = ['first']; saveState(); });
  const dash = async page => { await page.evaluate(() => parentGate()); await page.waitForSelector('.backup-block'); };
  const xp = page => page.evaluate(() => { const s = JSON.parse(localStorage.getItem('tapChampions_v3')); return [s.profiles.k.xp, s.profiles.g3.xp, s.profiles.g5.xp].join('/'); });
  const note = page => page.evaluate(() => (document.getElementById('backup-note') || {}).textContent || '');

  // ─── 1. the panel ───
  console.log('\n▶ the panel');
  await dash(p);
  const panel = await p.evaluate(() => {
    const blk = document.querySelector('.backup-block');
    const btns = [...blk.querySelectorAll('.backup-btn')];
    return { text: blk.textContent, heights: btns.map(x => Math.round(x.getBoundingClientRect().height)), labels: btns.map(x => x.textContent.trim()) };
  });
  ok(/Home Screen icon and Safari each keep their own/.test(panel.text) && /deleting the icon deletes its progress/.test(panel.text), 'it explains that progress stays on the device, and the icon and Safari each keep their own');
  ok(panel.labels.length === 4 && panel.heights.every(h => h >= 48), 'four buttons, each at least 48 px tall: ' + panel.labels.map((l, i) => `${l} (${panel.heights[i]})`).join(', '));
  await p.setViewportSize({ width: 375, height: 800 });
  ok(await p.evaluate(() => { const blk = document.querySelector('.backup-block'); return [...blk.querySelectorAll('*')].every(e => e.getBoundingClientRect().right <= innerWidth + 1) && document.documentElement.scrollWidth <= innerWidth; }), 'on an iPhone-wide screen nothing in it runs off the side');
  await p.setViewportSize({ width: 820, height: 1180 });

  // ─── 2. BACK UP ───
  console.log('\n▶ BACK UP PROGRESS');
  await p.evaluate(() => {
    window.__shared = null;
    navigator.canShare = d => !!(d && d.files && d.files.length);
    navigator.share = async d => { const f = d.files[0]; window.__shared = { name: f.name, type: f.type, text: await f.text() }; };
  });
  await p.locator('.backup-go').tap(); await p.waitForTimeout(300);
  const shared = await p.evaluate(() => window.__shared);
  const file = shared && JSON.parse(shared.text);
  ok(!!shared && /^Ticali-Trio-progress-\d{4}-\d\d-\d\d\.json$/.test(shared.name) && shared.type === 'application/json', 'on an iPad the share sheet gets a dated file: ' + (shared && shared.name));
  ok(file && file.game === 'Ticali Trio' && file.save && file.save.profiles.g3.xp === 777 && file.save.profiles.g5.xp === 1234 && file.save.profiles.k.xp === 111 && !isNaN(new Date(file.made)), 'it holds the whole save (all three children) and when it was made');
  ok(/Backup made/.test(await note(p)), 'and the panel says so: "' + (await note(p)).trim() + '"');
  await p.evaluate(() => { navigator.share = async () => { throw new DOMException('closed', 'AbortError'); }; });
  let downloaded = false; const dl = () => { downloaded = true; }; p.on('download', dl);
  await p.locator('.backup-go').tap(); await p.waitForTimeout(800);
  ok(!downloaded && /No backup was made/.test(await note(p)), 'closing the share sheet makes nothing: "' + (await note(p)).trim() + '"');
  p.off('download', dl);
  await p.evaluate(() => { navigator.canShare = undefined; navigator.share = undefined; });
  const [download] = await Promise.all([p.waitForEvent('download'), p.locator('.backup-go').tap()]);
  const backupFile = path.join(TMP, download.suggestedFilename());
  await download.saveAs(backupFile);
  const fileSaved = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
  ok(/^Ticali-Trio-progress-\d{4}-\d\d-\d\d\.json$/.test(download.suggestedFilename()) && fileSaved.save.profiles.g3.xp === 777, 'with no share sheet (a laptop) it downloads the same file: ' + download.suggestedFilename());

  // ─── 3. COPY AS TEXT ───
  console.log('\n▶ COPY AS TEXT');
  await p.evaluate(() => { window.__copied = null; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async t => { window.__copied = t; } } }); });
  await p.locator('.backup-btn', { hasText: 'COPY AS TEXT' }).tap(); await p.waitForTimeout(200);
  const copied = await p.evaluate(() => window.__copied);
  ok(!!copied && JSON.parse(copied).save.profiles.g5.xp === 1234 && /Copied/.test(await note(p)), 'it copies the backup, to paste into Notes or an email');
  await p.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } }); });
  await p.locator('.backup-btn', { hasText: 'COPY AS TEXT' }).tap(); await p.waitForTimeout(200);
  const boxText = await p.evaluate(() => document.getElementById('backup-text').value);
  ok(!!boxText && JSON.parse(boxText).save.profiles.g5.xp === 1234 && /select all of it/.test(await note(p)), 'where copying is not allowed, the backup appears in the box to copy by hand');

  // ─── 4. RESTORE ───
  console.log('\n▶ RESTORE');
  await p.evaluate(() => { state.profiles.k.xp = 5; state.profiles.g3.xp = 6; state.profiles.g5.xp = 7; saveState(); renderParentDash(); });
  await p.waitForSelector('.backup-block');
  answer = false; asked = [];
  await p.setInputFiles('.backup-file input', backupFile); await p.waitForTimeout(500);
  ok(asked.length === 1 && /Restore the backup made .+ \(K: 111 XP, 3rd: 777 XP, 5th: 1234 XP\)\?/.test(asked[0]), 'a backup file first asks, naming its date and each child\'s XP: "' + (asked[0] || '').slice(0, 90) + '…"');
  ok(await xp(p) === '5/6/7' && /Nothing was changed/.test(await note(p)), 'a no changes nothing');
  answer = true;
  await Promise.all([p.waitForNavigation(), p.setInputFiles('.backup-file input', backupFile)]);
  await p.waitForSelector('.title-screen');
  ok(await p.evaluate(() => [state.profiles.k.xp, state.profiles.g3.xp, state.profiles.g5.xp].join('/')) === '111/777/1234' && await xp(p) === '111/777/1234', 'a yes brings every child\'s progress back: 111/777/1234 XP');
  ok(await p.evaluate(() => state.profiles.g5.trophies.includes('first') && Array.isArray(state.profiles.g3.history)), 'trophies and history come back with it');
  await dash(p);
  ok(await p.locator('[onclick="restoreBeforeReset()"]').count() === 1 && /RESTORE/.test(await p.locator('[onclick="restoreBeforeReset()"]').textContent()), 'what was there before is kept: UNDO THE LAST RESET OR RESTORE');
  await Promise.all([p.waitForNavigation(), p.locator('[onclick="restoreBeforeReset()"]').click()]);
  await p.waitForSelector('.title-screen');
  ok(await xp(p) === '5/6/7', 'and the undo brings it back: 5/6/7 XP');
  await dash(p);
  await p.fill('#backup-text', fs.readFileSync(backupFile, 'utf8'));
  await Promise.all([p.waitForNavigation(), p.locator('.backup-btn', { hasText: 'RESTORE FROM THE TEXT' }).tap()]);
  await p.waitForSelector('.title-screen');
  ok(await xp(p) === '111/777/1234', 'RESTORE FROM THE TEXT does the same from a pasted backup');

  // ─── 5. older and bare saves ───
  console.log('\n▶ other saves');
  const lastYear = { profiles: { prek: { xp: 50, trophies: [], packs: {}, correct: 1, attempts: 2, bestStreak: 1 }, g2: { xp: 60, trophies: [], packs: {}, correct: 1, attempts: 2, bestStreak: 1 }, g4: { xp: 70, trophies: [], packs: {}, correct: 1, attempts: 2, bestStreak: 1 } }, parent: { reportRequired: true } };
  await dash(p);
  await p.fill('#backup-text', JSON.stringify(lastYear));
  await Promise.all([p.waitForNavigation(), p.locator('.backup-btn', { hasText: 'RESTORE FROM THE TEXT' }).tap()]);
  await p.waitForSelector('.title-screen');
  ok(await p.evaluate(() => [state.profiles.k.xp, state.profiles.g3.xp, state.profiles.g5.xp].join('/')) === '50/60/70' && await p.evaluate(() => Array.isArray(state.profiles.k.reviews) && state.profiles.k.unitNow && typeof state.profiles.k.unitNow === 'object'), "last year's save (a bare save, last year's grades) restores into this year's: 50/60/70 XP, brought up to date");

  // ─── 6. not a backup ───
  console.log('\n▶ not a backup');
  await dash(p);
  const before = await p.evaluate(() => localStorage.getItem('tapChampions_v3'));
  const bad = [
    ['plain text', 'hello there', /could not be read/],
    ['another app\'s file', JSON.stringify({ name: 'something else', items: [1, 2] }), /no children's progress/],
    ['a damaged backup', JSON.stringify({ game: 'Ticali Trio', save: { profiles: { g3: { xp: 5 } } } }), /damaged/],
    ['an empty box', '', /could not be read/],
  ];
  for (const [label, text, said] of bad) {
    asked = [];
    await p.fill('#backup-text', text);
    await p.locator('.backup-btn', { hasText: 'RESTORE FROM THE TEXT' }).tap(); await p.waitForTimeout(250);
    const n = await note(p);
    ok(!asked.length && said.test(n) && await p.evaluate(() => document.getElementById('backup-note').classList.contains('backup-bad')) && await p.evaluate(() => localStorage.getItem('tapChampions_v3')) === before, `${label}: refused, nothing changed: "${n.trim()}"`);
  }
  fs.writeFileSync(path.join(TMP, 'photo.json'), '\u0089PNG not json');
  await p.setInputFiles('.backup-file input', path.join(TMP, 'photo.json')); await p.waitForTimeout(400);
  ok(/could not be read/.test(await note(p)) && await p.evaluate(() => localStorage.getItem('tapChampions_v3')) === before, 'a file that is not a backup: refused, nothing changed');

  // ─── 7. another open tab ───
  console.log('\n▶ another open tab');
  const other = await open();
  await other.goto(APP); await other.waitForSelector('.title-screen');
  // The other tab has played more than the backup holds: merging child by child would keep its own.
  await other.evaluate(() => { state.profiles.g3.attempts = 500; state.profiles.g3.xp = 999; window.__stillHere = true; });
  await p.fill('#backup-text', fs.readFileSync(backupFile, 'utf8'));
  await Promise.all([p.waitForNavigation(), p.locator('.backup-btn', { hasText: 'RESTORE FROM THE TEXT' }).tap()]);
  await p.waitForSelector('.title-screen');
  await other.waitForFunction(() => !window.__stillHere, null, { timeout: 8000 }).catch(() => {});
  await other.waitForSelector('.title-screen').catch(() => {});
  await other.waitForTimeout(800);
  ok(await other.evaluate(() => !window.__stillHere && state.profiles.g3.xp === 777), 'the other tab starts again from the restored progress (777 XP), instead of keeping its own');
  await other.evaluate(() => { state.profiles.g3.xp += 10; saveState(); });
  ok(await xp(p) === '111/787/1234', 'and its next save adds to the restored progress: 111/787/1234 XP');

  ok(!errs.length, 'no JS errors' + (errs.length ? ': ' + [...new Set(errs)].slice(0, 3).join(' | ') : ''));
  await b.close();
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(fails.length ? `\nbackup: FAIL — ${fails.length} of ${good + fails.length} checks failed` : `\nbackup: PASS — ${good} checks: progress backs up to a file or text, restores anywhere after a yes, can be undone, and a wrong file changes nothing`);
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); console.log('backup: FAIL — ' + e.message.split('\n')[0]); fs.rmSync(TMP, { recursive: true, force: true }); process.exit(1); });
