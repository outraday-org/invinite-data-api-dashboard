# Task 4 — Stock pages II: ownership, corporate actions, news, documents

> **Status: TODO**

## Goal

Walk the remaining stock pages: insider trades, holders (all tabs), dividends, stock splits, news (list, item panel,
announcements, search, live, event filter) and the documents library (tree, filters, text, search, SEC search).

## Prerequisites

Task 1. Subject `AAPL`; `NVDA` where AAPL has thin data.

## Current Behavior

`src/routes/$ticker/{insider-trades,holders,dividends,stock-splits,news,documents}/`. `CLAUDE.md` → "Ownership and
offerings (O7 group 6)", "Instruments and funds" (Holders), "Reference" (Dividends), "News page", "Documents page".

## Desired Behavior

Every check ticked or logged. Per page: `PageHeader`, API button, no plan gate, console clean, URL state survives a
reload.

## Requirements

### 1. Insider trades `/AAPL/insider-trades`

- [ ] **T4.1** Columns incl. "Traded", one "Code" column (tooltip in words) + "Deriv." marker, legend of the loaded
  codes under the table; sticky first column when the table scrolls sideways; no horizontal page scroll.
- [ ] **T4.2** Filters `?side=buy|sell`, filed days `?from=&to=`, transaction days `?tfrom=&tto=`, `?kind=derivative`,
  `?sort=oldest` — API sheet shows days (`filed_at.gte` = `YYYY-MM-DD`, never an instant); a swapped range ordered.
- [ ] **T4.3** "Details" → dialog shows the loaded row at once, then the detail (10b5-1, direct / indirect + nature,
  derivative terms, before / after, footnotes, source); `?trade=<id>` in the URL; "Open the filing" →
  `/AAPL/filings?docs=…`. Export works.

### 2. Holders `/AAPL/holders`

- [ ] **T4.4** Overview tab: one block per `meta.sections[]` source (13F / N-PORT / issuer files) with state, as-of,
  "N shown of T" / "more available", reason; rows of different sources never merged; "Show all" opens that tab.
- [ ] **T4.5** Institutions (13F): discretion in words, voting authority, filing link; `?instruments=all` changes the
  request (API sheet) on overview and 13F only. Quarter picker `?period=` (not shown on the issuer-file tab).
- [ ] **T4.6** Funds (N-PORT): fund holder links its page when listed, unlisted = text; "Issuer file D" on rows that
  have one. ETFs (issuer files): scope line names `meta.funds_with_issuer_file`, never claims completeness.
- [ ] **T4.7** 13F changes: type chips `?types=new,added`, `?prior=`, `?filer=` (comma CIKs, debounced) sent; export.
- [ ] **T4.8** A source's list is requested only once its tab opens (API sheet). Tab list wraps at phone width (Task 7
  checks widths; note here if it already breaks).

### 3. Dividends and splits

- [ ] **T4.9** `/AAPL/dividends`: sort `-ex_date` default, `?sort=` ex-date / pay date either way, `?from=&to=` →
  `ex_date.gte|lte`; Type column in words (CD regular cash, …); money with 4 decimals; export; "Create alert"
  (`dividend`) entry.
- [ ] **T4.10** `/AAPL/stock-splits`: rows newest first, ratios readable, empty state only for complete coverage.
- [ ] **T4.11** `/SPY/dividends`: works for an ETF.

### 4. News `/AAPL/news`

- [ ] **T4.12** List: headline, "Published by <issuer>" or "By <publisher>", kind / source badges, published time in the
  viewer's zone. Pager Previous / Page N / Next centred under the table; Next → page 2, Previous → page 1 from cache
  (no new request in the API sheet).
- [ ] **T4.13** Filters kind / topic / source / earnings / Company-published (+ pub type / category / tag) / from / to;
  page-side filters say how many rows they hid; a page with all rows hidden auto-advances (≤ 10 pages) and names the
  skipped pages; changing a filter resets to page 1.
