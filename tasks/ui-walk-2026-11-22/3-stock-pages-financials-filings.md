# Task 3 — Stock pages I: layout, overview, financials, filings, filing detail

> **Status: DONE (walked 2026-11-22, 14 findings)**

## Goal

Walk the instrument layout and the stock pages that carry the most logic: overview, the six financials views
(incl. point-in-time and "Explain this number"), the filings list (incl. live and text search) and one filing's
detail page with every tab.

## Prerequisites

Task 1. Subject `AAPL` (fallback per `findings.md` start state); `MSFT` for a second look where noted.

## Current Behavior

`src/routes/$ticker/route.tsx` (layout + gate), `$ticker/index.tsx`, `$ticker/financials/`,
`components/financials-pages/`, `components/financials-presentation/`, `$ticker/filings/`, `filings/$accession.tsx`.
`CLAUDE.md` → "Instruments and funds" (navigation), "Financials family", "Filings (O7 group 3)", "SEC family".

## Desired Behavior

Every check ticked or logged. Per page also: `PageHeader`, API button, no plan gate (detailed / presentation are PRO
— ENTERPRISE must see them with no "Your plan does not include this view"), console clean.

## Requirements

### 1. Layout

- [x] **T3.1** `/AAPL`: pinned header (name, logo, badges "Stock"), sticky below the top bar while scrolling
  (screenshot after scrolling); `h1` = canonical symbol. `/aapl` → canonical `AAPL` shown.
- [x] **T3.2** Sidebar context "AAPL · Stock" lists only sections AAPL serves (no Holdings). Typing
  `/AAPL/holdings` → the gate sentence, no request for holdings (API sheet), no failing page.
- [x] **T3.3** Old routes redirect with the query kept: `/AAPL/financials-ratios?x=1` → `/AAPL/financials?view=ratios…`;
  `/AAPL/earnings-calendar` → `/calendar…`; `/AAPL/ipos`, `/AAPL/market-holidays` likewise (check the final URL).

### 2. Overview `/AAPL`

- [x] **T3.4** Company profile, "Data available" card with each family's `through` day (badges link their sections),
  CIK → `/sec/$cik`, tiles: Next call, Latest filing, website / IR, ownership (institutional / insider / short float as
  percent), address, FIGI, listed. No Fama-French tile.
- [x] **T3.5** "Fiscal periods" card: newest 8 + "Show all", export; latest fiscal year end shown.
- [x] **T3.6** Alert entry row: "Create alert" menu with price types + `fundamental_metric` (menu 20rem wide, types
  readable); "N alerts on AAPL" link (count may be 0). Do not create here (Task 9 does).

### 3. Financials `/AAPL/financials`

- [x] **T3.7** `?view=standardized`: default view presentation; statement select income / balance / cash flow; period
  buttons annual / quarterly (+ ttm if offered); "Load more" adds older columns; sticky first column while scrolling
  sideways; column header tooltip names the filing ("restated by a later filing" where it applies).
- [x] **T3.8** Summary / Detailed / Presentation each render (no plan notice). Every metric label has the catalog book
  icon → `/catalog?q=<metric_id>` (opens the right row); a click on the icon does not open the row chart.
- [x] **T3.9** Row chart button (keyboard-reachable): dialog charts oldest → newest, titled by the metric; `?chart=`
  written; reload reopens it; closing clears it.
- [x] **T3.10** Point in time: set "As of" to a day ~2 years ago → banner `meta.point_in_time` + "Back to current";
  "From filing" picker lists the loaded periods' filings, exclusive with As of; "Back to current" clears both.
- [x] **T3.11** Fiscal-year window `fyFrom` / `fyTo`: a half-typed year sends nothing; a full range narrows columns.
- [x] **T3.12** Detailed view: a value is a button → "Explain this number": rule / formula / operands / source facts with
  filing → SEC source panel + EDGAR folder; "Show in filing" → placed spots → panel opens at the block (highlighted).
  A fact without places says so.
