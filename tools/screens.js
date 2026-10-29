// The smoke test walks the child's path: title, hub, a round. These are the
// screens it never opens — the parent dashboard, the progress chart, a
// walkthrough modal, the scratch pad, the on-screen number pad, every puzzle
// type, and each child's briefing card — audited
// at the same viewports for overflow and tap-target size.
const { chromium } = require('playwright');
const path = require('path');
const APP = 'file://' + path.resolve(process.argv[2] || require('path').join(__dirname, '..', 'Ticali_Trio_Family_Edition.html'));

const VIEWPORTS = [
  { name: 'iPad portrait',  width: 820,  height: 1180 },
  { name: 'iPad landscape', width: 1180, height: 820 },
  { name: 'Split View',     width: 507,  height: 1180 },
  { name: 'iPhone',         width: 390,  height: 844 },
];

async function audit(page, label, out) {
  const r = await page.evaluate(() => {
    const w = window.innerWidth;
    const small = [];
    const wide = [];
    document.querySelectorAll('button, .choice, .tf-btn, .pack-card, .profile-card, .parent-link, .numpad-key, .tut-step-dot, .scratch-color, [role="button"]').forEach(el => {
      const rect = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (rect.width === 0 || rect.height === 0 || cs.visibility === 'hidden') return;
      // A ::after hit expander counts toward the real target.
      const after = getComputedStyle(el, '::after');
      let h = rect.height, wd = rect.width;
      if (after && after.content !== 'none' && after.inset && after.inset.startsWith('-')) {
        const pad = Math.abs(parseFloat(after.inset)) * 2;
        h += pad; wd += pad;
      }
      if (h < 43.5 || wd < 39.5) small.push(`${(el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : el.tagName)} ${Math.round(wd)}x${Math.round(h)}`);
    });
    document.querySelectorAll('body *').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.right > w + 2) {
        wide.push(`${(el.className && typeof el.className === 'string' ? el.className.split(' ')[0] : el.tagName)} right=${Math.round(rect.right)}`);
      }
    });
    return { docW: document.documentElement.scrollWidth, innerW: w, small: [...new Set(small)], wide: [...new Set(wide)].slice(0, 4) };
  });
  if (r.docW > r.innerW + 2) out.push(`[${label}] overflows: ${r.docW} > ${r.innerW} :: ${r.wide.join(', ')}`);
  r.small.forEach(s => out.push(`[${label}] small target ${s}`));
}

