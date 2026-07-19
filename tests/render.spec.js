// Forge render validation — the Playwright equivalent of the old Node harness
// (CLAUDE.md §8), but in a real Chromium on an iPhone viewport. It boots the
// app offline, seeds a logged-in user, then renders every catalog tab plus the
// root/system screens, asserting each produces markup without throwing and that
// no async errors surface. Pass == every tab "OK" + zero page/console errors.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { boot, seedUser } = require('./helpers');

// Root/system screens that aren't in CATALOG but must render (see renderTab).
const SYSTEM_TARGETS = ['today', 'tabs', 'settings', 'ai', 'owner', 'users', 'finances'];

test('app boots clean with no async errors', async ({ page }) => {
  const errors = await boot(page);
  // Give any late async work (getSession, first paints) a beat to surface.
  await page.waitForTimeout(1000);
  expect(errors, 'boot produced page/console errors:\n' + errors.join('\n')).toEqual([]);
  // A recognisable post-boot surface is mounted.
  const hasApp = await page.evaluate(() => !!document.getElementById('app'));
  expect(hasApp).toBe(true);
  await page.screenshot({ path: path.join(__dirname, '__screenshots__', 'boot.png') });
});

test('every tab renders without error', async ({ page }) => {
  const errors = await boot(page);
  await seedUser(page);

  // Build the full render target list in-page from the live catalog.
  const targets = await page.evaluate((system) => {
    const ids = window.CATALOG().map((t) => t.id);
    // dedupe, keep catalog order, append system screens
    const seen = new Set();
    const out = [];
    ids.concat(system).forEach((id) => { if (!seen.has(id)) { seen.add(id); out.push(id); } });
    return out;
  }, SYSTEM_TARGETS);

  const results = [];
  for (const tab of targets) {
    const r = await page.evaluate(async (t) => {
      try {
        const html = await window.renderTab(t);
        return { tab: t, ok: typeof html === 'string' && html.length > 0, len: (html || '').length };
      } catch (e) {
        return { tab: t, ok: false, err: (e && e.message) || String(e) };
      }
    }, tab);
    results.push(r);
  }

  // Home (null) renders via homeHTML, not renderTab.
  const homeOk = await page.evaluate(() => {
    try { return typeof window.homeHTML() === 'string' && window.homeHTML().length > 0; }
    catch (e) { return false; }
  });
  results.push({ tab: '(home)', ok: homeOk });

  const failed = results.filter((r) => !r.ok);
  const summary = results.map((r) => `${r.ok ? 'OK' : 'FAIL'} tab=${r.tab}${r.err ? ' :: ' + r.err : ''}`).join('\n');
  console.log(`\n${results.length} render targets:\n${summary}\n`);

  // Let async render side-effects (loadAndRender, refreshBriefing) settle.
  await page.waitForTimeout(1500);

  expect(failed, 'tabs that failed to render:\n' + failed.map((f) => `${f.tab}: ${f.err || 'empty output'}`).join('\n')).toEqual([]);
  expect(errors, 'async errors during render:\n' + errors.join('\n')).toEqual([]);
});

test('key screens paint on the iPhone viewport', async ({ page }) => {
  await boot(page);
  await seedUser(page);
  await page.waitForTimeout(800); // let the lock overlay finish unmounting
  const shots = [
    { tab: null, name: 'home' },
    { tab: 'calendar', name: 'calendar' },
    { tab: 'fin_overview', name: 'fin_overview' },
    { tab: 'settings', name: 'settings' },
  ];
  for (const s of shots) {
    await page.evaluate((t) => window.go(t, true), s.tab);
    await page.waitForTimeout(900); // async loadAndRender fills the skeleton
    await page.screenshot({ path: path.join(__dirname, '__screenshots__', `screen-${s.name}.png`) });
  }
  // No assertion beyond producing artifacts; the render test guards correctness.
  expect(true).toBe(true);
});