- [x] **T3.13** `?view=as-reported`: Reported only toggle, display-sign select, the three views; concept labels have no
  catalog icon (as-reported concepts are not catalog ids).
- [x] **T3.14** `?view=ratios`: categories (incl. leverage); values formatted; catalog links on the metric column.
- [x] **T3.15** `?view=growth`: basis yoy / qoq; fractions shown as percent (0.12 → 12 %); a column only when complete.
- [x] **T3.16** `?view=cagr`: horizon 3 / 5 / 10 + period buttons (default annual).
- [x] **T3.17** `?view=segments`: Summary + Detailed (PRO, `DataTable` with export: concept, filing caption, unit,
  filing); metric / axis selects sent to the API (API sheet query shows them); segment picker filters loaded rows and
  says when it hid all.
- [x] **T3.18** URL state: every control above is in the URL; copy the URL, open it in a new tab (`preview_start`) →
  same view. Close the tab.
- [x] **T3.19** `/SPY/financials` → gate sentence (no financials dataset), no request.

### 4. Filings `/AAPL/filings`

- [x] **T3.20** Columns Items, Details, HTML, Documents, EDGAR; header facet line (one form's count + newest date);
  form picker = `meta.form_facet`; `?items=2.02` and a filed-day range sent as `items` / `filed_at.gte|lte` (days,
  not instants: a 400 here is the old `[FU2994]` class bug); `?sort=asc`; fiscal quarter labels on rows.
- [x] **T3.21** HTML: opens the primary document in the viewer (white page in dark mode too); a row without a public
  copy says "No public copy yet" + the source panel.
- [~] **T3.22** Documents → source panel (`?docs=<accession>`): documents list, "Read" → reader with blocks, footnotes
  beside their block ("Footnote bN" navigates), "Open figure", previous / next blocks. A `?docs=` accession outside the
  loaded pages still opens.
- [x] **T3.23** EDGAR link: `href` = the row's EDGAR index, `rel` contains `noopener` / `noreferrer`; open once,
  close.
- [~] **T3.24** Live switch: pill connected; wait ≤ 3 min (AAPL rows are rare: `[~]` if none); switch off.
- [x] **T3.25** "Search text": `iPhone` Keyword → hits open their cited block in the panel; Exact + Match case toggle;
  "More results" (≤ 2 pages: 200 credits). 503 → "SEC filing search is not switched on yet".
- [x] **T3.26** Alert entry: `filing`, `filing_keyword` in the Create alert menu.

### 5. Filing detail `/filings/$accession`

Pick the latest AAPL 10-K (Details link) and, for the Holdings tab, a 13F-HR from `/sec/1067983`.

- [x] **T3.27** Header (form, filed, company link, EDGAR); tabs `?tab=` Documents (default) · Facts · Notes · Review
  chain · Holdings (only 13F-HR / NPORT-P) · Parties & relations. Each tab's request starts only when opened (API sheet).
- [x] **T3.28** Documents: "Read" / "Sections" / "Fact places" open below with `?version=&panel=&block=`; a section
  heading opens its first block; a fact place opens its block and links the annotated rendition.
- [x] **T3.29** Facts (`?tag=`), Notes (`?noteTag=`): lists render, export works.
- [~] **T3.30** Review chain: `?depth=1..6`, `?direction=up|down`; nodes / edges readable; an empty chain says so.
- [x] **T3.31** Holdings tab on the 13F-HR: rows + `meta.family`; on the 10-K the tab is absent.
- [x] **T3.32** Parties & relations: second request with `expand=parties,relations`; renders or empty line.
- [x] **T3.33** A malformed accession `/filings/123` → not-found state; a well-formed unknown one → API 404 notice.

## Walk results (2026-11-22)

- T3.1 F031 (fixed: alert entry points used `/aapl`'s spelling); header pinned below the top bar after scrolling, `h1` = AAPL on `/aapl`.
- T3.2 the gate sentence on `/AAPL/holdings`, no fund-holdings request. T3.3 all nine old routes 301 with the query kept.
- T3.4 F032 (fixed: the overview had no `PageHeader` / API button). T3.5, T3.6 pass (menu 20rem, five types).
- T3.7 F033 (data: "Operating Costs And Expenses" = R&D), F034 (api: balance-sheet columns name a filing without that balance sheet); sticky first column, Load more, restated tooltip (none restated in the loaded AAPL periods).
- T3.8, T3.9 pass (catalog link opens exactly `bs_total_assets`; `?chart=` written, reopened on reload, cleared on close).
- T3.10 F035 (fixed: tooltip day vs picker day). T3.11 pass (a half-typed year sends nothing).
- T3.12 F036 (fixed: a derived fact's operands / source value / formula); a reported value's "Show in filing" opens the 10-Q at the highlighted table block; the derived Q4 says "No place of this value in a stored document."
- T3.13 F037 (fixed: As reported Presentation rendered no rows). Seen, not logged: the detailed view's "Basic" / "Diluted" captions repeat for EPS and share counts (the filing's own captions).
- T3.14 pass; `category=valuation` answers no rows for AAPL (thin data). T3.15–T3.19 pass (horizon writes `?horizon=%225%22`, the router's round-trip rule as in F027).
- T3.20 F038 (fixed: raw ISO days), F039 (fixed: `?form=144` dropped). T3.21 F040 (fixed: Form 4 XML framed as HTML); "No public copy yet" seen on the FY2022 10-K (its filing lists no documents).
- T3.22 [~] — documents list, Read, Open figure, previous / next blocks and an out-of-page `?docs=` pass; no footnote in the blocks read, so "Footnote bN" was not exercised. (Previous blocks steps 40 back while Next steps a 200-block answer: by design, `SEC_BLOCK_PAGE`.)
- T3.23 pass (EDGAR index resolves). T3.24 [~] — "Listening for new filings" for ~4 min, no AAPL filing (Sunday); switched off.
- T3.25 pass: Keyword `iPhone` (10 + 5 hits, `meta.index` partial note), a hit opens its cited block, Exact + Match case (`mode=literal&case_sensitive=true`); about 5–6 search pages billed (500–600 credits: search, More results, the Exact re-run, Match case toggled by a script click and once by hand). 503 not met (search on).
- T3.26 pass. T3.27 pass (each tab's request only once opened). T3.28 F041 (api: generic outline pending for the FY2026 10-K; legacy complete), F042 (fixed: "Item Item 1.").
- T3.29 F041 (facts pending through Oct 31 on the 10-K), F043 (data: calendar-month periods, duplicate fact rows, apostrophes dropped in notes); export CSV downloaded.
- T3.30 [~] — depth / direction in the URL and the empty-chain sentence pass; no AAPL filing with edges found (even the 2024 UPLOAD letter answers one `not_held` node), so nodes / edges were not seen.
- T3.31 pass on BRK 13F-HR 0001193125-26-352200 (the Nov 16 one is pending); the tab is absent on the 10-K. T3.32 pass. T3.33 F044 (fixed: `/filings/123` validation dump); the unknown well-formed one reads "Not known to the SEC store".

## Files to Create / Modify

| File | Action | Purpose |
| --- | --- | --- |
| `tasks/ui-walk-2026-11-22/findings.md` | Modify | Findings |
| this task file | Modify | Ticks, status |
| `src/routes/$ticker/**`, `src/routes/filings/**`, `src/components/financials-*/**`, `src/components/sec/**`, tests | Modify | Dashboard fixes only |

## Acceptance Criteria

- Routes `/$ticker`, `/$ticker/financials` (6 views), `/$ticker/filings`, `/filings/$accession` and the redirects
  visited.
- T3.1–T3.33 ticked / `[~]` / logged with outcome; fixes committed with tests; check + test green.
