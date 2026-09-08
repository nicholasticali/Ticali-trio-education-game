// Every pack in every profile must hand back a full round of ten well-formed
// questions. A pack that silently returns [] shows the child an alert and
// bounces them to the hub, which is exactly the failure a smoke test that
// only opens the first pack would miss.
const { chromium } = require('playwright');
const path = require('path');
const APP = 'file://' + path.resolve(process.argv[2] || require('path').join(__dirname, '..', 'Ticali_Trio_Family_Edition.html'));

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(APP);
  await page.waitForTimeout(300);

  const out = await page.evaluate(() => {
    const rows = [];
    for (const profileId of Object.keys(PACKS)) {
      for (const pack of PACKS[profileId]) {
        let qs = [], err = null;
        try { qs = getQuestions(pack, profileId) || []; }
        catch (e) { err = e.message; }
        const problems = [];
        if (err) problems.push('threw: ' + err);
        if (!err && qs.length === 0) problems.push('returned 0 questions');
        else if (!err && qs.length < 10) problems.push('returned only ' + qs.length + ' questions');
        qs.forEach((q, i) => {
          const t = q.type || 'mc';
          if (t === 'mc') {
            if (!Array.isArray(q.options) || q.options.length !== 4) problems.push(`q${i+1} mc has ${q.options ? q.options.length : 'no'} options`);
            if (typeof q.correct !== 'number' || q.correct < 0 || q.correct >= (q.options || []).length) problems.push(`q${i+1} mc correct index ${q.correct} invalid`);
          } else if (t === 'tf') {
            if (typeof q.answer !== 'boolean') problems.push(`q${i+1} tf answer not boolean`);
            if (!q.statement) problems.push(`q${i+1} tf no statement`);
          } else if (t === 'typed' || t === 'fib' || t === 'showwork') {
            if (!Array.isArray(q.acceptedAnswers) || !q.acceptedAnswers.length) problems.push(`q${i+1} ${t} no acceptedAnswers`);
            if (!q.text) problems.push(`q${i+1} ${t} no text`);
          } else {
            problems.push(`q${i+1} unknown type "${t}"`);
          }
        });
        rows.push({ profileId, id: pack.id, title: pack.title, tier: pack.tier, subject: pack.subject, n: qs.length, problems });
      }
    }
    // Also surface any pack pointing at a bank that does not exist.
    const orphans = [];
    for (const profileId of Object.keys(PACKS)) {
      for (const pack of PACKS[profileId]) {
        for (const key of PACK_BANK_KEYS) {
          if (pack[key] && !BANKS[pack[key]]) orphans.push(`${profileId}/${pack.id} -> missing bank ${pack[key]}`);
        }
      }
    }
    return { rows, orphans, bankCount: Object.keys(BANKS).length };
  });

  await browser.close();

  const bad = out.rows.filter(r => r.problems.length);
  const byProfile = {};
  out.rows.forEach(r => { byProfile[r.profileId] = (byProfile[r.profileId] || 0) + 1; });

  console.log(`\n${out.bankCount} banks registered`);
  console.log('packs per profile: ' + Object.entries(byProfile).map(([k, v]) => `${k}=${v}`).join('  '));
  const tiers = {};
  out.rows.forEach(r => { const k = r.profileId + '/' + r.tier; tiers[k] = (tiers[k] || 0) + 1; });
  console.log('by tier: ' + Object.entries(tiers).sort().map(([k, v]) => `${k}=${v}`).join('  '));

  if (out.orphans.length) {
    console.log(`\nPACKS POINTING AT A MISSING BANK (${out.orphans.length}):`);
    out.orphans.forEach(o => console.log('  ' + o));
  }
  if (errors.length) { console.log('\nJS ERRORS:'); errors.forEach(e => console.log('  ' + e)); }

  console.log(`\n${bad.length} of ${out.rows.length} packs have problems:`);
  bad.forEach(r => {
    console.log(`  ${r.profileId}/${r.id} "${r.title}" (${r.n} qs)`);
    [...new Set(r.problems)].slice(0, 6).forEach(p => console.log(`      ${p}`));
  });
  if (!bad.length) console.log('  none — every pack returns a full, well-formed round.');
  process.exit(bad.length || out.orphans.length || errors.length ? 1 : 0);
})();
