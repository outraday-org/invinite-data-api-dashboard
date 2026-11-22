# Task 7 — Cross-cutting: API inspector, export, URL state, phone width, dark mode, keyboard

> **Status: TODO**

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

- [ ] **T7.1** The API button opens a side sheet listing the page's requests (each page of a list), never `/v1/me`.
  Per request: method + path + query AS SENT, summary, plan badge (none shown as "upgrade" on ENTERPRISE), base cost +
  charged, status, request id with copy, docs link (opens `https://data.invinite.com/docs/…`; one check).
- [ ] **T7.2** curl uses `$INVINITE_API_KEY` — the real key never appears in the sheet (search the sheet's text for
  `Bearer ` followed by anything but `$INVINITE_API_KEY`: blocker if found).
- [ ] **T7.3** CLI line `invd <group> <action> …` with flags; JSON tree open to depth 2, children lazily, 50 at a time
  ("show more"); copy / download of the answer.
- [ ] **T7.4** Opening the sheet causes no render loop (console clean, CPU: the page stays responsive while the sheet
  is open for 30 s on the call page with audio playing).
- [ ] **T7.5** Call page: the sheet lists `/audio`, the words transcript and the open tab's requests.

### 2. Export (sample: dividends, holders 13F, funds, catalog metrics, calls list)

- [ ] **T7.6** Menu shows CSV / JSON + "N rows loaded"; "Load all pages first…" asks a confirm naming the per-page cost,
  stops at the last page or after 25 pages. File names `<scope>-<dataset>-<yyyy-mm-dd>.<ext>` (read from the download
  event if visible, else via the code path `exportFileName`).
- [ ] **T7.7** A text cell starting with `=` / `+` / `-` / `@` is neutralised with `'` (check via a unit test only if a
  bug is suspected — no need to craft data).

### 3. URL state (sample: financials, holders, insider trades, news, documents, call page, `/search`)

- [ ] **T7.8** Every filter / tab / sort / open item is a search param; a default is NOT written (e.g. `?format=speakers`
  never appears). Filter changes replace history (Back leaves the page rather than stepping through filters) except
  `/search`'s submitted query (a history entry).
- [ ] **T7.9** An invalid value (`?tab=bogus`, `?sort=xyz`, `?from=2026-13-45`) falls back to the default without an
  error page.
- [ ] **T7.10** Opening a panel / filtering in place (`?item=` on news, documents filters) keeps the scroll position.

### 4. Phone width (390 × 844)

Resize the pane (`resize_window` if offered; else ask the owner to narrow the pane) and, on each page below, run
`javascript_tool`: `document.documentElement.scrollWidth > window.innerWidth` → must be `false`.

- [ ] **T7.11** `/`, `/calendar`, `/AAPL`, `/AAPL/financials`, `/AAPL/insider-trades`, `/AAPL/holders`, `/AAPL/news`,
  `/AAPL/documents`, call page (player + transcript), `/sec/1067983`, `/alerts/new`, `/alerts/destinations/$id`
  (after Task 8), `/account`.
- [ ] **T7.12** Wide tables scroll inside their wrapper (header scrolls with the page there); the sidebar is a sheet
  on phone width and closes after navigation; top bar fits (search reachable).
- [ ] **T7.13** At ≥ 1024 px a table that fits keeps its header sticky below the pinned header (screenshot while
  scrolled on `/AAPL/dividends`).

### 5. Dark mode

- [ ] **T7.14** Screenshot in dark: `/`, `/AAPL/financials`, call page, `/alerts/new`, a dialog, a toast, the SEC HTML
  viewer (stays white). No unreadable text (dark on dark), charts readable, badges with contrast.

### 6. Keyboard and accessibility

- [ ] **T7.15** Tab through `/alerts/new` and `/AAPL/holders`: visible focus ring everywhere, logical order, menus and
  dialogs trap focus and close on Escape returning focus to the trigger.
- [ ] **T7.16** `TabStrip`s: ←/→ / Home / End move the selection; one `aria-selected`.
- [ ] **T7.17** `read_page` on a few pages: buttons with icons only have accessible names (copy, chart, catalog,
  export, API), images have `alt`, form fields have labels.

### 7. Errors, toasts, offline

- [ ] **T7.18** Block the API for a moment: ask the owner to toggle the machine's network off for ~10 s while you
  reload `/AAPL/dividends` (or skip with `[~]` if the owner declines): an error state with retry renders, no toast
  storm, recovery after network back.
- [ ] **T7.19** A toast from an error quotes ` (<code>, request <id>)`. A page that renders its own error does not also
  toast.
- [ ] **T7.20** Route pending / error components show for a slow / thrown route (observed during the walk; tick if seen
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
