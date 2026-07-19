# Forge tests

Two layers, both run by `npm test`:

1. **`test_forge.js`** (Node pre-flight, sub-second) — extracts the inline app
   script from `forge-index.html`, runs `node --check` on it, and asserts the
   load-bearing symbols from CLAUDE.md §8 are present. This is the fast
   syntax/structure gate. Run alone: `npm run test:node`.

2. **Playwright** (`tests/render.spec.js`) — boots the app in a real Chromium on
   an **iPhone-sized viewport (393×852, DPR 3, touch)**, with the Supabase CDN
   bundle swapped for an offline mock (`tests/mock-supabase.js`) so it renders
   deterministically with no backend. It then:
   - asserts a clean boot (no page/console errors),
   - renders **every catalog tab + system screen** (51 targets) and asserts each
     produces markup without throwing or emitting async errors,
   - captures screenshots of key screens to `tests/__screenshots__/`.
   Run alone: `npm run test:pw`. Interactive: `npm run test:ui`.

## Notes

- Chromium is pre-installed in the CI/web environment; `playwright.config.js`
  points `executablePath` at `/opt/pw-browsers/chromium` so no download is
  needed. On a normal machine, run `npx playwright install chromium` once and
  remove/adjust that `executablePath` if the pinned build differs.
- The mock puts the app in the **first-launch, logged-in, empty-data** state —
  ideal for smoke-testing render paths. It does not exercise real Supabase
  reads/writes; that remains device/QA territory (CLAUDE.md §2, §8).
- Screenshots are logic-validated renders, **not** device-verified — Harvey's
  iPhone remains ground truth for visual sign-off (CLAUDE.md §2).
