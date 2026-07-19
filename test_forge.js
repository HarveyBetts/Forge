#!/usr/bin/env node
/*
 * test_forge.js — fast Node pre-flight for Forge (CLAUDE.md §8).
 *
 * This is the "fast, catches boot/render regressions instantly" gate: it
 * extracts the app's inline <script> from forge-index.html and syntax-checks it,
 * then runs cheap static sanity assertions — no browser, sub-second.
 *
 * NOTE: The previous environment's original test_forge.js (a headless DOM-stub
 * harness that printed "22x OK tab=") was never committed to this repo, so it
 * could not be reused. Full boot + per-tab render validation now runs in a real
 * Chromium via Playwright (tests/render.spec.js) — strictly better than a Node
 * DOM stub. `npm test` runs this pre-flight first, then the Playwright suite.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const HTML = path.join(ROOT, 'forge-index.html');

let failures = 0;
function ok(msg) { console.log('  OK   ' + msg); }
function fail(msg) { console.log('  FAIL ' + msg); failures++; }
function check(cond, msg) { cond ? ok(msg) : fail(msg); }

console.log('Forge pre-flight (test_forge.js)\n');

// 1. Extract the largest inline (non-src) <script> — the app body.
const html = fs.readFileSync(HTML, 'utf8');
const scripts = [...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
check(scripts.length > 0, 'found inline <script> blocks (' + scripts.length + ')');
const js = scripts.reduce((a, b) => (b.length > a.length ? b : a), '');
check(js.length > 100000, 'extracted app script (' + js.length + ' bytes)');

// 2. Syntax check via `node --check` on a temp file.
const tmp = path.join(os.tmpdir(), 'forge_main.check.js');
fs.writeFileSync(tmp, js);
try {
  execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
  ok('node --check: BOOT-SYNC OK');
} catch (e) {
  fail('node --check failed:\n' + (e.stderr ? e.stderr.toString() : e.message));
} finally {
  try { fs.unlinkSync(tmp); } catch (_) {}
}

// 3. Static structural sanity — the load-bearing symbols named in CLAUDE.md.
const mustHave = [
  'const TABS=', 'const EXTRA_TABS=', 'function CATALOG(', 'async function renderTab(',
  'function go(', 'function buildScreen(', 'function enterApp(', 'function budCompute',
  'function fxConvert(', 'function shHours', 'function calBuildTrack',
];
mustHave.forEach((sig) => check(js.includes(sig), 'present: ' + sig.replace(/[({].*$/, '')));

// 4. index.html mirrors forge-index.html (Pages serves index.html).
try {
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  check(idx === html, 'index.html matches forge-index.html');
} catch (_) {
  fail('index.html missing');
}

console.log('');
if (failures) {
  console.log('PRE-FLIGHT: ' + failures + ' failure(s)');
  process.exit(1);
}
console.log('PRE-FLIGHT: OK');
