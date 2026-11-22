# Task 2 — Market and browse pages (global routes)

> **Status: TODO**

## Goal

Walk every global (non-instrument, non-alerts) page: its data, filters, URL state, empty / error states, "Load more",
links out. Instrument, filer and people detail pages come in later tasks; here they are only opened as link targets.

## Prerequisites

Task 1 (key stored, dev server up).

## Current Behavior

Routes in `src/routes/`: `calendar.tsx`, `live-calls.tsx`, `ipo-calendar.tsx`, `market-holidays.tsx`,
`instruments.tsx`, `funds.tsx`, `institutions.tsx`, `catalog.tsx`, `search.tsx`, `news-feed.tsx`, `filings/index.tsx`,
`sec/datasets.tsx`, `offerings/index.tsx`, `people/index.tsx`. Behaviour: `CLAUDE.md` → "Shell (O5)" global pages,
"Reference (O7 group 7)", "Earnings (O7 group 5)" `/search`, "News page" `/news-feed`, "Filings (O7 group 3)".

## Desired Behavior

Every check ticked or logged. For every page also check (not repeated per check): `PageHeader` title + description +
API button; no plan gate; console clean; the page title in the tab (`… — Invinite Data`).

## Requirements

### 1. Earnings calendar `/calendar`

- [ ] **T2.1** Default window (yesterday … today + 14, New York days); rows grouped by day with sticky day headings
  + counts; one status badge per row with its meaning in a tooltip; call cell (time + quality, or "No call") and
  report cell (BMO / AMC / …).
- [ ] **T2.2** Presets Today / This week / Next week change `?from=&to=`; a swapped range (`from > to` typed in the
  URL) is ordered, not an error. A range > 92 days → the API's 400 shown as a readable notice (not a toast storm).
- [ ] **T2.3** Filters: company, type ("All events"), status, date certainty, fiscal year / quarter, session, event
  status — each in the URL; reload keeps them. Auto-loads ≤ 10 pages then "Load more".
- [ ] **T2.4** A row's call link opens `/$ticker/earnings-calls/$eventId` under the call's own symbol.

### 2. Live calls `/live-calls`

- [ ] **T2.5** Live cards if any (with "started N min ago"), else the next scheduled calls; no card claims live audio.
  The sidebar's live count equals the number of cards.

### 3. IPO calendar `/ipo-calendar`

- [ ] **T2.6** Upcoming (listing date ascending) and Recent (≤ today, newest first) tabs; stage / SPAC / listing-date
  filters in the URL; a listed symbol links `/$ticker`; "Details" opens `/v1/ipos/{id}` content (dialog or panel)
  with the issuer linking `/sec/$cik`.

### 4. Market holidays `/market-holidays`

- [ ] **T2.7** Upcoming / Past tabs; status Closed / Early close; a `?from=&to=` day range narrows inside the tab and
  never jumps tabs; export CSV works (one download).

### 5. Instruments `/instruments` + Companies tab

- [ ] **T2.8** Type tabs (Stocks / ETFs / Closed-end funds / ETNs); structure, exchange, listed, name, sort in the
  URL; badges (Stock / ETF / Trust / Delisted); "Load more" by cursor; export.
- [ ] **T2.9** `?view=companies`: search, exchange, sector (choices), sort; logo + ticker → `/$ticker`; fiscal year
  end as "Sep 30" (Data API 8.0 serves `fiscal_year_end`: a column of "—" everywhere is now a finding — check the API
  sheet answer first: null in the answer = `api`, present but not shown = `dashboard`); CIK → `/sec/$cik`.

### 6. Funds `/funds`

- [ ] **T2.10** Type, structure ("with holdings"), exchange filters, sort by symbol / name, ticker / name search, all in
  the URL; net assets column formatted (`$3.95T`-style); "Load more"; export. An ETN never appears.

### 7. Institutions `/institutions`

- [ ] **T2.11** 13F managers by cursor; each row → `/sec/$cik`; export; "Load more" tooltip names the cost.

### 8. Offerings `/offerings` (detail in Task 6)

