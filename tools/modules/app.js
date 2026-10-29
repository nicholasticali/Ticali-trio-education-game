// The game file the module suites test, and copies derived from it.
//
// Every fun module is built into the game file. Its script sits after
// "/* ═══ FUN MODULES ═══ */" and opens with "// ─── module: <name> ───"; its
// styles sit after "/* ═══ FUN MODULE STYLES ═══ */" and open with
// "/* ─── module: <name> ─── */". A suite that needs the game without a module,
// with the modules in another order, or with one module's code replaced (the
// sample lands in place of READING_ROAD) asks for a variant here. Variants are
// written to tools/out/builds/; the game file itself is only ever read.
//
//   const app = require('./app');
//   app.APP                          the game file (see below)
//   app.args                         the command line without the game file
//   app.modules()                    [{ name, js, css }] in the file's order
//   app.has('sprint')                is that module built in?
//   app.variant('no-road', mods => mods.filter(m => !/^reading/.test(m.name)))
//   app.module('reading-data', js)   a module made from new source (no styles)
//   app.roadData(files)              `const READING_ROAD = {lands:[…]};` from land JSON files
//   app.readingRoad()                the game's own READING_ROAD object
//   app.shots('buddy')               tools/out/shots/buddy/, emptied
//
// The game file is the first argument ending in .html, else $TT_APP, else the
// repo's Ticali_Trio_Family_Edition.html.
//
// From the command line, to look at a copy by hand:
//   node modules/app.js [app.html]                          the modules built in
//   node modules/app.js [app.html] without reading-data,reading
//                       the game without those modules (here: no Reading Road),
//                       written to out/builds/without-reading-data-reading.html
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const TOOLS = path.resolve(__dirname, '..');
const OUT = path.join(TOOLS, 'out');
const argHtml = process.argv.slice(2).find(a => /\.html?$/i.test(a));
const APP = path.resolve(argHtml || process.env.TT_APP || path.join(TOOLS, '..', 'Ticali_Trio_Family_Edition.html'));
const args = process.argv.slice(2).filter(a => a !== argHtml);
// The Chromium every suite launches; CHROMIUM_PATH picks another.
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';

const JS = {
  kind: 'script',
  mark: '/* ═══ FUN MODULES ═══ */',
  head: /^\/\/ ─── module: ([\w-]+) ───$/gm,
  // The modules end where the app's own code resumes: its RENDERING section.
  end: /^\/\/ ═+\n\/\/ RENDERING$/m,
  close: '</script',
  wrap: (name, src) => `// ─── module: ${name} ───\n${src.replace(/\n*$/, '')}\n\n`,
};
const CSS = {
  kind: 'styles',
  mark: '/* ═══ FUN MODULE STYLES ═══ */',
  head: /^[ \t]*\/\* ─── module: ([\w-]+) ─── \*\/$/gm,
  // ... and the styles end where its TOUCH LAYER section starts.
  end: /^[ \t]*\/\* ═+\n[ \t]*TOUCH LAYER\b/m,
  close: '</style',
  wrap: (name, src) => `  /* ─── module: ${name} ─── */\n${src.replace(/\n*$/, '')}\n\n`,
};

// One region of the file: where the modules start and end, and each module's
// text (its head line through the blank lines before the next one).
function region(html, R, file) {
  const at = html.indexOf(R.mark);
  if (at < 0 || html.indexOf(R.mark, at + 1) >= 0) throw new Error(`${file}: "${R.mark}" must appear exactly once`);
  const heads = [];
  R.head.lastIndex = at;
  for (let m; (m = R.head.exec(html));) heads.push({ name: m[1], at: m.index });
  const from = heads.length ? heads[heads.length - 1].at : at;
  const e = R.end.exec(html.slice(from));
  if (!e) throw new Error(`${file}: cannot find where the module ${R.kind} end (${R.end})`);
  const end = from + e.index;
  const start = heads.length ? heads[0].at : end;
  if (html.slice(at, end).includes(R.close)) throw new Error(`${file}: the module ${R.kind} run past ${R.close}>`);
  const blocks = new Map();
  heads.forEach((h, i) => {
    if (blocks.has(h.name)) throw new Error(`${file}: module "${h.name}" has two ${R.kind} blocks`);
    blocks.set(h.name, html.slice(h.at, i + 1 < heads.length ? heads[i + 1].at : end));
  });
  return { start, end, blocks };
}