// With the Brain Buddy module built in, a child's first visit asks her to
// choose a buddy before the hub. Choose one the way she would: tap a buddy,
// then the big button (the second press is a new spot, after a screen change,
// so it is spaced like a person's).
async function chooseBuddyIfAsked(page) {
  if (!(await page.locator('.buddy-choose').count())) return;
  await page.locator('.buddy-tile').first().click(); await page.waitForTimeout(450);
  await page.locator('.buddy-go').click(); await page.waitForTimeout(450);
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
  const out = [];
  const errs = [];

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: true, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(`[${vp.name}] ${e.message}`));
    page.on('dialog', d => d.accept('0000'));   // the parent PIN prompt
    await page.goto(APP);
    await page.waitForTimeout(300);

    // ─── Parent dashboard ───
    await page.evaluate(() => { window.prompt = () => '0000'; });
    await page.evaluate(() => parentGate());
    await page.waitForTimeout(250);
    if (!(await page.locator('.parent-dash').count())) out.push(`[${vp.name}] parent dashboard did not open`);
    else await audit(page, `${vp.name}/parent`, out);

    // ─── Progress chart ───
    await page.goto(APP); await page.waitForTimeout(250);
    await page.locator('.profile-card').nth(1).click(); await page.waitForTimeout(450); await chooseBuddyIfAsked(page);
    await page.locator('.switch-btn', { hasText: 'PROGRESS' }).click(); await page.waitForTimeout(250);
    await audit(page, `${vp.name}/progress`, out);

    // ─── Walkthrough modal ───
    await page.goto(APP); await page.waitForTimeout(250);
    await page.locator('.profile-card').nth(1).click(); await page.waitForTimeout(450); await chooseBuddyIfAsked(page);
    const tutPack = await page.evaluate(() => {
      const p = PACKS.g3.find(x => TUTORIALS[x.id]);
      return p ? p.id : null;
    });
    if (!tutPack) out.push(`[${vp.name}] no pack with a walkthrough found for g3`);
    else {
      await page.evaluate(id => startPack(id), tutPack);
      await page.waitForTimeout(250);
      await page.evaluate(id => openTutorial(id), tutPack);
      await page.waitForTimeout(350);
      if (!(await page.locator('.tut-modal').count())) out.push(`[${vp.name}] walkthrough did not open for ${tutPack}`);
      else {
        await audit(page, `${vp.name}/tutorial`, out);
        // Step through it to be sure every step renders.
        for (let i = 0; i < 4; i++) {
          const next = page.locator('.tut-ctrl-btn.primary');
          if (!(await next.count())) break;
          await next.click(); await page.waitForTimeout(150);
        }
      }
    }

    // ─── Scratch pad ───
    await page.goto(APP); await page.waitForTimeout(250);
    await page.locator('.profile-card').nth(1).click(); await page.waitForTimeout(450); await chooseBuddyIfAsked(page);
    await page.locator('.pack-card').first().click(); await page.waitForTimeout(450);
    if (await page.locator('.briefing-go').count()) { await page.locator('.briefing-go').click(); await page.waitForTimeout(450); }
    await page.locator('.scratch-btn').click(); await page.waitForTimeout(300);
    if (!(await page.locator('#scratch-overlay').count())) out.push(`[${vp.name}] scratch pad did not open`);
    else {
      await audit(page, `${vp.name}/scratch`, out);
      // Draw, undo, clear — checking the vector pipeline actually paints.
      const box = await page.locator('#scratch-canvas').boundingBox();
      await page.mouse.move(box.x + 40, box.y + 40);
      await page.mouse.down();
      for (let i = 0; i < 12; i++) await page.mouse.move(box.x + 40 + i * 12, box.y + 40 + i * 6);
      await page.mouse.up();
      await page.waitForTimeout(120);
      const painted = await page.evaluate(() => {
        const c = document.getElementById('scratch-canvas');
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
        return n;
      });
      if (painted < 50) out.push(`[${vp.name}] scratch pad drew nothing (${painted} px)`);
      await page.locator('#scratch-undo').click(); await page.waitForTimeout(120);
      const afterUndo = await page.evaluate(() => {
        const c = document.getElementById('scratch-canvas');
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
        return n;
      });
      if (afterUndo !== 0) out.push(`[${vp.name}] undo left ${afterUndo} px painted, expected 0`);
      await page.locator('#scratch-close').click(); await page.waitForTimeout(150);
      if (await page.locator('#scratch-overlay').count()) out.push(`[${vp.name}] scratch pad did not close`);
    }

    // ─── Number pad on a typed math question ───
    await page.goto(APP); await page.waitForTimeout(250);
    const padOk = await page.evaluate(() => {
      // Find a numeric typed question anywhere and render it.
      for (const pid of Object.keys(PACKS)) {
        for (const pack of PACKS[pid]) {
          const qs = getQuestions(pack, pid) || [];
          const q = qs.find(x => (x.type === 'typed' || x.type === 'fib') && numpadKeysFor(x) !== null);
          if (q) { window.__numpadQ = q; return { packId: pack.id, pid, text: q.text }; }
        }
      }
      return null;
    });
    if (!padOk) out.push(`[${vp.name}] could not find any question that should show the number pad`);
    else {
      await page.evaluate(({ pid, packId }) => {
        pickProfile(pid);
        currentPack = PACKS[pid].find(p => p.id === packId);
        questions = [window.__numpadQ];   // the one just found: a fresh draw is random and may hold none
        qIdx = 0; score = 0; xpEarned = 0; streak = 0; locked = false; roundLog = [];
        renderQuestion();
      }, padOk);
      await page.waitForTimeout(250);
      if (!(await page.locator('.numpad').count())) out.push(`[${vp.name}] number pad missing on a numeric typed question`);
      else {
        await audit(page, `${vp.name}/numpad`, out);
        const ro = await page.locator('#typedInput').getAttribute('readonly');
        if (ro === null) out.push(`[${vp.name}] number pad input is not readonly, so iOS will raise the keyboard`);
        await page.locator('.numpad-key').first().click();
        await page.waitForTimeout(80);
        const v = await page.locator('#typedInput').inputValue();
        if (!v) out.push(`[${vp.name}] number pad key did not enter anything`);
        // Backspace should empty it again.
        await page.locator('.numpad-key.back').click(); await page.waitForTimeout(80);
        const v2 = await page.locator('#typedInput').inputValue();
        if (v2 !== '') out.push(`[${vp.name}] backspace left "${v2}"`);
        // The keyboard escape hatch must remove readonly.
        await page.locator('.numpad-toggle').click(); await page.waitForTimeout(120);
        const ro2 = await page.locator('#typedInput').getAttribute('readonly');
        if (ro2 !== null) out.push(`[${vp.name}] keyboard escape hatch left the input readonly`);
      }
    }

    // ─── Every puzzle type, rendered on its own ───
    for (const pid of ['k', 'g5']) {
      await page.goto(APP); await page.waitForTimeout(250);
      const types = await page.evaluate(pid => {
        pickProfile(pid);
        const pool = [];
        for (const pk of PACKS[pid]) for (const q of (THINK_ITEMS[pk.id] || [])) pool.push({ pk: pk.id, q });
        const out = {};
        for (const { pk, q } of pool) if (!out[q.type]) out[q.type] = pk;
        return out;
      }, pid);
      if (!Object.keys(types).length) { out.push(`[${vp.name}] ${pid}: no puzzle items found`); continue; }
      for (const [type, packId] of Object.entries(types)) {
        await page.evaluate(({ pid, packId, type }) => {
          currentPack = PACKS[pid].find(p => p.id === packId);
          questions = [prepareQuestion(THINK_ITEMS[packId].find(q => q.type === type))];
          qIdx = 0; score = 0; xpEarned = 0; streak = 0; locked = false; roundLog = [];
          renderQuestion();
        }, { pid, packId, type });
        await page.waitForTimeout(250);
        await audit(page, `${vp.name}/${pid} puzzle ${type}`, out);
      }
    }

    // ─── Briefing card for every child ───
    for (const i of [0, 1, 2]) {
      await page.goto(APP); await page.waitForTimeout(250);
      await page.locator('.profile-card').nth(i).click(); await page.waitForTimeout(450); await chooseBuddyIfAsked(page);
      await page.locator('.pack-card').nth(2).click(); await page.waitForTimeout(450);
      if (!(await page.locator('.briefing').count())) out.push(`[${vp.name}] profile ${i}: pack opened without a WHY THIS MATTERS briefing`);
      else await audit(page, `${vp.name}/briefing ${i}`, out);
    }

    await ctx.close();
  }
  await browser.close();

  console.log(`\nJS errors (${errs.length}):`);
  [...new Set(errs)].forEach(e => console.log('  ' + e));
  const uniq = [...new Set(out)];
  console.log(`\nFindings (${uniq.length}):`);
  uniq.forEach(o => console.log('  ' + o));
  if (!uniq.length) console.log('  none');
  const failed = errs.length || uniq.length;
  console.log(failed ? `\nscreens: FAIL — ${new Set(errs).size} JS errors, ${uniq.length} findings`
    : `\nscreens: PASS — every other screen at ${VIEWPORTS.length} viewports, 0 JS errors, 0 findings`);
  process.exit(failed ? 1 : 0);
})();
