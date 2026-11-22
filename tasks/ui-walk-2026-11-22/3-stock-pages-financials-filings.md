# Task 3 — Stock pages I: layout, overview, financials, filings, filing detail

> **Status: TODO**

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

- [ ] **T3.1** `/AAPL`: pinned header (name, logo, badges "Stock"), sticky below the top bar while scrolling
  (screenshot after scrolling); `h1` = canonical symbol. `/aapl` → canonical `AAPL` shown.
- [ ] **T3.2** Sidebar context "AAPL · Stock" lists only sections AAPL serves (no Holdings). Typing
  `/AAPL/holdings` → the gate sentence, no request for holdings (API sheet), no failing page.
- [ ] **T3.3** Old routes redirect with the query kept: `/AAPL/financials-ratios?x=1` → `/AAPL/financials?view=ratios…`;
  `/AAPL/earnings-calendar` → `/calendar…`; `/AAPL/ipos`, `/AAPL/market-holidays` likewise (check the final URL).

### 2. Overview `/AAPL`

- [ ] **T3.4** Company profile, "Data available" card with each family's `through` day (badges link their sections),
  CIK → `/sec/$cik`, tiles: Next call, Latest filing, website / IR, ownership (institutional / insider / short float as
  percent), address, FIGI, listed. No Fama-French tile.
- [ ] **T3.5** "Fiscal periods" card: newest 8 + "Show all", export; latest fiscal year end shown.
- [ ] **T3.6** Alert entry row: "Create alert" menu with price types + `fundamental_metric` (menu 20rem wide, types
  readable); "N alerts on AAPL" link (count may be 0). Do not create here (Task 9 does).

### 3. Financials `/AAPL/financials`

- [ ] **T3.7** `?view=standardized`: default view presentation; statement select income / balance / cash flow; period
  buttons annual / quarterly (+ ttm if offered); "Load more" adds older columns; sticky first column while scrolling
  sideways; column header tooltip names the filing ("restated by a later filing" where it applies).
- [ ] **T3.8** Summary / Detailed / Presentation each render (no plan notice). Every metric label has the catalog book
  icon → `/catalog?q=<metric_id>` (opens the right row); a click on the icon does not open the row chart.
- [ ] **T3.9** Row chart button (keyboard-reachable): dialog charts oldest → newest, titled by the metric; `?chart=`
  written; reload reopens it; closing clears it.
- [ ] **T3.10** Point in time: set "As of" to a day ~2 years ago → banner `meta.point_in_time` + "Back to current";
  "From filing" picker lists the loaded periods' filings, exclusive with As of; "Back to current" clears both.
- [ ] **T3.11** Fiscal-year window `fyFrom` / `fyTo`: a half-typed year sends nothing; a full range narrows columns.
- [ ] **T3.12** Detailed view: a value is a button → "Explain this number": rule / formula / operands / source facts with
  filing → SEC source panel + EDGAR folder; "Show in filing" → placed spots → panel opens at the block (highlighted).
  A fact without places says so.
- [ ] **T3.13** `?view=as-reported`: Reported only toggle, display-sign select, the three views; concept labels have no
  catalog icon (as-reported concepts are not catalog ids).
- [ ] **T3.14** `?view=ratios`: categories (incl. leverage); values formatted; catalog links on the metric column.
- [ ] **T3.15** `?view=growth`: basis yoy / qoq; fractions shown as percent (0.12 → 12 %); a column only when complete.
- [ ] **T3.16** `?view=cagr`: horizon 3 / 5 / 10 + period buttons (default annual).
- [ ] **T3.17** `?view=segments`: Summary + Detailed (PRO, `DataTable` with export: concept, filing caption, unit,
  filing); metric / axis selects sent to the API (API sheet query shows them); segment picker filters loaded rows and
  says when it hid all.
- [ ] **T3.18** URL state: every control above is in the URL; copy the URL, open it in a new tab (`preview_start`) →
  same view. Close the tab.
- [ ] **T3.19** `/SPY/financials` → gate sentence (no financials dataset), no request.

### 4. Filings `/AAPL/filings`

- [ ] **T3.20** Columns Items, Details, HTML, Documents, EDGAR; header facet line (one form's count + newest date);
  form picker = `meta.form_facet`; `?items=2.02` and a filed-day range sent as `items` / `filed_at.gte|lte` (days,
  not instants: a 400 here is the old `[FU2994]` class bug); `?sort=asc`; fiscal quarter labels on rows.
- [ ] **T3.21** HTML: opens the primary document in the viewer (white page in dark mode too); a row without a public
  copy says "No public copy yet" + the source panel.
- [ ] **T3.22** Documents → source panel (`?docs=<accession>`): documents list, "Read" → reader with blocks, footnotes
  beside their block ("Footnote bN" navigates), "Open figure", previous / next blocks. A `?docs=` accession outside the
  loaded pages still opens.
- [ ] **T3.23** EDGAR link: `href` = the row's EDGAR index, `rel` contains `noopener` / `noreferrer`; open once,
  close.
- [ ] **T3.24** Live switch: pill connected; wait ≤ 3 min (AAPL rows are rare: `[~]` if none); switch off.
- [ ] **T3.25** "Search text": `iPhone` Keyword → hits open their cited block in the panel; Exact + Match case toggle;
  "More results" (≤ 2 pages: 200 credits). 503 → "SEC filing search is not switched on yet".
- [ ] **T3.26** Alert entry: `filing`, `filing_keyword` in the Create alert menu.

### 5. Filing detail `/filings/$accession`

Pick the latest AAPL 10-K (Details link) and, for the Holdings tab, a 13F-HR from `/sec/1067983`.

- [ ] **T3.27** Header (form, filed, company link, EDGAR); tabs `?tab=` Documents (default) · Facts · Notes · Review
  chain · Holdings (only 13F-HR / NPORT-P) · Parties & relations. Each tab's request starts only when opened (API sheet).
- [ ] **T3.28** Documents: "Read" / "Sections" / "Fact places" open below with `?version=&panel=&block=`; a section
  heading opens its first block; a fact place opens its block and links the annotated rendition.
- [ ] **T3.29** Facts (`?tag=`), Notes (`?noteTag=`): lists render, export works.
- [ ] **T3.30** Review chain: `?depth=1..6`, `?direction=up|down`; nodes / edges readable; an empty chain says so.
- [ ] **T3.31** Holdings tab on the 13F-HR: rows + `meta.family`; on the 10-K the tab is absent.
- [ ] **T3.32** Parties & relations: second request with `expand=parties,relations`; renders or empty line.
- [ ] **T3.33** A malformed accession `/filings/123` → not-found state; a well-formed unknown one → API 404 notice.

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