- [ ] **T2.12** Latest-filing day range, exemption picker, industry (≥ 2 characters, exact), sold presets, amendment
  filter — all in the URL; one fixed order; export; a row opens `/offerings/$offeringId`.

### 9. People `/people` (detail in Task 6)

- [ ] **T2.13** `?q=` name, `?company=AAPL` (columns "Calls here" / "Questions here" appear), `?event=`, `?role=`,
  `?sort=`; 50 a page; export. `?company=SPY` → the API's `not_covered` words as a notice (a fund), not a crash.

### 10. Catalog `/catalog`

- [ ] **T2.14** Six tabs (Metrics, Sections, Forms, Event types, Document kinds, Mapping rules); only the open tab
  requests (API sheet). Each loads all its pages by itself.
- [ ] **T2.15** `?q=` filters loaded rows; `?q=<exact metric id>` keeps exactly that row; `?statement=` / `?form=`
  filters; a metric row's "Mapping rules" link sets `?metric=` and a chip clears it; a form row links its sections;
  export per tab.

### 11. Transcript search `/search`

- [ ] **T2.16** Submit `gross margin` (Keyword): ≤ 8 passages, each titled with its symbol and linking its call page;
  the page says one page only and, at 8, how to narrow; the window text says "last 365 days" without from / company.
  `?q=` written on submit only (typing does not change the URL).
- [ ] **T2.17** Exact mode with `ab` and no company → not sent (inline explanation). Exact `"free cash flow"` with
  `company=AAPL` → results or "No passages found" only with complete coverage. `company=AAPL,MSFT` → the API's 400
  shown as a notice. Export CSV of the hits. (3 searches total: 30 credits.)

### 12. News feed `/news-feed`

- [ ] **T2.18** Watchlist scope: add AAPL, MSFT, NVDA (≤ 20, kept in this browser after reload); one `company=<list>`
  request per page (API sheet: ONE request, not three); pager Previous / Page N / Next centred under the table;
  filters kind / topic / source / earnings / from / to / sort in the URL.
- [ ] **T2.19** A headline opens `?item=` panel (Task 4 checks the panel in depth) without scrolling to the top.
- [ ] **T2.20** Live switch on: the pill shows connected; wait up to 3 minutes for a `news_item` (marked "New") —
  none arriving is `[~]`, not a finding. Switch off. `?scope=market`: nothing listed, live-only explanation, search
  box without company.
- [ ] **T2.21** Search box: Keyword `guidance` → hits with "Headline" / "Lede" / "Summary · …" and relevance in the
  tooltip; 503 `unavailable` = "News search is not enabled" notice (record which you got).

### 13. Filings `/filings` and data sets `/sec/datasets`

- [ ] **T2.22** `/filings`: live list since open (on by default; `?paused=true` pauses); `?form=8-K` filters the
  arrived rows and says how many it hides; a row links its instrument's filings or `/sec/$cik` and `/filings/$accession`.
  Wait ≤ 3 min for a row (none = `[~]`).
- [ ] **T2.23** "Search every filer": type `going concern`, set form `10-K` and a filed range — nothing is sent until
  Search (API sheet). Results: `SearchMatchesNote` (examined / total or "at least", order, filed range); a hit links
  `/filings/$accession`; "More results" once (200 credits total).
- [ ] **T2.24** `/sec/datasets`: each code with its name, newest release, date, forms; an unknown code shown as
  stated; export.

## Files to Create / Modify

| File | Action | Purpose |
| --- | --- | --- |
| `tasks/ui-walk-2026-11-22/findings.md` | Modify | Findings |
| this task file | Modify | Ticks, status |
| `src/routes/<page>.tsx`, shared pieces, tests | Modify | Dashboard fixes only (GUIDE §7) |

## Acceptance Criteria

- Every global route of GUIDE §8 except detail pages, `/account`, `/` (Task 1) visited.
- T2.1–T2.24 ticked / `[~]` / logged with outcome; fixes committed with tests; `pnpm run check` + `pnpm run test`
  green.