- [ ] **T4.14** `?sort=oldest` works; turning Live on clears it and vice versa.
- [ ] **T4.15** Item panel `?item=`: opens without scrolling the page to the top; header badges, attribution block
  (publisher + host, published, source link, EDGAR form · accession for edgar items, the API's statement, "©" line),
  lede, summary body (headings / paragraphs / lists — no raw HTML tags visible), "Summary by Invinite · N of M words"
  if present, AI-extracted developments with claim status, branded PDF section (View / new tab / Download) when `pdf`
  is set, correction notice from `supersedes_id`. An item without summary → "Headline and link only" + "Open at source".
- [ ] **T4.16** "Filter by call": the company's 20 newest events are requested only on click; picking one sets
  `?event=` and narrows the list.
- [ ] **T4.17** Search box (one search, 10 credits): see T2.21; hit headline opens `?item=`.
- [ ] **T4.18** Live on: connected pill; ≤ 3 min wait for a "New" item (`[~]` if none); off.
- [ ] **T4.19** Announcements tab `?view=announcements`: columns announced, title + summary (model-derived note once
  above the table), topic, claim status (confidence tooltip), effective range with precision, news item link (opens the
  panel); filters `?aTopic=&aFrom=&aTo=&effFrom=&effTo=&aSort=oldest` sent; export.
- [ ] **T4.20** Export = the shown page only (no "load all"). Alert entries `news`, `news_keyword` present.
- [ ] **T4.21** `/SPY/news` → gate sentence (no news dataset for a fund) or, if the dataset exists, no alert entry (ETF
  refuses `news*`).

### 5. Documents `/AAPL/documents`

- [ ] **T4.22** Header counts loaded documents, "+" while pages load; both lists load every page by themselves.
- [ ] **T4.23** Tree: categories in spine order, each open with its newest folder; folder labels ("May 18 · <name>",
  "Q2", "2025", FY…); call rows ("Call" badge, label + date → call page, availability icons, links to Press release /
  Slides / Documents tabs); document rows (kind badge, title, date, size, Open / Open page, "Show text" only with
  `pages_url`, Event link). "Not yet placed" last.
- [ ] **T4.24** Filters Category / Section / Kind / Year in the URL (section / kind hide call rows); text filter `q`
  written 200 ms after typing (replace, not push), every folder holding a match open; clearing restores toggles.
- [ ] **T4.25** "Show text" dialog: per-page text; a file > 2 MB links the public pages JSON instead.
- [ ] **T4.26** Open: `rel="noopener noreferrer"`, opens the permanent public URL (one check, close tab).
- [ ] **T4.27** Document search (calls list toggle or here): Keyword `revenue` → hits name document, year, page, open
  `#page=<n>` on PDFs; lead "Passages from company-published documents, not verified facts."; Exact with a 2-letter
  query → "Exact search needs 3 characters or a company" notice if the API answers 400. (2 searches.)
- [ ] **T4.28** Source chips "Company documents" | "SEC filings" (`?searchIn=sec`): SEC search for the page's ticker;
  a hit opens the citation panel (`?source=&block=`) at the highlighted block. (1 search, 100 credits.)
- [ ] **T4.29** Phone width check deferred to Task 7, but a sideways page scroll seen here is logged now.

## Files to Create / Modify

| File | Action | Purpose |
| --- | --- | --- |
| `tasks/ui-walk-2026-11-22/findings.md` | Modify | Findings |
| this task file | Modify | Ticks, status |
| `src/routes/$ticker/**`, `src/components/sec/**`, `src/lib/news/**`, `src/lib/earnings/documents.ts`, tests | Modify | Dashboard fixes only |

## Acceptance Criteria

- Routes insider-trades, holders, dividends, stock-splits, news, documents visited for AAPL (+ SPY where noted).
- T4.1–T4.29 ticked / `[~]` / logged with outcome; fixes committed with tests; check + test green.
