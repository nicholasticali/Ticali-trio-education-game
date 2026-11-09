// The installed game (Safari's Add to Home Screen): its offline copy and its manifest.
//   node offline.js
// Serves the repo folder at http://localhost (as GitHub Pages serves it) and checks:
// 1. the game registers sw.js and saves itself, its start page, manifest, icons and typefaces,
//    downloading the game once; opened from its icon, the first screen says when it is ready;
// 2. the manifest names the game, opens it full screen from its own start page, and its icons
//    load; the game carries the same icon;
// 3. with no internet: the game opens (from the start page, the game's address, or with "?..." on
//    it), plays a question, and keeps the progress saved before;
// 4. online again: a changed game reaches the device at once (never an old copy) and the saved
//    copy becomes the new one, an unchanged one is not saved again, an icon brought back to the
//    front offers a newer version, a slow or stalling connection falls back to the copy, a moved
//    page is followed, and a new offline version whose game download fails keeps the old copy
//    and leaves other sites' saved files alone;
// 5. a first setup whose game download fails is tried again, and a typeface that never arrives
//    does not keep the game from opening;
// 6. the game opened as a file registers nothing and keeps its built-in manifest;
// 7. no JS errors.
// Playwright sees the service worker's own requests only with this switched on (Chromium).
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const GAME = 'Ticali_Trio_Family_Edition.html';
let good = 0; const fails = [];
const ok = (c, m) => { if (c) { good++; console.log('  ok   ' + m); } else { fails.push(m); console.log('  FAIL ' + m); } };
// Wait for an async condition in the page (waitForFunction does not await one).
const until = async (page, fn, arg, ms) => { const end = Date.now() + ms; while (Date.now() < end) { if (await page.evaluate(fn, arg).catch(() => false)) return true; await page.waitForTimeout(400); } return false; };

// A small static server, like GitHub Pages: ETag and Last-Modified, and 304 when nothing changed.
//   mode.ver        2 or more: the game carries `window.__gameVer = n` (an update), and a newer date
//   mode.slowMs     the game's answer starts this late (a slow connection)
//   mode.stallMs    the game's answer sends its first part, then stalls this long (a dropping one)
//   mode.failSwGame the service worker's own download of the game fails (503)
//   mode.redirect   the start page has moved (302) to the game, with "?via=redirect"
//   mode.swCore     sw.js names its cache this instead (a new offline version)
const mode = { ver: 1, slowMs: 0, stallMs: 0, failSwGame: false, redirect: false, swCore: null };
const stats = { game200: 0, copy: 0 };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (mode.redirect && p === '/') { res.writeHead(302, { Location: '/' + GAME + '?via=redirect' }); res.end(); return; }
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  const isGame = p.endsWith(GAME);
  if (isGame && mode.failSwGame && req.headers['sec-fetch-dest'] === 'empty') { res.writeHead(503); res.end('busy'); return; }
  let body = fs.readFileSync(file);
  if (isGame && mode.ver > 1) body = Buffer.concat([body, Buffer.from(`\n<script>window.__gameVer = ${mode.ver};</script>\n`)]);
  if (p.endsWith('sw.js') && mode.swCore) body = Buffer.from(body.toString().replace("const CORE = 'ticali-core-v1'", `const CORE = '${mode.swCore}'`));
  const etag = '"' + crypto.createHash('md5').update(body).digest('hex').slice(0, 16) + '"';
  const modified = new Date(Date.UTC(2026, 10, 1) + (isGame ? mode.ver : 1) * 3600e3).toUTCString();
  const head = { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'max-age=600', ETag: etag, 'Last-Modified': modified };
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, head); res.end(); return; }
  if (isGame && req.method === 'GET') { stats.game200++; head['X-Copy'] = String(++stats.copy); }
  const send = () => {
    res.writeHead(200, head);
    if (isGame && mode.stallMs && req.method === 'GET') { res.write(body.subarray(0, 65536)); setTimeout(() => res.end(body.subarray(65536)), mode.stallMs); }
    else res.end(body);
  };
  if (isGame && mode.slowMs) setTimeout(send, mode.slowMs); else send();
});

