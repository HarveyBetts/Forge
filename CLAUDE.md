# Forge — Project Handover

> Drop this file at the repo root as `CLAUDE.md` so Claude Code loads it automatically.
> It is the complete brain-dump from the previous build sessions. Trust it over guesses.

---

## 1. What Forge is

Forge is a **single-file vanilla PWA life-organiser** (calendar, budget, accounts, shifts, AI assistant, and more) built by **Harvey Betts** — British, living in Sydney, assistant manager at a karting venue, aspiring pilot. He is non-technical (doesn't write code) but executes instructions precisely: runs SQL in Supabase, commits via GitHub, tests on his iPhone.

- **Live**: `harveybetts.github.io` (GitHub Pages, installed as an iOS standalone PWA)
- **The entire app**: one file, `forge-index.html` (~642 KB). No build step, no framework, no dependencies.
- **Backend**: Supabase — URL `https://ofzgrwnuoyowthzkyuld.supabase.co`, anon key `sb_publishable_lkx9dkYaTvKwiAgI2S2Now_JT1htmj_` (publishable, already shipped client-side). Owner account: `harvbetts@gmail.com`.
- **AI**: Supabase edge function slug `hyper-function`, called via `askAI` / `askAIRaw` in the file. A second edge fn `send-request-email` emails feature requests to Harvey.
- **Deploy flow**: edit `forge-index.html` → commit → Pages serves it. That's it.

⚠️ **Security status (deliberate, known)**: auth is a **custom PIN system** and **RLS is permissive** (`using (true)`) on every table. Fine for Harvey + friends; **must become real Supabase Auth + locked per-user RLS before any stranger touches it** (that's roadmap Phase 5 — see §11). Do not "fix" this casually mid-feature; it's a planned migration.

---

## 2. Working with Harvey

This matters as much as the code.

- He sends **voice-note punch lists**: long transcribed rambles of 5–15 issues per message. Parse them into a numbered list, fix everything, report item-by-item.
- His benchmark is **native iOS / Apple / Linear / Stripe**. "Cheap" is his worst insult.
- **Feel-word dictionary** (learned mappings that repeatedly proved correct):
  - "cheap" → sticky `:hover` on touch, instant transitions where animation expected, overlapping layout, default-form ugliness
  - "glitch out / reset" → CSS animation restarting on DOM re-insertion, or a transition skipped because transform+transition were set in the same frame (fix: `void el.offsetWidth` reflow flush between)
  - "bled off" → horizontal overflow, usually a flex child missing `min-width:0`, or `position:fixed` inside a transformed ancestor
  - "laggy" → an infinitely-animating `filter: blur()` or backdrop-filter repainting every frame
- **His iPhone is ground truth.** You cannot see the app render. Every visual claim must carry the caveat: *logic-validated, not device-verified*. He walks through on the phone and reports back — that loop is the QA process. Never claim a visual fix "works", say it "should" and ask him to confirm.
- Ship ritual: validate (see §8) → update the deliverable → summarise per item, honestly flagging what needs eyes-on.
- He appreciates **honest pushback** (e.g. was told plainly that App Store / payments come *after* the product is finished, that Face ID clunkiness is a PWA ceiling, that monthly→weekly budget conversion has no correct answer). Keep that tone.

---

## 3. Architecture

- One `<html>` file: a `<style>` block (~800 lines), markup skeleton, then **one giant inline `<script>`** (the app). Extract it for linting with:
  ```bash
  python3 -c "import re;h=open('forge-index.html').read();s=re.findall(r'<script(?![^>]*src=)[^>]*>(.*?)</script>',h,re.DOTALL);open('forge_main.js','w').write(max(s,key=len))"
  node --check forge_main.js
  ```
- **iOS height hack**: an early IIFE (`fit()`) hard-sets `#app` height to `screen.height`px in standalone mode (notch fix). Everything is absolutely positioned inside `#app`; screens are `.screen` elements that scroll internally.
- **Screens**: `buildScreen(tab)` → `loadAndRender(tab, el)`; `current = {tab, el}`; `go(tab)` handles directional slide transitions, `refreshScreen()` re-renders in place **preserving scrollTop**.
- Rendering is string-built HTML with inline `onclick` handlers (global functions). Function declarations hoist across the whole script — order rarely matters, and code relies on that.
- Caching layers: `_finCached(key, fn)` (finance mem + `forge.cache.*` localStorage), `_itemsMem` for the generic `items` table, `calCache` (`sh`/`ev`/…, invalidate with `calInvalidate()`), `_brainCache` (insights, bust with `_brainCache.t=0`), `forge.fx` (exchange rates, 6 h TTL).

---

## 4. Design system — "Slate"

- Tokens: bg `#F3F5F8`, surface white, ink `#0F172A`, accent `#2F6BFF`, success `#10B981`, warn `#F59E0B`, danger `#EF4444`. Fonts: **Sora** (display/numbers) + **Inter** (body).
- Motion tokens on `:root`: `--e-out: cubic-bezier(.22,.61,.36,1)`, `--e-slide: cubic-bezier(.22,.9,.3,1)`, `--e-spring: cubic-bezier(.34,1.56,.64,1)`. Use these, don't invent new curves.
- **Hard rules** (each fixed a real Harvey complaint — do not regress):
  1. Every focusable input/select/textarea ≥ **16px font** (smaller triggers iOS focus-zoom).
  2. Hover transforms only inside `@media (hover:hover) and (pointer:fine)` (else iOS "sticks" the raised state after tap).
  3. `user-select:none` lockdown is scoped to `@media (hover:none) and (pointer:coarse)` — desktop must keep text selection.
  4. `prefers-reduced-motion: reduce` globally collapses all animation — keep it working.
  5. New tappables get a press state (`:active` scale ~.97–.985) and `touch-action: manipulation`.
  6. Staggered entrances use the `.anim-in` class **added only in `go()`** (removed after 700 ms) — never on `refreshScreen`, or lists flash on every data update.

---

## 5. Navigation system

- **Five root slots**: Home(null) · calendar · ai · tabs("Customise") · settings. `NAV_ORDER` map, `NAV_MAX=4`, `navIndex(tab)` (returns `null` for non-root tabs), `idxToTab(i)`.
- `#navInd` sliding indicator: `left: calc(var(--nx) * 20%)`, width 20%. **`updateNav` returns early for non-root tabs** — indicator/highlight stay put when drilling into content (Apple behaviour; fixed the "opening Money slides the pill to Customise" bug).
- **Live finger-tracked pager** (document-level touch handlers): decides axis (dx vs dy·1.25), builds the neighbour screen on decide, both screens track the finger 1:1, rubber-bands past the ends, commits at progress > 0.28 or |vx| > 0.45, else springs back. Guards: skips calendar tab (owns horizontal swipes), open overlays/editors, inputs, and any horizontally-scrollable ancestor. Live-updates `--nx` during drag.
- **Bottom-bar swipe**: separate small handler — swiping along `#bottomNav` itself pages tabs (dx > 44).
- **Edge-swipe-back**: only for **drilled** screens (`navIndex(activeTab)==null`); on completion must call `updateNav(parent)` **and** `manageAiEdge(parent)` (both were once forgotten → stale UI bugs).

---

## 6. Subsystem inventory (function names you'll grep for)

### Home
`homeHTML` → hero + `#todayStrip` + `#brainCards` (2 shimmer `.sk-pill` placeholders) + category tiles + Quick (owner-only). `refreshBriefing()` fills the strip (`renderTodayStrip` — widget cards with colour bar, tap → today in calendar) and brain cards (`renderBrainCards`; empty-text insights filtered; **6 s failsafe clears stuck skeletons** — that was the "two black boxes" bug). Insights come from `brainInsights()` (deterministic rules over `brainSnapshot()`), also injected into the AI's context.

### Calendar
- Views: month/week/day/agenda (+year internally). `calView`, `calCursor`, `calSetView`, `calShiftDate` (agenda pages by week), `calGoDay`.
- **Swipe track**: `calBuildTrack` (three panes, current DOM moved into middle), live drag, `calCommitTrack` — note the **`void track.offsetWidth` reflow flush** before setting the final transform (without it iOS skips the transition = "teleport glitch"). `_calSettle` moves pane children back into `#calBody` and adds **`.cal-settled`** whose CSS kills `.cal-mc` entrance animations (DOM re-insertion restarts CSS animations — that was the "numbers glitch after landing" bug). `.cal-pane` has `contain:layout paint; transform:translateZ(0)` for day-swipe smoothness.
- **Runtime CSS**: `calStyleInject()`/`calCSS()` inject calendar styles at runtime — **they override head styles**; edit calendar CSS there, not in `<style>`.
- Segment control `.cal-seg` supports **swiping** to cycle views (attached in `calAfterRender`, guard `seg._swipe`, attach *before* the `.cal-scroll` early-return).
- **Apple-style event editor** (`evs-*`, `evMount`/`evInner`/`evSave`): Event/Reminder segment, Title/Location, all-day toggle, native date+time pill pickers, Repeat (materialises rows: daily×30, weekly×26, fortnightly×13, monthly×12 **month-end-clamped** via `_evAddMonths`, yearly×3) through `saveEventsBatch`, type row with colour dot, notes; `calEditEvent` + delete. `calOpenAdd` is the fab entry; it `closeOverlay()`s first.
- Agenda: summary card (7/30-day counts + New), Today always rendered, swipe disabled (`calInitGestures` skips agenda).
- `.cal-fab` bottom is `calc(84px + env(safe-area-inset-bottom))` — was sinking into the nav.

### Forge AI
- `renderAI`: thread + composer. Keyboard: `aiKbInit` tracks `visualViewport` into CSS var `--kb`; `.ai-bar` translates up by it (fixed "typing hidden under keyboard").
- **Edge ring** `#aiEdge`: body-level, device-shaped (`border-radius:max(38px, …)`), conic gradient rotating via registered `@property --ga` + `gaSpin` keyframes (**requires iOS 16.4+**; older devices just don't rotate). Managed by `manageAiEdge(tab)` from `go()` and edge-swipe completion. Never mount rings inside the screen (a fixed element inside the scroller caused the "bleeds off right" bug).
- **Mic policy**: `aiMicSupported()` returns **false on iOS standalone** (SpeechRecognition doesn't work there; it froze the app — users get the iOS keyboard's own dictation mic instead). Elsewhere: watchdog — if no `onaudiostart`/`onresult` within 4 s, stop + reset + toast; 20 s hard cap; `_recClear()` always clears the red state.

### Money (eight tabs in the Money category)
`fin_overview, fin_accounts, fin_budget, fin_investments, fin_networth, fin_goals, fin_subs, fin_rates`. `setFinSub(name)` navigates via `_FIN_TAB_MAP`. `migrateFinanceTabs()` idempotently grants new fin tabs to existing users; legacy `finances`/`subs` catalog ids are excluded from the Customise orphan list.

**Budget — EveryDollar-style, cycle-aware.** The core is the **period engine**:
- Keys: monthly `'YYYY-MM'`, weekly `'W:YYYY-MM-DD'` (Monday, via `shMonday`), fortnightly `'F:YYYY-MM-DD'` anchored to `_BUD_FN_ANCHOR='2024-01-01'` (a Monday) so boundaries never drift.
- `budCycle()` reads `_budProfile.cycle`; `budMonthKey/budMonthLabel/budShiftMonth` detect the key **prefix** (so history navigation works across cycle changes); **`budCompute` awaits `getBudProfile()` first** so keys are always cycle-correct.
- Switching cycle starts fresh periods — there is deliberately **no monthly→weekly conversion** (no correct maths for it); the copy-last-period banner takes over.
- UI: hero ("Left to budget" / "Fully budgeted 🎉" / "Over budget") with count-up + planned-vs-income meter + frosted stat pills; Income group at top (`budEditIncome`, "per week/fortnight/month"); status-tinted category rows (`--sc` green / amber >85% / red over, `color-mix`); **inline planned editing** `budPlanEdit` (pill → input, Enter/blur saves via `budSetAssign`, Esc cancels; "Set plan" CTA when 0); "+ Add item" per group (`budAddCatSheet(null, grpName)`, custom group names prepended to the select); copy-last-period banner (`budCopyPrev`); AI review + redo-setup row. First run gates to a 5-stage wizard (`bwz*`) with an AI-generated proposal.
- **Transaction sheet v3** `budTxnSheet`: header + ✕, big calculator amount with `curSym()` prefix, **Date pills (Today/Yesterday/date picker → `_btxDate`)**, category chips (`budTxnPick`), note, full-width Add gated by `budTxnValid`.
- Category detail `budOpenCat` renders as injected tab `fin_budget_cat` — flagged as *"the plainest room in the Money house"*; a design pass was offered and never done. Good Phase 2 candidate.
- Data fns return `ok`/`false` and surface failures via `budReportError` ("Budget tables missing — run the budget SQL").

**Accounts + multi-currency + FX.**
- `accounts` table (name, kind, balance, **currency**, position). `getAccounts` cached as `'acc'`. Kinds in `ACC_KINDS` (credit balances shown negative and **subtracted** from the converted total).
- Hero total converts every account into the main currency (verified: £1000 + A$2000 ≈ £2039). Foreign accounts show `≈` conversions; currency label tappable → `accCurEdit` (label-only change, balance number untouched — this is stated in the sheet copy).
- **Inline balance edit** `accBalEdit(ev,id,cur,accCur)`: a **drop** triggers `accLogSpendPrompt(diff, accCur)` — converts to main currency, shows both amounts, category chips with **N/A default** (`budEnsureNACategory()` auto-creates 🗂️ N/A under "Other"), logs via `budAddTxn`. A raise saves silently.
- **FX engine**: `CURRENCIES` (11 entries with sym/locale/name); `money()` = main-currency display app-wide; `moneyIn(v, code, dp)` for known-currency amounts; `fxEnsure(force)` fetches `https://open.er-api.com/v6/latest/USD` (no key), 6 h cache in `forge.fx`, `FX_FALLBACK` table offline; `fxConvert(a, from, to)` crosses via USD (round-trips exact — unit-tested). `fxIsLive()/fxAgeMs()` power the "updated Xh ago / offline" badges.
- **Conversion strip on Accounts appears only with 2+ held currencies** (verified suppressed for one).
- `fin_rates` (`renderRates`): converter (live-typing via `rateLive`, `rateSwap`, both-way rate line), full table vs main currency, refresh. Overflow fix: `min-width:0` on `.rate-amt/.rate-out/.rate-row`, `.rate-sel` `flex:0 0 auto; max-width:96px`, `.rate-note` wraps.

### Shifts (Time category, first)
Profile = one JSON item in items-tab `shift_meta` (`getShiftProfile`/`saveShiftProfile`): role, place, addr, rate. First run → questionnaire (`shSetup` via `openForm`). Week editor: Mon–Sun rows of paired `<input type=time>` (`.sh-time`, reuses `.evs-pill`), `shTime` upserts once the pair completes (label = role · place, note = address), `shClear` deletes, `shShiftWeek/shThisWeek` navigate, today highlighted, dark totals card (hours + est pay = rate×hours). `shHours` is **overnight-safe** (22:00–06:00 = 8 h). `migrateShiftTab()` grants the tab to existing Time users. Shifts feed the calendar automatically (same `shifts` table).

### Settings (5th nav slot, system tab like `tabs`)
`renderSettings`: Appearance (Currency → `openCurrencyPicker`) · Security (**Face ID enable/disable** `setFaceID(on)`; **Lock Forge now** `lockForge()` = `manageAiEdge(null)+showPinUnlock()`) · App (Send feedback sheet → `saveRequestDB`; **Clear cached data** `clearLocalCache()` purges `forge.cache.*` + invalidates all caches; Restart → `replaySplash`) · About. Only real rows — no dead toggles. This is the future home for notifications/exports/account when auth lands.

### Face ID (WebAuthn)
`bioAvailable/bioRegister/bioLogin`, credential id stored at `forge.bio.<uid>`; offer-once flag `forge.bioAsked.<uid>` after first successful PIN (`maybeOfferFaceID`); unlock screen shows a Face ID button + auto-prompts at 450 ms. **PWA ceiling**: it must route through the system WebAuthn sheet — clunkier than native; the Capacitor wrap (Phase 5) gets real `LocalAuthentication`. Per-device enrolment. `.pin-wrap` has `padding-bottom:84px` so the absolute "Forgot PIN" link can't overlap the button.

### People / requests
People screen bottom: "Request a feature" card → `saveRequestDB` → `requests` table + fire-and-forget `send-request-email` edge fn. Owner dashboard (`renderOwner`) lists recent requests.

### PIN & entry
Custom keypad, wrong-PIN = red dots + shake only (no box), splash→PIN and PIN→app slowed into crossfades, the keypad-lagging animated blur glow was removed. Header logo = `goHome()` (a reload here read as "logs me out").

---

## 7. Data model

Supabase tables (all currently permissive-RLS): `profiles, avatars, settings, pin_resets, login_events, requests, items, events, shifts, countdowns, todos, upkeep, finance_balance, net_worth, budget, finance_goals, investments, budget_cats, budget_assign, budget_txns, budget_income, budget_profile, accounts, meals, trackers, car, proposals, life_context, vault, passwords`.

Notable shapes:
- `events`: date, title, start_t, end_t, all_day, type, location, note (repeats are materialised rows — no rule column).
- `shifts`: day, label, start_t, end_t, note.
- Budget: `budget_cats` (grp/name/icon/rollover), `budget_assign`/`budget_txns`/`budget_income` keyed by the **period-key string** in their `month` column, `budget_profile` (jsonb: cycle etc.).
- `accounts`: name, kind, balance, **currency** (default 'GBP'), position.
- **items-tab JSON conventions**: `shift_meta` (profile JSON in title), subscriptions pack JSON into the item subtitle (`_subParse/_subPack`), `requests` items superseded by the real `requests` table.

**`forge-supabase.sql`** (in outputs alongside the HTML) is **idempotent top-to-bottom**: the RLS DO-loop has a `to_regclass` guard + `continue` (a missing table can never halt the run — this fixed Harvey's `42P01` failure), legacy Ignis/future_me tables appear only in a safe `drop table if exists` cleanup block at the end. When adding a table: create statement + add its name to the loop array + tell Harvey to re-run the whole file.

---

## 8. Validation workflow (do this every time)

The previous environment had **no browser** — validation was a Node harness (`test_forge.js`, Harvey has it; commit it to the repo). Workflow:

```bash
# 1. extract + syntax
python3 -c "import re;h=open('forge-index.html').read();s=re.findall(r'<script(?![^>]*src=)[^>]*>(.*?)</script>',h,re.DOTALL);open('forge_main.js','w').write(max(s,key=len))"
node --check forge_main.js
# 2. harness — boots the app headlessly, logs in, renders every tab
node test_forge.js
```
Pass = `BOOT-SYNC: OK`, `PINSUBMIT OK`, **22× `OK tab=`**, `ASYNC ERRORS: none`, `LATE ASYNC ERRORS: none`. Special/system tabs (settings, fin_accounts, fin_rates, shifts, …) aren't in the default list — inject them by copying the harness and `sed`-ing extra ids into the tab array at the `'finances','fitness'` anchor.

**Unit-testing pattern** for pure logic: extract a function by brace-counting and run it with stubs:
```js
function grab(n){for(const k of ['async function '+n,'function '+n]){let i=js.indexOf(k);if(i>=0){let d=0,s=false;for(let j=i;j<js.length;j++){const c=js[j];if(c==='{'){d++;s=true}else if(c==='}'){d--;if(s&&d===0)return js.slice(i,j+1)}}}}return ''}
const F = new Function(stubs + grab('budMonthKey') + 'return budMonthKey;')();
```
This pattern verified: period keys/labels/shifts for all three cycles, fortnight anchor stability, repeat-date expansion + month-end clamping, `shHours` overnight, FX round-trips, migrations' idempotency, render-template smoke tests (feed a fixture, assert markup strings).

**In Claude Code you now have a real machine** — strongly consider adding Playwright (+ iPhone viewport emulation) for actual visual/interaction tests. That closes the biggest gap this project has ever had. Keep the Node harness regardless; it's fast and catches boot/render regressions instantly.

**Patching habits that kept this file safe**: exact-string replaces with `assert h.count(old)==1` (Python) or unique-anchor `str_replace`; beware `"\\n"` in Python strings writing literal `\n` into CSS (it corrupted a selector once); after any edit, re-extract + `node --check` before moving on.

---

## 9. Gotchas (each of these burned us once)

1. Calendar CSS lives in **runtime-injected** `calCSS()` — head styles lose.
2. DOM-moving nodes **restarts their CSS animations** → suppress with a settled-class (see `.cal-settled`).
3. Setting `transition` and the target `transform` in the same frame gets **skipped** on iOS → force reflow (`void el.offsetWidth`) between.
4. `closeOverlay()` **removes the `#ovl` id immediately** then animates out — so a new overlay can mount during the exit. Follow that pattern for any new sheet flows.
5. Sheet drag-to-dismiss is **document-delegated** on `.sheet` (grip zone or `scrollTop<=2`); grip is a CSS `::before` so innerHTML re-renders can't destroy it.
6. `position:fixed` inside a transformed ancestor behaves as absolute-in-ancestor — mount viewport overlays (rings, etc.) on `body`.
7. Infinitely-animating `blur()`/`backdrop-filter` = frame-rate killer on iOS (the PIN lag).
8. `@property`-driven animations need **iOS 16.4+**; degrade gracefully.
9. Inputs under 16 px font trigger iOS page-zoom on focus.
10. The tab pager must ignore: calendar tab, open overlays, inputs, and horizontally-scrollable ancestors — check those guards before "fixing" swipe bugs.
11. `refreshScreen()` preserves scrollTop; `go()` resets it and adds `.anim-in`. Don't stagger on refresh.
12. `updateNav` intentionally ignores non-root tabs. Don't "fix" that.

---

## 10. Known limitations (agreed with Harvey — don't silently "solve")

- Face ID = WebAuthn sheet, per-device, clunkier than native. Ceiling until the native wrap.
- Mic hidden on iOS standalone (keyboard dictation is the route). Watchdogged elsewhere.
- Budget cycle switch starts fresh periods; no cross-cycle conversion by design.
- FX rates are mid-market from a free API, 6 h cache, offline fallback table — not bank rates.
- Event "Alert"/invitees/travel-time were deliberately **excluded** (no backend) rather than shipped dead.
- Repeats are materialised rows; deleting removes single occurrences (no series-delete UI yet).
- Permissive RLS + client-side auth (see §1) — planned Phase 5 work.

---

## 11. Roadmap & business context

Agreed 5-phase plan (order matters, no deadlines):
1. **Fix what's broken** — driven by Harvey's phone walkthroughs. *Essentially complete: the last 12-item punch list (PIN overlap, home ghost boxes, seg-swipe, day-swipe perf, mic, bottom-bar swipe, txn sheet v3, rotating rings, logo behaviour, Settings tab, quick-card removal, rates overflow) is shipped.*
2. **Make every tab useful** — current thin spots: `fitness` is a neutral placeholder (Ignis running-coach was fully removed on request); `investments`, `networth`, `goals` are basic; the budget **category detail screen** needs the v2 design treatment; generic list tabs (notes/projects/habits/study…) are stock. Decide keep-and-polish vs cut.
3. **Consistency pass** — one motion/spacing/empty-state/wording language everywhere (motion tokens already exist).
4. **Stranger-test robustness** — first-launch-with-zero-data, offline/failed saves, wrong-order taps, loading states.
5. **Business**: real Supabase Auth + locked RLS (before any stranger), Capacitor wrap + native touches (Apple Guideline 4.2 risk for plain wrappers), IAP (15–30% Apple cut — £10 → ~£7–8.50), GDPR (privacy policy, ToS, account deletion), App Store submission. Advice given and accepted: get 10–20 strangers using it free **before** building store/payment plumbing. MacBook: M-series Air 16 GB, buy at Phase 5, not before.

Target: ~100 subscribers × £10/mo. Differentiator: budgeting + whole-life organisation in one, with AI.

---

## 12. Session-zero checklist for Claude Code

1. Repo root: `forge-index.html`, `forge-supabase.sql`, this `CLAUDE.md`, `test_forge.js` (ask Harvey for it if absent — he has the original).
2. Run the §8 validation; confirm 22 tabs green before touching anything.
3. Consider adding Playwright + an iPhone-15-ish viewport project; wire a `npm test` that runs both harness and syntax check.
4. Keep the single-file architecture unless Harvey explicitly agrees to split — it's a deliberate choice he likes (copy-paste deployability). If splitting ever happens, it's a Phase 5 conversation.
5. First good candidates: Phase 2 kickoff — budget category detail redesign, fitness tab decision, investments/networth polish. Or whatever punch list Harvey's next voice note brings.

*Handover written July 2026, at the Phase 1 → Phase 2 boundary. The app is 642 KB of genuinely good product. Look after it.*
