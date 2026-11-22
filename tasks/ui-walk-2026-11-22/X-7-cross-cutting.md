# Task 7 — Cross-cutting: API inspector, export, URL state, phone width, dark mode, keyboard

> **Status: DONE (walked 2026-11-22, 9 findings: F094–F102)**

## Goal

Check the rules that hold on every page, on a sample of pages chosen to cover each shared piece: the API inspector
sheet, CSV / JSON export, URL state, phone-width layout (no sideways page scroll), dark mode, keyboard access,
toasts, and scroll behaviour.

## Prerequisites

Tasks 2–6 (pages known; page-specific findings already logged — do not log them twice).

## Current Behavior

`src/components/api/api-sheet.tsx`, `json-tree.tsx`, `export-menu.tsx`, `src/lib/export.ts`, `src/lib/url-state.ts`,
`src/components/ui/data-table.tsx`, `src/lib/layout.ts`. `CLAUDE.md` → "API inspector, export, URL state (O6)",
"Page shell (O1)".

## Desired Behavior

Every check ticked or logged.

## Requirements

### 1. API inspector (sample: `/AAPL/filings`, `/AAPL/financials?view=standardized`, `/calendar`, a call page,
`/alerts` after Task 9 has created one)

- [x] **T7.1** (sampled filings, financials, calendar, call page; no `/v1/me`; tier badges FREE / STANDARD / PRO, no upgrade prompt; docs links well formed but their host does not resolve: F094; `/alerts` sampled after Task 9: `GET /v1/alerts?limit=100` FREE, charged 1, no `/v1/me`, but the sheet also lists the session's earlier writes: F113) The API button opens a side sheet listing the page's requests (each page of a list), never `/v1/me`.
  Per request: method + path + query AS SENT, summary, plan badge (none shown as "upgrade" on ENTERPRISE), base cost +
  charged, status, request id with copy, docs link (opens `https://data.invinite.com/docs/…`; one check).
- [x] **T7.2** (every page sampled: each `Bearer ` is `Bearer $INVINITE_API_KEY`, no `api_key=` in the sheet; no key anywhere) curl uses `$INVINITE_API_KEY` — the real key never appears in the sheet (search the sheet's text for
  `Bearer ` followed by anything but `$INVINITE_API_KEY`: blocker if found).
- [x] **T7.3** (CLI lines with flags; tree depth 2, 50 a chunk, copy + download; chunk wording F095) CLI line `invd <group> <action> …` with flags; JSON tree open to depth 2, children lazily, 50 at a time
  ("show more"); copy / download of the answer.
- [x] **T7.4** (call page, audio playing, sheet open 30 s: 300 / 300 timer ticks, max gap 142 ms, 4 long tasks ≤ 64 ms, console clean) Opening the sheet causes no render loop (console clean, CPU: the page stays responsive while the sheet
  is open for 30 s on the call page with audio playing).
- [x] **T7.5** (`/audio`, `/transcript?include=words`, versions, participants, the event) Call page: the sheet lists `/audio`, the words transcript and the open tab's requests.

### 2. Export (sample: dividends, holders 13F, funds, catalog metrics, calls list)

- [x] **T7.6** (dividends (Load all: 40 → 58 rows, stopped at the last page, 25-credit cap named), holders 13F, funds, catalog metrics, calls list; names `AAPL-dividends-2026-11-22.csv`, `AAPL-holders-13f-…json`, `us-funds-…`, `all-catalog-metrics-…`, `AAPL-calls-past-…`) Menu shows CSV / JSON + "N rows loaded"; "Load all pages first…" asks a confirm naming the per-page cost,
  stops at the last page or after 25 pages. File names `<scope>-<dataset>-<yyyy-mm-dd>.<ext>` (read from the download
  event if visible, else via the code path `exportFileName`).
- [x] **T7.7** (covered by `export.test.ts`; no bug suspected) A text cell starting with `=` / `+` / `-` / `@` is neutralised with `'` (check via a unit test only if a
  bug is suspected — no need to craft data).

### 3. URL state (sample: financials, holders, insider trades, news, documents, call page, `/search`)

- [x] **T7.8** (defaults never written (`?format=speakers` absent); several pushes fixed: F097) Every filter / tab / sort / open item is a search param; a default is NOT written (e.g. `?format=speakers`
  never appears). Filter changes replace history (Back leaves the page rather than stepping through filters) except
  `/search`'s submitted query (a history entry).
- [x] **T7.9** (`?tab=bogus`, `?sort=xyz`, call page / search / documents junk fall back; an impossible day dumped a validation error: F096) An invalid value (`?tab=bogus`, `?sort=xyz`, `?from=2026-13-45`) falls back to the default without an
  error page.
- [x] **T7.10** (news `?item=` open / close kept scrollY 600; documents filters `resetScroll: false` (a shorter filtered tree clamps the scroll)) Opening a panel / filtering in place (`?item=` on news, documents filters) keeps the scroll position.

### 4. Phone width (390 × 844)

Resize the pane (`resize_window` if offered; else ask the owner to narrow the pane) and, on each page below, run
`javascript_tool`: `document.documentElement.scrollWidth > window.innerWidth` → must be `false`.

- [x] **T7.11** (all thirteen pages `scrollWidth` = 390; `/alerts/destinations/$id` checked in Task 8 on D1) `/`, `/calendar`, `/AAPL`, `/AAPL/financials`, `/AAPL/insider-trades`, `/AAPL/holders`, `/AAPL/news`,
  `/AAPL/documents`, call page (player + transcript), `/sec/1067983`, `/alerts/new`, `/alerts/destinations/$id`
  (after Task 8), `/account`.
- [x] **T7.12** (insider trades scroll in their wrapper; top bar search reachable; the sheet stayed open after navigation: F098) Wide tables scroll inside their wrapper (header scrolls with the page there); the sidebar is a sheet
  on phone width and closes after navigation; top bar fits (search reachable).
- [x] **T7.13** (`/AAPL/dividends` at 1084 px scrolled: thead sticky at 120 px = top bar 56 + ticker header 64) At ≥ 1024 px a table that fits keeps its header sticky below the pinned header (screenshot while
  scrolled on `/AAPL/dividends`).

### 5. Dark mode

- [x] **T7.14** (`/`, ratios + chart dialog, call page, `/alerts/new` readable in dark; SEC HTML viewer white; no toast reachable without a crafted failure (none appeared during the task)) Screenshot in dark: `/`, `/AAPL/financials`, call page, `/alerts/new`, a dialog, a toast, the SEC HTML
  viewer (stays white). No unreadable text (dark on dark), charts readable, badges with contrast.

### 6. Keyboard and accessibility

- [x] **T7.15** (`/alerts/new` fields and `/AAPL/holders` show rings, order logical; the API sheet traps Tab and Escape returns focus to "API"; selects close on Escape; panel ring F100, focus lost after a URL dialog F101) Tab through `/alerts/new` and `/AAPL/holders`: visible focus ring everywhere, logical order, menus and
  dialogs trap focus and close on Escape returning focus to the trigger.
- [x] **T7.16** (financials view strip: → / End / Home / ← (wraps) move selection, one `aria-selected`, URL in place) `TabStrip`s: ←/→ / Home / End move the selection; one `aria-selected`.
- [x] **T7.17** (copy, catalog, export, API, chart buttons named; images have `alt`; chart names F099, tree toggles + filter selects F102) `read_page` on a few pages: buttons with icons only have accessible names (copy, chart, catalog,
  export, API), images have `alt`, form fields have labels.

### 7. Errors, toasts, offline

- [~] **T7.18** (a subagent cannot ask the owner to toggle the network mid-task; not exercised) Block the API for a moment: ask the owner to toggle the machine's network off for ~10 s while you
  reload `/AAPL/dividends` (or skip with `[~]` if the owner declines): an error state with retry renders, no toast
  storm, recovery after network back.
- [~] **T7.19** (format covered by `errors.test.ts`; pages that render their own error (insider trades / filings dump before F096, VOO dividends) raised no toast; no toasting failure reachable without crafting one) A toast from an error quotes ` (<code>, request <id>)`. A page that renders its own error does not also
  toast.
- [~] **T7.20** (no slow loader or thrown route seen in this task) Route pending / error components show for a slow / thrown route (observed during the walk; tick if seen
  correct).

## Files to Create / Modify

| File | Action | Purpose |
| --- | --- | --- |
| `tasks/ui-walk-2026-11-22/findings.md` | Modify | Findings |
| this task file | Modify | Ticks, status |
| `src/components/api/**`, `src/components/ui/**`, `src/lib/export.ts`, `src/lib/url-state.ts`, route `validateSearch`, tests | Modify | Dashboard fixes only |

## Acceptance Criteria

- T7.1–T7.20 ticked / `[~]` / logged with outcome; fixes committed with tests; check + test green.
- No key visible anywhere (T7.2) — confirmed explicitly in the task's summary to the owner.
