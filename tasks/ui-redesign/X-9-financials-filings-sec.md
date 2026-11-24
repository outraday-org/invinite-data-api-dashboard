# Financials, filings, SEC pages

> **Status: TODO**

## Goal

Bring the densest pages — the financial statements, the filings lists and detail, the filer page, offerings and SEC
data sets — onto the shared pieces, with a statement toolbar that reads as groups instead of a wall of buttons.

## Prerequisites

Tasks 5 and 6 (`/$ticker/filings` was migrated in task 6 as the reference).

## Current Behavior

- `/$ticker/financials`: a pill tab row (Standardized … Segments), `h2`, then in the header actions: statement
  select, three view buttons, four period buttons, "FY from – to", an unlabelled date input, a "Latest filings"
  select, API; below it "Values in USD", a hint, Expand / Collapse all; then the table. At 375 px this is a full
  screen before the first number (F5, F10).
- `/filings`, `/filings/$accession`, `/sec/$cik`, `/offerings`, `/offerings/$offeringId`, `/sec/datasets`:
  each its own header + filter arrangement.

## Desired Behavior

### Financials

```
Financials                                                     (PageHeader; no per-view h2 repetition)
Standardized  As reported  Ratios  Growth  CAGR  Segments      line tabs (URL ?view=, hidden by datasets as today)

[Income statement ▾]  [Summary | Detailed PRO | Presentation PRO]  [Quarterly | Annual | YTD | TTM]     row 1: what
Fiscal years [2019]–[2026]   As of [date]   From filing [Latest ▾]                     [Reset]          row 2: when
Values in USD · Detailed view explains each value                    [Expand all] [Collapse all]        table toolbar
```

- Row 1 = "what" (statement, layout, period) as segmented controls; row 2 = "when" (fiscal-year window, as-of day,
  from-filing) inside a `FilterBar` with visible labels; `as_of` / `filing` stay exclusive as today. Below 640 px
  row 1 stays visible (segmented controls scroll sideways inside their own row if needed) and row 2 collapses into
  "Filters · n".
- The point-in-time banner (`meta.point_in_time`) = a `Notice` with "Back to current" between toolbar and table.
- Tables: shared head / row classes (task 6); the metric column sticky with a max width and truncation + `title`;
  the two per-row icons (catalog link, chart) appear on row hover / focus-within from `lg`, always on touch;
  period columns `min-w` so 8 quarters fit at 1440 px with the panel closed; indentation of the presentation tree
  12 px per level (was more), group rows medium weight, totals with a top hairline.
- Plan badges stay generated (`TIER_BADGE_LABELS` / `tierLabel(operationId)`; `standardized.tsx`'s descriptions
  already use `tierLabel`). Two user-visible strings still type the plan and break the rule that a plan name is
  read, not typed: the Segments detailed description in `src/components/financials-pages/segments.tsx`
  ("… and the filing (PRO).") and the "Fact places" button title in `src/routes/filings/$accession.tsx` ("… in this
  document (PRO)"). Build both from `tierLabel` of their operation (`listSegmentsDetailed`, `listFactPlaces`) or
  show a `PlanBadge`. Doc comments that say "(PRO)" are not UI and stay.
- "Load older periods" stays at the right edge of the table, vertically centred on the header row.
- Chart dialog (`MetricChartDialog`) and the two explain dialogs: section layout, `StatGrid` for the fact's
  attributes, formula chips unchanged in behaviour.

### Filings family

- `/filings` (live list + "Search every filer"): two `Section`s; the live switch in `PageHeader` actions; the search
  filters in a `FilterBar` inside the search section (committed on Search only, as today); `SearchMatchesNote` as
  the result section's meta line.
- `/filings/$accession`: header = form + company + filed day as title, a `StatGrid` for the filing's facts
  (accession with copy, period, items, accepted), tabs as line tabs; Documents tab: document rows with their
  actions (Read / Sections / Fact places) as a quiet button group; the reader / outline panel below as a `Section`.
- `/sec/$cik`: `SecFilerHeader` in the same visual language as the ticker header (name as `h1`, phase / listing
  badges, CIK with copy) and — since the sidebar context lists its blocks as anchors — the same anchors as an
  in-page tab row under the header (`FILER_ANCHORS`, links to `#id`, active by scroll position is optional: skip
  it if it costs more than a simple anchor row). Blocks = `Section`s: Lifecycle, Fund, Private offerings, Filings,
  13F portfolio, Position changes.
- `/offerings`, `/offerings/$offeringId`, `/sec/datasets`: `PageHeader` + `FilterBar` + `DataTable`; detail =
  `StatGrid` + sections.
- SEC source panel / HTML / PDF dialogs: only tokens and typography (they are scroll boxes by design); the HTML
  viewer keeps its white page.

## Requirements

1. Financials: restructure the toolbars into the two rows — `ViewButtons`
   (`src/components/financials-presentation/financials-statements-view.tsx`), the period buttons, `FiscalYearRange`
   (`src/components/financials-pages/fiscal-year-range.tsx`), `point-in-time.tsx`, and the per-view files in
   `src/components/financials-pages/` (standardized, as-reported, ratios, growth, cagr, segments); no change to
   `financialsSearchSchema` or requests.
2. Filings family pages as above; `SecListFrame` renders its meta line in the `DataTable` toolbar slot.
3. States unchanged: plan gate text for detailed / presentation, `FinancialsStateNotice`, readiness notices, the
   malformed-accession notice.
4. Tests updated: `financials-v2-pages.test.tsx`, `filing-detail.test.tsx`, `filings-page.test.tsx`,
   `sec-search.test.tsx`, `sec-filer.test.tsx`, `offerings-pages.test.tsx`, `sec-source-panel.test.tsx`
   (only where markup assertions change).
5. Responsive checks: `/AAPL/financials` in every view at 375 (first number visible within the first screen after
   the header and row 1), 768, 1024, 1440; `/filings/<accession>` with a 10-K (many documents) and a 13F-HR
   (Holdings tab); `/sec/320193` and a 13F manager.

## Files to Create / Modify

| File | Action | Purpose |
| --- | --- | --- |
| `src/components/financials-pages/**`, `financials-presentation/**`, `financial-metrics/**`, `metric-chart/**` | Modify | toolbar rows, table styles, dialogs |
| `src/routes/$ticker/financials/index.tsx` | Modify | header + tabs (the six `financials-*` / `segmented-financials` folders are `beforeLoad` redirects: untouched) |
| `src/routes/filings/**`, `src/routes/sec/**`, `src/routes/offerings/**` | Modify | shared pieces |
| `src/components/sec/{sec-filer-views,sec-list-frame,sec-filing-search,sec-filer-lookup}.tsx` | Modify | sections, filter bar |
| tests named above | Modify | |

## Acceptance Criteria

- The statement toolbar reads as two labelled rows at 1440 px and never wraps mid-group at 1024 px.
- At 375 px the first statement value is visible without scrolling more than one screen.
- 8 quarterly columns visible at 1440 px (panel closed); with the panel docked the table scrolls inside itself with
  the metric column pinned.
- No typed plan name remains in a user-visible string of these pages:
  `grep -rn "(PRO)" src/components/financials-pages src/components/financials-presentation src/routes | grep -v -E ":\s*(//|/\*|\*)"`
  is empty (doc comments excluded).
- Requests and URL state of every page unchanged.
- `pnpm run check`, `pnpm run test` green.
