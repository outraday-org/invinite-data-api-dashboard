# Task 1 — Setup, key gate, shell, start-state inventory

> **Status: DONE (walked 2026-11-22, 10 findings)**

## Goal

Bring up the walk (branch, dev server, browser tab, key), verify the key gate and the app shell that wraps every page
(top bar, sidebar, search, theme, landing, account, status dot, redirects), and record the start state the cleanup in
Task 10 compares against.

## Prerequisites

`GUIDE.md` read. Owner available to paste the ENTERPRISE key once.

## Current Behavior

Key gate: `src/components/api-key/key-gate.tsx` (`useMe()` → `OnboardingCard` on 401). Shell: `src/routes/__root.tsx`,
`src/components/navigation/app-sidebar.tsx`, `ticker-search.tsx`, `src/lib/theme.ts`, landing `src/routes/index.tsx`,
account `src/routes/account.tsx`, status `src/components/reference/api-status.tsx`. See `CLAUDE.md` → "Shell (O5)".

## Desired Behavior

All checks below ticked or logged; the start-state table of `findings.md` filled.

## Requirements

### 1. Bring-up

- [x] **T1.1** `git status` clean on `main`, `git pull --ff-only`, `git switch -c ui-walk-2026-11-22`. Record the base
  sha in `findings.md`.
- [x] **T1.2** `pnpm run dev` in the background; `curl -sI http://localhost:3001` answers 200. Any server error in the
  dev output (not a warning) is a finding.
- [x] **T1.3** Load the built-in browser tools (GUIDE §1); `preview_start` `http://localhost:3001` → app tab.

### 2. Key gate

- [x] **T1.4** If a key is already stored (the page renders), ask the owner whether to clear it first so the gate can
  be tested; if yes, the owner removes it via the top bar's key menu (or "Clear"). Then:
  Expect: the onboarding card (key field with show / hide toggle, "Create one" link to the Invinite Data app, what the
  dashboard shows), NO page content behind it, NO error toasts, top bar still rendered.
- [x] **T1.5** Type an obviously invalid key `invalid-walk-key` into the field and Save (this one the walker may type:
  it is not a key). Expect: inline error, nothing stored, no toast storm; console has no uncaught error.
- [x] **T1.6** Ask the owner to paste the ENTERPRISE key and Save (GUIDE §2). Expect: "Key valid · ENTERPRISE plan ·
  N credits" (wording per `useKeyValidation`), the page renders, the top bar shows the plan badge linking `/account`.
  Plan other than ENTERPRISE → stop and tell the owner.
- [x] **T1.7** Reload the tab. Expect: no flash of the onboarding card before the page (the gate waits for `/v1/me`;
  a brief skeleton is fine), key still stored.

### 3. Top bar and sidebar

- [x] **T1.8** Top bar: sidebar toggle, search, theme toggle, key / plan. Toggle the sidebar closed and open: the
  content column moves (`--sidebar-width`), nothing sits under the sidebar, no horizontal scroll.
- [x] **T1.9** Sidebar groups: Market (Home, Earnings calendar, Live calls with a live count, IPOs, Market holidays),
  Browse (every `BROWSE_NAV` entry in `src/lib/navigation.ts` — read the file and compare: Instruments, Funds,
  Institutions, People, Offerings, Catalog, Transcript search, News feed, Alerts, …), Help (API status with the status
  dot, Licensing), Account (plan). Every link opens its page (click each once; the page title `h2` matches).
- [x] **T1.10** No PRO / plan badge anywhere in the sidebar suggests a missing plan (ENTERPRISE has everything).
- [x] **T1.11** Theme: system → light → dark cycles, persisted on reload, no flash of the wrong theme on reload
  (screenshot right after reload in dark).

### 4. Search (⌘K)

- [x] **T1.12** ⌘K (and Ctrl K) opens the search, also while focus is in an input. Empty state = recents (may be empty
  on a fresh profile: then an empty-state line, not a blank box).
