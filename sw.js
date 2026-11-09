// Ticali Trio's offline copy (a service worker), for the game installed from its web address
// (Safari: Share, Add to Home Screen). It keeps a copy of the game on the device, so the icon
// opens and plays with no internet, and it never holds an update back: whenever the device is
// online, the game comes fresh from the web and the copy is replaced.
//   Game, its start page, manifest and icons: from the web first, the saved copy if the web is
//     offline, slow or broken.
//   The typefaces (Google Fonts): saved when the game is set up, then the saved copy first.
// A game opened as a file (a laptop's double-click) has no service worker and needs none.
// Every cache it makes is named "ticali-...", and it never touches another site's.
const CORE = 'ticali-core-v1';   // a new name here clears every old copy once the new one is saved
const FONTS = 'ticali-fonts-v1';
const OURS = 'ticali-';
const GAME = new URL('./Ticali_Trio_Family_Edition.html', self.location).href;
const FILES = ['./', './index.html', './Ticali_Trio_Family_Edition.html', './manifest.webmanifest',
  './icon-180.png', './icon-192.png', './icon-512.png', './icon-maskable-512.png']
  .map(f => new URL(f, self.location).href);
// The game's @import, exactly (tools/offline.js checks the two agree).
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Bungee&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,800;1,9..144,400&family=JetBrains+Mono:wght@400;700&display=swap';
// How long the web has to deliver the whole game before the saved copy opens instead.
const WAIT_MS = 6000;
// How long a typeface not yet saved may hold the game up (the game has built-in typefaces).
const FONT_WAIT_MS = 2500;

const later = (ms, value) => new Promise(resolve => setTimeout(resolve, ms, value));
// A download worth saving: a whole, same-site answer, not an error page and not a redirect.
const usable = res => !!res && res.ok && res.type === 'basic' && !res.redirected;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CORE);
    // Each file on its own. A missing icon can wait for the next visit; the game cannot: without
    // it the worker would take over with nothing to open offline. So if the game's download
    // fails, an older saved copy is kept, and with none the setup fails and is tried again on
    // the next visit. 'no-cache' asks the web whether the game changed, so a game the browser
    // has just downloaded is not downloaded again.
    await Promise.all(FILES.map(async at => {
      try {
        const res = await fetch(at, { cache: 'no-cache' });
        if (usable(res)) { await cache.put(at, res); return; }
      } catch (e) {}
      if (at !== GAME) return;
      if (await cache.match(GAME)) return;
      for (const name of await caches.keys()) {
        if (!name.startsWith(OURS) || name === CORE || name === FONTS) continue;
        const old = await (await caches.open(name)).match(GAME);
        if (old) { await cache.put(GAME, old); return; }
      }
      throw new Error('the game could not be saved; the setup will be tried again on the next visit');
    }));
    // The typefaces, so the first launch with no internet looks like every other. Best effort.
    await Promise.race([saveFonts(), later(10000)]).catch(() => {});
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(OURS) && name !== CORE && name !== FONTS) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) event.respondWith(fromWebFirst(event, req));
  else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') event.respondWith(fromCopyFirst(event, req));
});

// The game's typefaces: the stylesheet, then every typeface file it names.
async function saveFonts() {
  const cache = await caches.open(FONTS);
  if (await cache.match(FONT_CSS, { ignoreVary: true })) return;
  const res = await fetch(FONT_CSS);
  if (!res.ok) return;
  const css = await res.text();
  const files = [...new Set([...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)'"]+)\)/g)].map(m => m[1]))].slice(0, 60);
  await Promise.all(files.map(async f => {
    try { const r = await fetch(f); if (r.ok) await cache.put(f, r); } catch (e) {}
  }));
  await cache.put(FONT_CSS, new Response(css, { headers: { 'Content-Type': 'text/css; charset=utf-8' } }));
}

// Same versions: the web's answer and the saved copy carry the same Last-Modified and ETag (a
// compressed answer's ETag is marked weak, W/"...", with the same value).
function version(res) {
  const mod = res.headers.get('Last-Modified') || '', tag = (res.headers.get('ETag') || '').replace(/^W\//, '');
  return mod || tag ? mod + '|' + tag : null;
}
function sameVersion(a, b) {
  const v = version(a);
  return !!v && v === version(b);
}

// The web first. The download is copied for saving the moment it starts (before the page reads
// it), and the save is registered with the event straight away (a later one can be refused).
// Each page is saved once, under its address without "?..." (the game reads nothing from it), so
// "?from=homescreen" never leaves an old copy, or a second 13 MB one, behind.
function fromWebFirst(event, req) {
  const url = new URL(req.url);
  const key = url.origin + url.pathname;
  const web = fetch(req, { cache: 'no-cache' });
  const copy = web.then(res => usable(res) ? res.clone() : null, () => null);
  const saved = caches.open(CORE).then(cache => cache.match(key)).catch(() => undefined);
  // Settles once the whole download is on the device ('saved'), or with 'same' (the saved copy is
  // this very version: nothing is written), 'unsaved' (it could not be written) or null (nothing
  // to save: offline, an error page or a redirect).
  const saving = Promise.all([copy, saved]).then(([fresh, old]) => {
    if (!fresh) return null;
    if (old && sameVersion(fresh, old)) { if (fresh.body) fresh.body.cancel().catch(() => {}); return 'same'; }
    return caches.open(CORE).then(cache => cache.put(key, fresh)).then(() => 'saved', () => 'unsaved');
  });
  event.waitUntil(saving.catch(() => {}));
  return (async () => {
    const old = await saved;
    if (!old) {
      // Nothing saved yet (the very first visit): the web, however long it takes.
      try { return await web; } catch (e) {
        const game = req.mode === 'navigate' ? await caches.open(CORE).then(cache => cache.match(GAME)) : null;
        if (game) return game;
        throw e;
      }
    }
    // A saved copy is here: the web has WAIT_MS to deliver the whole file, not just its first
    // bytes, so a connection that starts and then stalls opens the saved copy too.
    const done = await Promise.race([saving.catch(() => null), later(WAIT_MS, 'late')]);
    if (done === 'same') {
      web.then(res => { if (res.body && !res.bodyUsed) res.body.cancel().catch(() => {}); }).catch(() => {});
      return old;
    }
    if (done === 'saved' || done === 'unsaved') return web;   // the new version, already all here
    if (done === null) {
      const res = await web.catch(() => null);
      if (res && res.type === 'opaqueredirect') return res;   // moved: the browser follows it
    }
    // Offline, too slow, or an error page: the saved copy. A slow download carries on and
    // replaces the copy for next time.
    return old;
  })();
}

// The typefaces: the saved copy first, refreshed in the background. A typeface not saved yet
// gets FONT_WAIT_MS: the game's stylesheet waits on it, so a hanging request must not keep the
// game from opening. Then the game carries on in its built-in typefaces.
function fromCopyFirst(event, req) {
  const web = fetch(req).catch(() => null);
  event.waitUntil(web.then(res => {
    if (!res || !(res.ok || res.type === 'opaque')) return;
    const copy = res.clone();
    return caches.open(FONTS).then(cache => cache.put(req, copy));
  }).catch(() => {}));
  return (async () => {
    const saved = await caches.open(FONTS).then(cache => cache.match(req, { ignoreVary: true })).catch(() => undefined);
    if (saved) return saved;
    const res = await Promise.race([web, later(FONT_WAIT_MS, null)]);
    if (res) return res;
    return new URL(req.url).hostname === 'fonts.googleapis.com'
      ? new Response('', { headers: { 'Content-Type': 'text/css' } })
      : Response.error();
  })();
}
