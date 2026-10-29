// Read-aloud voices: which one is chosen, how it speaks, the fallback, and the picker.
//   node voice.js [app.html]
// With the voice lists of four devices faked (an iPad with a premium voice, a
// plain iPad, Edge with online natural voices, Chrome on Windows): the game
// picks the most natural English voice (WANT below); a kindergarten question
// is spoken by it at the natural-voice pace (0.9 / pitch 1) or, for a built-in
// voice, 0.85 / 1.05; on Edge with no network the online voice fails and the
// line goes straight to a built-in voice, not to another online one. In the
// parent dashboard the voice picker starts with "Automatic", every row is at
// least 44px tall, nothing overflows, choosing a voice saves it and previews
// it, ▶ plays that row's voice, and the choice is used after a reload.
const { chromium } = require('playwright');
const path = require('path');
const APP = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'Ticali_Trio_Family_Edition.html'));
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const DEVICES = {
  ipad: [['Samantha', 'en-US', true], ['Fred', 'en-US', true], ['Albert', 'en-US', true], ['Karen', 'en-AU', true], ['Ava (Premium)', 'en-US', true], ['Daniel', 'en-GB', true], ['Amélie', 'fr-CA', true]],
  ipadPlain: [['Karen', 'en-AU', true], ['Samantha', 'en-US', true], ['Fred', 'en-US', true], ['Bubbles', 'en-US', true]],
  edge: [['Microsoft David - English (United States)', 'en-US', true], ['Microsoft Zira - English (United States)', 'en-US', true],
         ['Microsoft Ana Online (Natural) - English (United States)', 'en-US', false], ['Microsoft Jenny Online (Natural) - English (United States)', 'en-US', false],
         ['Microsoft Libby Online (Natural) - English (United Kingdom)', 'en-GB', false]],
  chrome: [['Microsoft David - English (United States)', 'en-US', true], ['Microsoft Zira - English (United States)', 'en-US', true], ['Google US English', 'en-US', false], ['Google UK English Female', 'en-GB', false]],
};
const WANT = { ipad: 'Ava (Premium)', ipadPlain: 'Samantha', edge: 'Microsoft Jenny Online (Natural) - English (United States)', chrome: 'Google US English' };
let bad = 0; const fail = m => { bad++; console.log('FAIL ' + m); };
(async () => {
  const b = await chromium.launch({ executablePath: CHROMIUM });
  for (const [dev, list] of Object.entries(DEVICES)) {
    const ctx = await b.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(([list, failOnline]) => {
      window.__said = [];
      const voices = list.map(([name, lang, local]) => ({ name, lang, localService: local, default: false, voiceURI: name }));
      const synth = { speaking: false, paused: false, pending: false, onvoiceschanged: null,
        getVoices: () => voices,
        speak(u) { const v = u.voice; window.__said.push({ text: u.text, voice: v && v.name, rate: u.rate, pitch: u.pitch });
          if (failOnline && v && !v.localService) setTimeout(() => u.onerror && u.onerror({ error: 'network' }), 10);
          else setTimeout(() => u.onend && u.onend({}), 30); },
        cancel() {}, pause() {}, resume() {}, addEventListener() {}, removeEventListener() {} };
      Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
      window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    }, [list, dev === 'edge']);
    await p.goto(APP); await p.waitForTimeout(400);
    const r = await p.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const out = {};
      out.picked = pickVoice(speechSynthesis.getVoices()).name;
      // An early reader hears a K question.
      pickProfile('k'); document.querySelector('.buddy-chooser, #buddy-overlay') && (typeof buddyLater === 'function') && buddyLater();
      const pk = PACKS.k.find(x => x.tier === 'now'); startPack(pk.id); const go = document.querySelector('.briefing-go'); if (go) go.click();
      await wait(300); window.__said.length = 0;
      const btn = document.querySelector('.question-frame .js-speak'); btn.click(); await wait(250);
      out.k = window.__said.slice();
      return out;
    });
    if (r.picked !== WANT[dev]) fail(`${dev}: picked "${r.picked}", wanted "${WANT[dev]}"`);
    const natural = !/^Samantha/.test(WANT[dev]);
    const last = r.k[r.k.length - 1] || {};
    if (dev === 'edge') {
      // Jenny fails (no network) -> straight to a built-in voice, not the other online ones.
      const vs = r.k.map(x => x.voice);
      if (!(vs[0] === WANT.edge && vs.length === 2 && /^Microsoft (Zira|David) - /.test(vs[1] || ''))) fail(`edge fallback order: ${JSON.stringify(vs)}`);
      if (!(last.rate === 0.85 && last.pitch === 1.05)) fail(`edge built-in fallback prosody ${last.rate}/${last.pitch}`);
    } else {
      if (last.voice !== WANT[dev]) fail(`${dev}: K question spoken by "${last.voice}"`);
      if (natural && !(last.rate === 0.9 && last.pitch === 1)) fail(`${dev}: natural voice prosody ${last.rate}/${last.pitch}`);
      if (!natural && !(last.rate === 0.85 && last.pitch === 1.05)) fail(`${dev}: built-in prosody ${last.rate}/${last.pitch}`);
    }
    // Parent dashboard picker
    const d = await p.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      window.prompt = () => '0000'; parentGate(); await wait(200);
      const rows = [...document.querySelectorAll('#voice-list .voice-row')].map(r => r.textContent.replace(/\s+/g, ' ').trim());
      const small = [...document.querySelectorAll('#voice-list button, #voice-list label')].filter(e => e.getBoundingClientRect().height < 44).length;
      const overflow = document.documentElement.scrollWidth > innerWidth + 1;
      // choose the last voice in the list and preview it
      const radios = [...document.querySelectorAll('#voice-list input[type=radio]')];
      const target = radios[radios.length - 1]; target.click(); await wait(200);
      const chosenSaved = JSON.parse(localStorage.getItem(STORAGE_KEY)).parent.voice;
      const previewVoice = window.__said[window.__said.length - 1].voice;
      // ▶ on the first non-auto row
      window.__said.length = 0; document.querySelectorAll('#voice-list .voice-try')[1].click(); await wait(200);
      const tried = window.__said[0] && window.__said[0].voice;
      return { rows, small, overflow, chosen: target.value, chosenSaved, previewVoice, tried, firstRowVoice: document.querySelectorAll('#voice-list .voice-try')[1].dataset.voice };
    });
    if (!/^Automatic/.test(d.rows[0])) fail(`${dev}: first row is not Automatic: ${d.rows[0]}`);
    if (d.small) fail(`${dev}: ${d.small} picker targets under 44px`);
    if (d.overflow) fail(`${dev}: dashboard overflows`);
    if (d.chosenSaved !== d.chosen) fail(`${dev}: choice not saved (${d.chosenSaved})`);
    if (dev !== 'edge' && d.previewVoice !== d.chosen) fail(`${dev}: choosing did not preview that voice (${d.previewVoice})`);
    if (dev !== 'edge' && d.tried !== d.firstRowVoice) fail(`${dev}: ▶ played ${d.tried}, not ${d.firstRowVoice}`);
    // The choice survives a reload and is used.
    await p.reload(); await p.waitForTimeout(400);
    const after = await p.evaluate(() => pickVoice(speechSynthesis.getVoices()).name);
    if (dev !== 'edge' && after !== d.chosen) fail(`${dev}: after reload uses ${after}, chose ${d.chosen}`);
    if (errs.length) fail(`${dev}: page errors ${errs.join(' | ')}`);
    console.log(`${dev}: picked ${r.picked}; K said by ${last.voice} at ${last.rate}/${last.pitch}; picker rows ${d.rows.length}: ${d.rows.slice(0, 3).join(' | ')}`);
    await ctx.close();
  }
  await b.close();
  console.log(bad ? `voice: FAIL — ${bad} problems` : `voice: PASS — ${Object.keys(DEVICES).length} devices: voice, pace, fallback and picker`);
  process.exit(bad ? 1 : 0);
})();
