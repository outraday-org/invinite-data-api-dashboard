# Market, browse, reference, account

> **Status: TODO**

## Goal

Migrate the remaining global pages — IPO calendar, market holidays, instruments, funds, institutions, spot coins,
US macro, catalog, account — to the shared pieces.

## Prerequisites

Task 6.

## Current Behavior

Each page has its own header + filter arrangement; `/account` is three cards + chart + tables; `/catalog` rows are
tall because the description column is narrow (4–5 line wraps at 1440 px); macro pages use `max-w-7xl`.

## Desired Behavior

### Lists: `/ipo-calendar`, `/market-holidays`, `/instruments`, `/funds`, `/institutions`, `/spot-coins`

- `PageHeader` (title, description, meta = count where the page knows it) → line tabs where the page has them
  (Upcoming / Recent, Upcoming / Past, type tabs, Companies) → `FilterBar` → `DataTable` with toolbar.
- `/instruments`: type tabs as line tabs with the Companies tab last; search field first in the `FilterBar`
  (wider: `minmax(16rem, 24rem)`).
- Detail views (`/ipo-calendar` row detail, `/spot-coins/$coin`): `StatGrid` + sections; the coin page's header in
  the same language as the ticker header (logo, symbol, name, rank badge).

### US macro (`/us-macro/*`, `src/components/macro/macro-page.tsx`)

- `PageContainer width="wide"`; a snapshot `StatGrid` on top (latest value, change, release day per headline
  series), the chart as a `Section` (toolbar: series picker, range, Live switch from `MacroPageActions`), the
  observations table below with export. Yield curve: curve chart + maturity table side by side from `xl`, stacked
  below.
- Charts: axes and grid from `--border` / `--muted-foreground`, series from `--series-*` (fixed slot per entity as
  today), a labelled table beside every chart stays (the palette note in `styles.css`).
- `MacroAvailability` states (waiting for `/v1/me`, legacy account notice) as `Notice`s in the page frame.

### Catalog

- Tabs as line tabs (7); `FilterBar` (text, statement / form / metric chip); the Metrics table: name + id (mono,
  muted) in the first column, description column `min-w-[28rem]` so it wraps to ≤ 2 lines at 1440 px, "Mapping
  rules" as a quiet row action. Mapping-rule JSON views keep their scroll box (code).

### Account

```
Account                                                      [7 | 30 | 90 days]
Plan Enterprise · 100 req/s · 1,000 req/min        Keys, invoices and plan changes: Invinite Data app ↗

Credits            StatGrid: Remaining · Used this period (with a thin progress bar) · Resets · Prepaid balance
Usage              chart (credits per day) with its summary line; below it two tables side by side from xl:
                   By endpoint family · By caller
Data families      the allowed families as a compact multi-column text list (not 25 pills)
API status         families table with uptime; details behind the existing disclosure
Licensing          rights list
End-user defaults  link row → /alerts/users#defaults
```

- The day-window switch is a segmented control in `PageHeader` actions; everything else `Section`s.
- The usage bar chart: bars in `--brand`, the empty days as a visible baseline, tooltip with credits + requests.

## Requirements

1. Migrate the pages above; `AccountStatusCards` (`api-status.tsx`) becomes two sections.
2. No request / URL-state change; `/catalog` still loads only the open tab; `MacroAvailability` still gates queries.
3. States per page as today (loading skeleton rows, error states, genuine-empty rule, plan / availability notices).
4. Tests updated: `market-pages.test.tsx`, `browse-pages.test.tsx`, `funds-page.test.tsx`,
   `reference-pages.test.tsx`, `macro-pages.test.tsx`, `account-page.test.tsx`, `spot-coins.test.tsx`.
5. Responsive checks at 375 / 768 / 1024 / 1440 for each page; macro charts keep a readable height (≥ 220 px) on
   phone and their tables scroll inside themselves.

## Files to Create / Modify

| File | Action | Purpose |
| --- | --- | --- |
| `src/routes/{ipo-calendar,market-holidays,instruments,funds,institutions,catalog,account}.tsx` | Modify | shared pieces |
| `src/routes/spot-coins/**`, `src/components/coins/**` | Modify | list + detail |
| `src/routes/us-macro/**`, `src/components/macro/**` | Modify | page frame, sections |
| `src/components/reference/{api-status,companies-list}.tsx`, `src/components/charts/chart-parts.tsx` | Modify | sections, chart tokens |
| tests named above | Modify | |

## Acceptance Criteria

- All listed pages use `PageHeader` + `FilterBar` + `DataTable` / `Section`; none has a nested card.
- `/account` fits the plan, credits and the usage chart in the first screen at 1440 × 900.
- Catalog metric rows are ≤ 2 lines at 1440 px.
- Charts are legible in both themes (axis text ≥ 4.5:1).
- Requests of every page unchanged; no sideways page scroll at any checked width.
- `pnpm run check`, `pnpm run test` green.