function parse(html, file) {
  const js = region(html, JS, file), css = region(html, CSS, file);
  for (const name of css.blocks.keys()) if (!js.blocks.has(name)) throw new Error(`${file}: module "${name}" has styles but no script`);
  const mods = [...js.blocks.keys()].map(name => ({ name, js: js.blocks.get(name), css: css.blocks.get(name) || '' }));
  return { js, css, mods };
}

// The file again, with `mods` (in that order) in place of its modules.
function assemble(html, parsed, mods) {
  const parts = [
    [parsed.css, mods.map(m => m.css).join('')],
    [parsed.js, mods.map(m => m.js).join('')],
  ].sort((a, b) => b[0].start - a[0].start);   // from the end, so earlier offsets hold
  let out = html;
  for (const [r, text] of parts) out = out.slice(0, r.start) + text + out.slice(r.end);
  return out;
}

let cache = null;
function load() {
  if (!cache) {
    if (!fs.existsSync(APP)) throw new Error('no game file at ' + APP);
    const html = fs.readFileSync(APP, 'utf8');
    cache = { html, parsed: parse(html, APP) };
  }
  return cache;
}

const modules = () => load().parsed.mods.map(m => Object.assign({}, m));
const has = name => load().parsed.mods.some(m => m.name === name);

// A module made from source: `js` for its script, optional `css` for its styles.
function module_(name, js, css) {
  return { name, js: JS.wrap(name, js), css: css ? CSS.wrap(name, css) : '' };
}

// Write the game with its module list changed by `edit` (gets a copy of
// modules(), returns the list to build) to out/builds/<name>.html.
function variant(name, edit) {
  const { html, parsed } = load();
  const mods = edit(modules());
  if (!Array.isArray(mods)) throw new Error(`variant ${name}: the edit must return a module list`);
  const out = assemble(html, parsed, mods);
  // The copy must parse back to exactly the list asked for.
  const back = parse(out, name).mods.map(m => m.name).join(',');
  if (back !== mods.map(m => m.name).join(',')) throw new Error(`variant ${name}: built [${back}], wanted [${mods.map(m => m.name)}]`);
  const dir = path.join(OUT, 'builds');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name + '.html');
  fs.writeFileSync(file, out);
  console.log(`built ${path.relative(TOOLS, file)}: ${mods.map(m => m.name).join(', ') || 'no modules'}`);
  return file;
}

// The Reading Road data module from land JSON files: lands in the order of
// each file's "order" number, which is then dropped (the road's order is the
// list's). Safe inside an inline <script>.
function roadData(files) {
  const lands = files.map(f => JSON.parse(fs.readFileSync(f, 'utf8'))).sort((a, b) => a.order - b.order);
  const data = { lands: lands.map(l => { const c = Object.assign({}, l); delete c.order; return c; }) };
  const json = JSON.stringify(data, null, 1)
    .replace(/<\//g, '<\\/')
    .split(String.fromCharCode(0x2028)).join('\\u2028')
    .split(String.fromCharCode(0x2029)).join('\\u2029');
  return `// Reading Road content from ${files.map(f => path.basename(f)).join(', ')}.\nconst READING_ROAD = ${json};\n`;
}

// The game's own READING_ROAD, evaluated from its reading-data block alone.
function readingRoad() {
  const m = load().parsed.mods.find(x => x.name === 'reading-data');
  if (!m) return null;
  return vm.runInNewContext(m.js + '\n;READING_ROAD', {}, { filename: 'reading-data' });
}

// A screenshot folder for one check, emptied first.
function shots(name) {
  const dir = path.join(OUT, 'shots', name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

module.exports = { APP, args, CHROMIUM, TOOLS, OUT, modules, has, module: module_, variant, roadData, readingRoad, shots, parse, assemble };

if (require.main === module) {
  const [cmd, list] = args;
  const mods = modules();
  if (!cmd) {
    console.log(`${APP}: ${mods.length} modules built in`);
    mods.forEach(m => console.log(`  ${m.name.padEnd(13)} script ${String(m.js.length).padStart(7)} chars, styles ${String(m.css.length).padStart(6)} chars`));
  } else if (cmd === 'without' && list) {
    const drop = list.split(',').filter(Boolean);
    const unknown = drop.filter(d => !mods.some(m => m.name === d));
    if (unknown.length) { console.error(`app.js: the game has no module ${unknown.join(', ')}`); process.exit(2); }
    variant('without-' + drop.join('-'), ms => ms.filter(m => !drop.includes(m.name)));
  } else {
    console.error('usage: node modules/app.js [app.html] [without <module,module…>]');
    process.exit(2);
  }
}
