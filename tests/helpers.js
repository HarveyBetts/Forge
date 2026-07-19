// Shared boot helper for the Forge Playwright suite.
// Loads forge-index.html with the live Supabase CDN bundle swapped for the
// offline mock (tests/mock-supabase.js) and every other outbound request
// stubbed, so the app boots deterministically with no backend. Then it seeds a
// fake logged-in user + full tab set so render code can be exercised directly.
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const INDEX_URL = pathToFileURL(path.join(ROOT, 'index.html')).href;
const MOCK = fs.readFileSync(path.join(__dirname, 'mock-supabase.js'), 'utf8');

// Collect page/console errors so tests can assert a clean boot + render.
function attachErrorCollectors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + (e && e.message ? e.message : String(e))));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push('console.error: ' + msg.text());
  });
  return errors;
}

// Route every network request: serve the mock in place of the Supabase CDN,
// and stub everything else external (Supabase REST/functions, FX api, fonts).
async function installRoutes(page) {
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('file://')) return route.continue();
    if (/supabase-js/.test(url)) {
      return route.fulfill({ contentType: 'application/javascript', body: MOCK });
    }
    // Fonts / stylesheets: let them fail quietly rather than hang.
    return route.fulfill({ status: 200, contentType: 'text/plain', body: '' });
  });
}

// Boot the app and wait until the intro splash has lifted (boot IIFE resolved).
async function boot(page) {
  const errors = attachErrorCollectors(page);
  await installRoutes(page);
  await page.goto(INDEX_URL, { waitUntil: 'domcontentloaded' });
  // The boot IIFE waits 2600ms before lifting the intro; wait for the app to
  // settle into a known post-boot state (auth login screen mounted).
  await page.waitForFunction(() => {
    const intro = document.getElementById('intro');
    const introGone = !intro || intro.classList.contains('hide');
    return introGone && document.getElementById('stage') !== null;
  }, { timeout: 15000 });
  return errors;
}

// Seed a fake authenticated user + all catalog tabs, so render code runs the
// same paths a logged-in first-launch user would (empty data from the mock).
async function seedUser(page) {
  await page.evaluate(() => {
    window.currentUser = { id: 'test-user', name: 'Harvey Betts', role: 'owner', avatar_url: null };
    // enabledTabs() reads _tabsCache; enable the full catalog for coverage.
    const ids = window.CATALOG().map((t) => t.id);
    window._tabsCache = Array.from(new Set(ids));
    // Dismiss the auth/PIN lock overlay so the real app shell (#stage) is
    // visible — mirrors enterApp() without the welcome/tutorial detours.
    try { window.unmountAuth(); } catch (e) {}
  });
}

module.exports = { boot, seedUser, attachErrorCollectors, INDEX_URL, ROOT };
