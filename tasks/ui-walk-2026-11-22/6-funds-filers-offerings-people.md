# Task 6 — Funds, ETN, filers, offerings, people

> **Status: DONE (walked 2026-11-22, 20 findings: F074–F093)**

## Goal

Walk the non-stock instrument types (ETF, class of a multi-class series, trust, closed-end fund, ETN), the filer page
`/sec/$cik` (manager, fund registrant, unknown), the offering detail page and the people detail page.

## Prerequisites

Task 1 (closed-end fund + ETN symbols recorded). Subjects `SPY`, `VOO`, `GLD`, `/sec/1067983`.

## Current Behavior

`src/routes/$ticker/index.tsx` (`FundProfileView`, `InstrumentCard`), `$ticker/holdings/`, `sec/$cik.tsx`
(`sec-filer-views.tsx`), `offerings/$offeringId.tsx`, `people/$personId.tsx`. `CLAUDE.md` → "Instruments and funds",
"SEC document store" (`/sec/$cik`), "Ownership and offerings", "People".

## Desired Behavior

Every check ticked or logged; per page `PageHeader`, API button, no plan gate, console clean.

## Requirements

### 1. ETF `SPY`

- [x] **T6.1** Header badge "ETF"; sidebar context "SPY · ETF" shows Holdings and Holders, no financials / earnings /
  insider items.
- [x] **T6.2** Overview `FundProfileView`: type, structure, issuer / trust → `/sec/$cik`, series, registration, index
  fund, advisers (role, CRD, LEI, affiliated), website (https only), net assets with date + scope, expense ratio,
  shares outstanding, short interest, share classes, composition line (source + as-of), coverage card.
- [x] **T6.3** `/SPY/holdings`: `FundSourceBadge` ("Issuer file · as of D" / "SEC N-PORT filing", never "current"),
  positions largest weight first, "Load more", Notional column only when a row states one, ISIN / sector / country with
  basis tags, `SecurityLink` (ticker → `/$ticker`, else CIK → `/sec/$cik`), as-of picker `?day=` over stored dates.
- [x] **T6.4** Weights block `?dim=sector|country|asset_class`: bars as stated (never scaled), basis in words, weight
  sum line. Export of positions.
- [x] **T6.5** `/SPY/holders`: same tabs as Task 4; works for a fund.
- [x] **T6.6** `/SPY/filings` "Search text": searches the fund's SEC filings (1 search).

### 2. `VOO`, `GLD`, closed-end fund, ETN

- [x] **T6.7** `VOO`: net assets scope "series total, all share classes"; no market cap shown.
- [x] **T6.8** `GLD`: badges "ETF" + "Trust"; overview says no holdings report without requesting positions (API
  sheet); `/GLD/holdings` → gate sentence naming the structure; sidebar has no Holdings.
- [x] **T6.9** Closed-end fund (recorded symbol): badge "Closed-end fund", overview + holdings render.
- [x] **T6.10** ETN (recorded symbol): `InstrumentCard` only (listing); sidebar: profile, dividends, splits, Holders.
- [x] **T6.11** Alert entry on a fund page offers only `NON_STOCK_ALERT_TYPES` (dividend, event_countdown, filing*,
  price types) — no earnings / news / fundamental types.

### 3. Filer `/sec/1067983` (13F manager)

- [x] **T6.12** Header: name, CIK + copy, listing or "No ticker", phase; sidebar context "<name> · Institution" lists
  the page's blocks as anchors (click each: scrolls to the block).
- [x] **T6.13** Lifecycle view (phase, kind, first seen, last observed, registration tracks, pending actions, warnings
  or "No lifecycle evidence"); proposed symbols, successors, former names.
- [x] **T6.14** Filings list (`?form=`, cursor) → documents panel (`?docs=`).
- [x] **T6.15** Portfolio: quarter `?period=`, `DataTable` with export, discretion / voting, `?instruments=all`, the
  quarter's 13F filing link above; "More positions"; `V2MetaLine` (coverage, pinned_at, counting).
- [x] **T6.16** "Position changes" requested only on click (`?changes=true`), chips `?ctypes=`; rows link securities.
- [x] **T6.17** A stock's issuer CIK (AAPL's CIK from its overview): filer page with "Open AAPL" in the sidebar context;
  no portfolio block (not a manager). Fund block / private offerings block appear only when the answer has them.
- [x] **T6.18** A fund registrant (SPY's trust CIK): Fund block (series rows, ETF badge, MIC, class tickers, expense
  ratio, net assets, returns as percent). Asking its holdings as a filer is not offered or shows the API's 404 naming
  `/v1/funds/{fund_key}/holdings`.
- [x] **T6.19** `/sec/9999999999` → 404 `not_covered` notice; `/sec/abc` → invalid / not-found state, no crash.

### 4. Offering detail

- [x] **T6.20** From `/offerings`, open one: amounts (incl. remaining, minimum, commissions / finders' fees),
  investors, issuer + co-issuers → `/sec/$cik`, exemptions with labels, related persons, filings list (latest marked).
  An IPO issuer from `/ipo-calendar` "Details" → `/sec/$cik` lists its Form D offerings when it has any.
  (No co-issuer on the two offerings opened; Anthropic, PBC `/sec/2130357` has no Form D, so no block — the block was
  checked on `/sec/2122354`. F085, F087, F088.)
- [x] **T6.21** A malformed offering id → not-found state.

### 5. Person detail

- [x] **T6.22** From a call's Participants tab, open a person: profile, calls list (newest first once each event is
  in; one `/v1/events/{id}` per loaded call, cached when coming from the call page), role & firm history (undated
  calls left out with a note); sidebar "<name> · Analyst" anchors. A call whose event failed says "Not available".
  (Stacy Rasgon, 15 calls, 15 event reads; no event failed, so "Not available" was not seen.)
- [x] **T6.23** Unknown person id → `PeopleState` "Not found" in the API's words.

## Files to Create / Modify

| File | Action | Purpose |
| --- | --- | --- |
| `tasks/ui-walk-2026-11-22/findings.md` | Modify | Findings |
| this task file | Modify | Ticks, status |
| `src/routes/$ticker/**`, `src/routes/sec/**`, `src/routes/offerings/**`, `src/routes/people/**`, `src/components/sec/**`, tests | Modify | Dashboard fixes only |

## Acceptance Criteria

- Five instrument types, three filer kinds, one offering, one person visited.
- T6.1–T6.23 ticked / `[~]` / logged with outcome; fixes committed with tests; check + test green.