- [x] **T1.13** Type `apple`: Instruments group ranks AAPL first; Enter opens `/AAPL`. Type `AAPL` exact: AAPL first.
- [x] **T1.14** Type `berkshire`: after ~300 ms the Institutions & filers group appears; a manager row opens
  `/sec/$cik`. People group appears for `cook` (or any analyst name) from 3 characters.
- [x] **T1.15** Pills All / Stocks / ETFs / Closed-end funds / ETNs / Institutions / People: ←/→ switch, each narrows
  results; the combobox announces the highlighted option (`aria-activedescendant` via `read_page`).
- [x] **T1.16** Pages group: type `holidays` → Market holidays page entry.
- [x] **T1.17** On `/AAPL/dividends`, search `SPY` → opens `/SPY/dividends` (SPY serves dividends); on
  `/AAPL/financials` search `SPY` → opens `/SPY` overview (SPY has no financials).

### 5. Landing, account, status

- [x] **T1.18** `/`: Live now, Earnings today / later this week (≤ 8), Next IPOs, next market holiday, Browse cards,
  Recently opened (AAPL from T1.13 now listed), SEC filer lookup. Each block has data or an explicit empty line.
- [x] **T1.19** Filer lookup: `1067983` opens `/sec/1067983`; `berkshire` lists matches with phase + listing / "No
  ticker".
- [x] **T1.20** `/account`: plan ENTERPRISE, limits, credits, families (all allowed), usage chart for 7 / 30 / 90 days
  (switch each), by family, by caller; links to the Invinite Data app for keys / billing (`https://data.invinite.com`).
  API status card (overall + families with uptime) and licensing card (rights of the ENTERPRISE plan; "Draft" badge
  only while `counsel_signed_off` is false). Link to `/alerts/users#defaults` present.
- [x] **T1.21** Sidebar status dot colour matches the account page's overall status; its accessible label says it.
- [x] **T1.22** `curl -sI http://localhost:3001/status?x=1` → 301 to `https://status.data.invinite.com/?x=1` (query
  kept); `/licensing` → 301 to `https://data.invinite.com/docs/licensing`.
- [x] **T1.23** A non-existent route `/this-route-does-not-exist-walk` → `/$ticker` "not known" notice (it is treated
  as a symbol) — readable, no crash. `/ZZZZQ` → one "not known" notice, no section requests (API sheet empty except
  the instrument lookup).

### 6. Start-state inventory (for Task 10)

- [x] **T1.24** Open `/alerts`, `/alerts/destinations`, `/alerts/users`, `/alerts/scripts`: record each list's count
  ("N loaded" / `has_more`) in `findings.md`. Record any existing `walk-1122` resources (a previous aborted walk):
  they are deleted in Task 10 too.
- [x] **T1.25** `/live-calls`: is a call live right now? Record yes / no and the next scheduled call time (Task 5 §5
  plans around it).
- [x] **T1.26** Confirm the subjects of GUIDE §9 exist (search each); record replacements if one is missing. Find one
  closed-end fund and one ETN via `/instruments` type tabs and record them.
- [x] **T1.27** Record credits from `/account` (Task 11 reports the walk's cost).

### 7. Console sweep

- [x] **T1.28** `read_console_messages` with `pattern: "error|Error|hydrat|Warning"` across the pages above: no
  hydration mismatch (sidebar skeleton widths, `use-mobile`), no React key warning, no uncaught error.

## Files to Create / Modify

| File | Action | Purpose |
| --- | --- | --- |
| `tasks/ui-walk-2026-11-22/findings.md` | Modify | Start state + findings |
| `tasks/ui-walk-2026-11-22/1-setup-key-gate-shell.md` | Modify | Checklist ticks, status |
| Any `src/**` file | Modify | Only for dashboard fixes (GUIDE §7) |

## Acceptance Criteria

- Branch exists, dev server running, app tab open, ENTERPRISE key stored by the owner (never seen by the walker).
- T1.1–T1.28 ticked, `[~]` with reason, or logged with a finding + outcome.
- Start-state table complete.
- Dashboard fixes committed (one per finding), `pnpm run check` + `pnpm run test` green.
