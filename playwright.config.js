// Playwright config for Forge — a single-file PWA validated on an iPhone-sized
// viewport. Chromium is pre-installed in this environment at
// /opt/pw-browsers/chromium; PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD keeps npm from
// re-fetching it. See CLAUDE.md §8 / §12.3 for the validation intent.
const { defineConfig, devices } = require('@playwright/test');

// This @playwright/test version may pin a newer Chromium than the one
// pre-installed in the environment. Point launches at the existing binary
// (symlinked at /opt/pw-browsers/chromium) rather than downloading one.
const CHROMIUM = '/opt/pw-browsers/chromium';

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  reporter: [['list']],
  use: {
    // iPhone 15-ish: 393x852 logical, DPR 3, mobile + touch (CLAUDE.md §12.3).
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 ' +
      '(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'iphone',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 393, height: 852 },
        isMobile: true,
        hasTouch: true,
        launchOptions: { executablePath: CHROMIUM },
      },
    },
  ],
});
