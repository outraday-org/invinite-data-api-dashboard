# Instrument overview, ownership, corporate actions

> **Status: TODO**

## Goal

Rebuild the instrument overview (stock, fund, ETN) from sections and stat grids, and move the ownership and
corporate-action pages (holders, holdings, insider trades, dividends, splits) onto the shared pieces of task 6.

## Prerequisites

Tasks 5 and 6.

## Current Behavior

- `$ticker/index.tsx`: stock = 3 link tiles (next call, latest filing, links) + 5 fact tiles
  (`CompanyFactTilesView`) + "Company Info" card + "Market Data" card + "Data available" pill card + "Fiscal
  periods" card with a table + "Description" card (F6). Fund = `FundProfileView`, ETN = `InstrumentCard`.
- Holders: quarter + instruments selects in the header actions, tabs, per-source blocks; the 13F table's "Voting
  authority" column is cut at 1440 px.
- Insider trades: side, two day ranges, kind, sort in the header.

## Desired Behavior

### Overview (stock)

```
Overview                                                   [Create alert ▾]
Apple is among the largest companies … (2 lines, "More" expands)   ← description first: it says what this is

Key facts            (StatGrid, 4 columns ≥ 1280, 3 ≥ 640, 2 phone; hairline dividers)
  Market cap $5.07T · Shares outstanding · Exchange XNAS · Listed since 1980
  Sector · Industry · Employees · Currency
  Institutional 63.65% · Insider 0.07% · Short float 1%   (sub-line: share counts)

Next up              two link rows: Next call (or "None scheduled") · Latest filing (form · day)
Identifiers          CIK (copy, → /sec/$cik) · FIGI (copy) · Website ↗ · Investor relations ↗ · Address
Data available       coverage families as a compact two-column list "Financials — through Sep 26, 2026",
                     each linking its section (not pills)
Fiscal periods       Section with the table (toolbar: count + Export), newest 8 + "Show all"
```

- One column of `Section`s; "Next up" + "Identifiers" sit in a right-hand column (`grid-cols-[1fr_20rem]`) beside
  "Key facts" + "Data available" when the content column is wide enough. Decide by the content's width, not the
  viewport or the panel store: a container query on the page container (`@container` + `@5xl:grid-cols-[1fr_20rem]`,
  ≈ 1024 px of content), so a docked panel or an open sidebar falls back to one column by itself.
- Values that are null are left out of the grid (no "—" tiles); a grid row never has one orphan.
- Fund overview (`FundProfileView`) and ETN (`InstrumentCard`): same vocabulary — `StatGrid` for net assets /
  expense ratio / shares outstanding / short interest, `Section`s for share classes, advisers, composition line,
  coverage. No request changes (the `limit=1` composition request stays as is).

### Holders

- `FilterBar`: Quarter, Instruments (13F tabs only), in the Changes tab: change types (chips), prior quarter,
  manager CIKs. Tabs = line tabs under the header.
- Overview tab: one `Section` per source with its state badge, as-of and "N shown of T" in the section's meta,
  "Show all" as the section action.
- 13F table: merge "Voting authority" into one cell with three aligned numbers and a tooltip header, or move it
  behind the row detail if it still overflows at 1440 with the panel docked; first column sticky.

### Holdings (funds), insider trades, dividends, splits

- Holdings: `FundSourceBadge` + as-of picker in the `FilterBar`; weights block as a `Section` with the dimension
  switch as a segmented control; bars use `--brand` at reduced opacity, labels outside the bar.
- Insider trades: `FilterBar` — Side, Filed (range), Traded (range), Kind, Order. The code legend becomes a
  disclosure under the table. Detail dialog: `StatGrid` + sections.
- Dividends (already migrated in task 6) and splits: same pattern.

## Requirements

1. Rework the overview views with `Section`, `StatGrid`, `Stat`: `CompanyFactTilesView`, `CoverageCard`,
   `FundProfileView` and `InstrumentCard` are all defined in `src/routes/$ticker/index.tsx` (no `-components`
   folder exists); `FiscalPeriodsCard` is `src/components/reference/fiscal-periods-card.tsx`; the fund's composition
   / adviser pieces live in `src/components/sec/fund-views.tsx`. Extracting the overview views into
   `src/routes/$ticker/-overview/*.tsx` is allowed if `index.tsx` grows past ~600 lines.
2. Migrate holders (`holder-views.tsx`, the route), holdings, insider trades, splits to `PageHeader` + `FilterBar`
   + `DataTable` toolbar.
3. Every link that exists today still exists (coverage → section, CIK → `/sec/$cik`, website https only, alert
   entry points in `PageHeader` actions).
4. States per section: loading skeletons shaped like the section, `404 not_covered` notice, pending coverage notice
   (`SecReadinessNotice`), empty only when genuine — unchanged logic.
5. Tests updated: `overview-and-calls.test.tsx`, `fund-overview.test.tsx`, `holdings-page.test.tsx`,
   `sec-v2-pages.test.tsx` (holders, insider), `reference-pages.test.tsx` (fiscal periods card).
6. Responsive: at 375 px the overview's first screen shows description + the first stat rows (2 columns); filter
   bars collapse; tables keep the first column sticky. Check AAPL (stock), SPY (ETF), GLD (trust), an ETN, a
   closed-end fund.

## Files to Create / Modify

| File | Action | Purpose |
| --- | --- | --- |
| `src/routes/$ticker/index.tsx`, `src/components/reference/fiscal-periods-card.tsx` | Modify | sections + stats |
| `src/components/sec/{fund-views,holder-views}.tsx` | Modify | sections, filter bar, table |
| `src/routes/$ticker/{holders,holdings,insider-trades,stock-splits}/index.tsx` | Modify | shared pieces |
| `src/lib/sec/ownership.ts` | Read only | code legend labels (`INSIDER_CODE_LABELS`) for the disclosure |
| tests named above | Modify | |

## Acceptance Criteria

- `/AAPL` has no nested card, no tile grid; the page is at most ~2.5 screens at 1440 × 900 (was ~4).
- `/SPY`, `/GLD`, an ETN and a closed-end fund render with the same building blocks.
- Holders' 13F table shows all columns at 1440 px with the request panel closed, and scrolls inside itself (first
  column pinned) with it docked.
- Requests of each page unchanged (compare in the panel before / after).
- No sideways page scroll at 375 / 768 / 1024 / 1440.
- `pnpm run check`, `pnpm run test` green.