// Google Fonts, stood in for: a stylesheet naming one typeface file. `fonts.mode` 'serve', 'fail'
// (no answer at all, at once) or 'hang' (no answer ever).
const fonts = { mode: 'serve' };
const FONT_FILE = 'https://fonts.gstatic.com/s/stand-in/v1/stand-in.woff2';
const routeFonts = ctx => ctx.route(/fonts\.(googleapis|gstatic)\.com/, route => {
  if (fonts.mode === 'fail') return route.abort();
  if (fonts.mode === 'hang') return;   // never answered
  const css = /googleapis/.test(route.request().url());
  return route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': css ? 'text/css' : 'font/woff2' },
    body: css ? `@font-face { font-family: 'Stand In'; src: url(${FONT_FILE}) format('woff2'); }` : Buffer.from('not really a font') });
});
// Opened from the Home Screen icon (full screen), as far as the page can tell.
const asInstalled = () => {
  const mm = window.matchMedia.bind(window);
  window.matchMedia = q => /display-mode:\s*standalone/.test(q)
    ? { matches: true, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } }
    : mm(q);
};
const quiet = () => { const ss = window.speechSynthesis; ss.speak = u => setTimeout(() => u.onend && u.onend({}), 20); ss.getVoices = () => []; };
const savedGame = async (page, key) => page.evaluate(async k => {
  const r = await caches.match(new URL(k || 'Ticali_Trio_Family_Edition.html', location.href).href);
  return r ? { copy: r.headers.get('X-Copy'), text: (await r.text()).slice(-80) } : null;
}, key);
const status = page => page.evaluate(() => { const b = document.getElementById('offline-box'); return b ? b.textContent.trim() : null; });

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const BASE = `http://localhost:${server.address().port}/`;
  const b = await chromium.launch({ executablePath: CHROMIUM });
  const errs = [];
  const watch = page => { page.on('pageerror', e => errs.push(e.message)); return page; };
  const ctx = await b.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true });
  await routeFonts(ctx);
  const p = watch(await ctx.newPage());
  await p.addInitScript(quiet);
  await p.addInitScript(asInstalled);

  // ─── 1. saved on the first visit ───
  console.log('\n▶ first visit, online (opened as if from the Home Screen icon)');
  await p.goto(BASE);
  await p.waitForURL(/Ticali_Trio_Family_Edition\.html/);
  await p.waitForSelector('.title-screen');
  const first = await status(p);
  const reg = await p.evaluate(async () => { const r = await navigator.serviceWorker.ready; return { scope: r.scope, active: !!r.active }; });
  ok(reg.active && /\/$/.test(reg.scope), 'the start page opens the game, which sets up its offline copy (scope ' + reg.scope.replace(/^http:\/\/[^/]+/, '') + ')');
  const want = ['', 'index.html', GAME, 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
  await until(p, async n => (await (await caches.open('ticali-core-v1')).keys()).length >= n, want.length, 20000);
  const saved = await p.evaluate(async () => (await (await caches.open('ticali-core-v1')).keys()).map(r => new URL(r.url).pathname.replace(/^\//, '')));
  ok(want.every(f => saved.includes(f)), 'it saves the game, its start page, manifest and icons: ' + saved.join(', '));
  const fontsSaved = await p.evaluate(async () => (await (await caches.open('ticali-fonts-v1')).keys()).map(r => new URL(r.url).hostname));
  ok(fontsSaved.includes('fonts.googleapis.com') && fontsSaved.includes('fonts.gstatic.com'), 'it saves the typefaces as it sets up (their stylesheet and files): ' + fontsSaved.join(', '));
  const swText = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), gameHead = fs.readFileSync(path.join(ROOT, GAME), 'utf8').slice(0, 400000);
  const imported = (gameHead.match(/@import url\('([^']+)'\)/) || [])[1];
  ok(!!imported && swText.includes(`const FONT_CSS = '${imported}';`), "sw.js saves the very typefaces the game's @import asks for");
  ok(/Saving the game/.test(first || ''), 'opened from the icon, the first screen first says it is saving the game: "' + first + '"');
  await until(p, () => /Ready to play without internet/.test((document.getElementById('offline-box') || {}).textContent || ''), null, 15000);
  ok(/Ready to play without internet/.test(await status(p) || ''), 'then it says "Ready to play without internet"');
  const t = watch(await ctx.newPage());
  await t.addInitScript(quiet);
  await t.goto(BASE + GAME); await t.waitForSelector('.title-screen'); await t.waitForTimeout(800);
  ok((await status(t)) === '', 'in a Safari tab (not the icon) the first screen says nothing about it');
  await t.close();

  // ─── 2. the manifest ───
  const m = await p.evaluate(async () => {
    const link = document.querySelector('link[rel="manifest"]');
    const res = await fetch(link.href); const j = await res.json();
    const icons = await Promise.all(j.icons.map(async i => { const r = await fetch(new URL(i.src, link.href)); const img = await createImageBitmap(await r.blob()); return { src: i.src, ok: r.ok, size: img.width + 'x' + img.height, said: i.sizes, purpose: i.purpose }; }));
    return { j, icons, apple: (document.querySelector('link[rel="apple-touch-icon"]') || {}).href || '' };
  });
  ok(m.j.name === 'Ticali Trio' && m.j.display === 'standalone' && /Ticali_Trio_Family_Edition\.html$/.test(m.j.start_url) && m.j.scope === './', 'the manifest: Ticali Trio, full screen, opening the game itself');
  ok(m.icons.length >= 3 && m.icons.every(i => i.ok && i.size === i.said) && m.icons.some(i => i.purpose === 'maskable'), 'its icons load at the sizes it says: ' + m.icons.map(i => i.src + ' ' + i.size).join(', '));
  const icon180 = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'icon-180.png')).toString('base64');
  ok(m.apple === icon180, "the game's own Home Screen icon for Safari (apple-touch-icon) is icon-180.png");
  ok(/content="default"/.test((gameHead.match(/<meta name="apple-mobile-web-app-status-bar-style"[^>]*>/) || [''])[0]), 'full screen, the clock and battery stay readable (status bar style "default")');

  // some progress, saved while online
  await p.evaluate(() => { state.profiles.g3.xp = 777; saveState(); });

  // ─── 3. no internet ───
  console.log('\n▶ no internet');
  await ctx.setOffline(true);
  for (const [label, url] of [['the start page', BASE], ["the game's own address", BASE + GAME], ['the address with "?..."', BASE + GAME + '?from=homescreen']]) {
    await p.goto(url).catch(() => {});
    const shown = await p.waitForSelector('.title-screen', { timeout: 8000 }).then(() => true).catch(() => false);
    ok(shown, `offline, ${label} opens the game`);
  }
  ok(await p.evaluate(() => state.profiles.g3.xp === 777), 'offline, the progress saved before is all there');
  ok(await p.evaluate(async () => (await (await caches.open('ticali-core-v1')).keys()).filter(k => /Ticali_Trio_Family_Edition/.test(k.url)).length === 1), 'one saved copy of the game, whatever "?..." its address had');
  await until(p, () => /Ready to play/.test((document.getElementById('offline-box') || {}).textContent || ''), null, 5000);
  ok(/Ready to play without internet/.test(await status(p) || ''), 'offline, the first screen still says "Ready to play without internet"');
  await p.evaluate(() => pickProfile('g3')); await p.waitForTimeout(300);
  if (await p.locator('.buddy-choose').count()) { await p.locator('.buddy-tile').first().tap(); await p.waitForTimeout(150); await p.locator('.buddy-go').tap(); await p.waitForTimeout(250); }
  ok(await p.locator('.scout-guide').count() === 1, "offline, the hub opens, with Scout");
  await p.evaluate(() => { const pk = PACKS.g3.find(x => x.tier === 'now'); startPack(pk.id); const go = document.querySelector('.briefing-go'); if (go) go.click(); });
  await p.waitForSelector('.question-frame', { timeout: 5000 }).catch(() => {});
  const answered = await p.evaluate(() => {
    const q = questions[qIdx];
    if (q.type === 'mc') pickMc(q.correct); else if (q.type === 'tf') pickTf(q.correct); else return 'type ' + q.type;
    return !!document.querySelector('#fb');
  });
  ok(answered === true, 'offline, a round plays: a question answered, with its why');
  ok(await p.evaluate(() => offlineCheckForUpdate(true)) === false, 'offline, looking for a new version quietly finds nothing');

  // ─── 4. updates ───
  console.log('\n▶ online again: updates');
  await ctx.setOffline(false);
  const before = await savedGame(p);
  await p.goto(BASE + GAME); await p.waitForSelector('.title-screen'); await p.waitForTimeout(1500);
  ok((await savedGame(p)).copy === before.copy, 'online, an unchanged game is not saved again (13 MB each launch)');
  ok(await p.evaluate(() => offlineCheckForUpdate(true)) === false && !(await p.locator('.offline-update').count()), 'with no new version on the web, nothing is offered');
  mode.ver = 2;
  await p.goto(BASE + GAME); await p.waitForSelector('.title-screen');
  ok(await p.evaluate(() => window.__gameVer === 2), 'online, a changed game reaches the device at once, not an old copy');
  ok(/__gameVer = 2/.test((await savedGame(p)).text), 'and the saved copy is now the changed game');
  await ctx.setOffline(true);
  await p.goto(BASE + GAME).catch(() => {}); await p.waitForSelector('.title-screen', { timeout: 8000 }).catch(() => {});
  ok(await p.evaluate(() => window.__gameVer === 2), 'offline, the changed game opens');
  await ctx.setOffline(false);
  // An icon left open in the background: no navigation, so the page itself looks.
  await p.goto(BASE + GAME); await p.waitForSelector('.title-screen'); await p.waitForTimeout(500);
  mode.ver = 3;
  const backToFront = () => p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await backToFront(); await p.waitForTimeout(1200);
  ok(!(await p.locator('.offline-update').count()), 'back to the front just after opening, it does not look yet (at most every 20 minutes)');
  await p.evaluate(() => { offlineChecked = 0; });
  await backToFront();
  await until(p, () => !!document.querySelector('.offline-update'), null, 5000);
  ok(await p.locator('.offline-update').isVisible(), 'back to the front later, the game offers the newer version: "' + ((await p.locator('.offline-update').textContent().catch(() => '')) || '').trim() + '"');
  await Promise.all([p.waitForNavigation(), p.locator('.offline-update').tap()]);
  await p.waitForSelector('.title-screen');
  ok(await p.evaluate(() => window.__gameVer === 3) && !(await p.locator('.offline-update').count()), 'one tap updates it');

  mode.slowMs = 15000;
  let t0 = Date.now();
  await p.goto(BASE + GAME, { timeout: 20000 }).catch(() => {});
  let shown = await p.waitForSelector('.title-screen', { timeout: 14000 }).then(() => true).catch(() => false);
  ok(shown && Date.now() - t0 < 12000, `a slow connection: the saved copy opens instead (${Math.round((Date.now() - t0) / 100) / 10} s)`);
  mode.slowMs = 0;
  mode.ver = 4; mode.stallMs = 15000;
  t0 = Date.now();
  await p.goto(BASE + GAME, { timeout: 20000 }).catch(() => {});
  shown = await p.waitForSelector('.title-screen', { timeout: 14000 }).then(() => true).catch(() => false);
  ok(shown && Date.now() - t0 < 12000 && await p.evaluate(() => window.__gameVer === 3), `a connection that starts and then stalls: the saved copy opens too (${Math.round((Date.now() - t0) / 100) / 10} s)`);
  await until(p, async () => { const r = await caches.match(location.origin + location.pathname); return !!r && (await r.text()).includes('__gameVer = 4'); }, null, 25000);
  ok(/__gameVer = 4/.test((await savedGame(p)).text), 'and the slow download, once finished, becomes the saved copy for next time');
  mode.stallMs = 0;

  mode.redirect = true;
  await p.goto(BASE); await p.waitForSelector('.title-screen');
  ok(/\?via=redirect$/.test(p.url()), 'a page that has moved is followed, not replaced by its saved copy: ' + p.url().replace(BASE, '/'));
  mode.redirect = false;

  // A new offline version (its cache renamed) whose own download of the game fails.
  await p.evaluate(async () => { await (await caches.open('another-site')).put('/x', new Response('theirs')); });
  mode.swCore = 'ticali-core-v2'; mode.failSwGame = true;
  await p.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update().catch(() => {}));
  await until(p, async () => { const k = await caches.keys(); return k.includes('ticali-core-v2') && !k.includes('ticali-core-v1'); }, null, 20000);
  const keys = await p.evaluate(() => caches.keys());
  ok(keys.includes('ticali-core-v2') && !keys.includes('ticali-core-v1') && /__gameVer = 4/.test((await savedGame(p)).text || ''), 'a new offline version whose game download fails keeps the copy it had: ' + keys.join(', '));
  ok(keys.includes('another-site'), "and it clears only the game's own old copies, never another site's saved files");
  mode.failSwGame = false;
  await ctx.setOffline(true);
  await p.goto(BASE + GAME).catch(() => {});
  ok(await p.waitForSelector('.title-screen', { timeout: 8000 }).then(() => true).catch(() => false), 'offline after that, the game still opens');
  await ctx.setOffline(false);
  mode.swCore = null;

  // ─── 5. a first setup that fails, and typefaces that never arrive ───
  console.log('\n▶ a new device: a failed setup, a typeface that never arrives');
  const ctx2 = await b.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true });
  await routeFonts(ctx2);
  const n = watch(await ctx2.newPage());
  await n.addInitScript(quiet); await n.addInitScript(asInstalled);
  fonts.mode = 'fail'; mode.failSwGame = true;
  await n.goto(BASE + GAME); await n.waitForSelector('.title-screen'); await n.waitForTimeout(3000);
  const failed = await n.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return { active: !!(r && r.active), game: !!(await caches.match(new URL('Ticali_Trio_Family_Edition.html', location.href).href)) }; });
  ok(!failed.active && !failed.game && /Saving the game/.test(await status(n) || ''), 'when the game cannot be saved, the setup stops (no offline copy without the game) and the screen does not say ready');
  mode.failSwGame = false;
  await n.reload(); await n.waitForSelector('.title-screen');
  await until(n, () => /Ready to play/.test((document.getElementById('offline-box') || {}).textContent || ''), null, 20000);
  ok(/Ready to play without internet/.test(await status(n) || ''), 'the next visit sets it up, and the screen says ready');
  ok(!(await n.evaluate(async () => (await (await caches.open('ticali-fonts-v1')).keys()).length)), '(the typefaces could not be saved this time)');
  fonts.mode = 'hang';
  t0 = Date.now();
  await n.goto(BASE + GAME, { timeout: 20000 }).catch(() => {});
  shown = await n.waitForSelector('.title-screen', { timeout: 12000 }).then(() => true).catch(() => false);
  ok(shown && Date.now() - t0 < 9000, `a typeface request that never answers does not keep the game from opening (${Math.round((Date.now() - t0) / 100) / 10} s, in its built-in typefaces)`);
  fonts.mode = 'serve';
  await ctx2.close();

  // Playwright switches the HTTP cache off while it stands in for the typefaces, so the setup's
  // "has the game changed?" can only be answered "no" in a browser it does not intercept.
  // A browser profile on disk, too: a private window's in-memory cache does not keep a 13 MB file.
  const profile = fs.mkdtempSync(path.join(require('os').tmpdir(), 'ticali-offline-'));
  const b2 = await chromium.launchPersistentContext(profile, { executablePath: CHROMIUM, args: ['--host-resolver-rules=MAP fonts.googleapis.com ~NOTFOUND, MAP fonts.gstatic.com ~NOTFOUND'] });
  const once = watch(b2.pages()[0] || await b2.newPage());
  await once.addInitScript(quiet);
  const downloads = stats.game200;
  await once.goto(BASE); await once.waitForURL(/Ticali_Trio_Family_Edition\.html/); await once.waitForSelector('.title-screen');
  await until(once, async () => !!(await navigator.serviceWorker.ready) && !!(await caches.match(new URL('Ticali_Trio_Family_Edition.html', location.href).href)), null, 20000);
  ok(stats.game200 - downloads === 1, `the first visit downloads the game once: the setup asks whether it changed and keeps the copy just downloaded (${stats.game200 - downloads} download)`);
  await b2.close(); fs.rmSync(profile, { recursive: true, force: true });

  // ─── 6. opened as a file ───
  console.log('\n▶ opened as a file');
  const f = watch(await ctx.newPage());
  await f.addInitScript(asInstalled);
  await f.goto('file://' + path.join(ROOT, GAME)); await f.waitForSelector('.title-screen');
  await f.waitForTimeout(500);
  ok(await f.evaluate(() => { const m = document.querySelector('link[rel="manifest"]'); return (!m || /^data:/.test(m.getAttribute('href'))) && !(navigator.serviceWorker && navigator.serviceWorker.controller) && !document.getElementById('offline-box'); }), 'opened as a file, the game registers nothing, keeps its built-in manifest and says nothing about playing offline');

  ok(!errs.length, 'no JS errors' + (errs.length ? ': ' + [...new Set(errs)].slice(0, 3).join(' | ') : ''));
  await b.close(); server.close();
  console.log(fails.length ? `\noffline: FAIL — ${fails.length} of ${good + fails.length} checks failed` : `\noffline: PASS — ${good} checks: the installed game saves itself, says when it is ready, opens and plays with no internet, and updates when online`);
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); console.log('offline: FAIL — ' + e.message.split('\n')[0]); server.close(); process.exit(1); });
