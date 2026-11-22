# UI walk 2026-11-22 — findings log

Format and rules: [`GUIDE.md`](./GUIDE.md) §5–§7. Append in order of discovery; never renumber.

## Start state (filled by Task 1)

| Item | Value |
| --- | --- |
| Walk branch / base sha | `ui-walk-2026-11-22` from `main` at `2e382ca` |
| `/v1/me` plan | `enterprise` (top bar "Enterprise", key check "Key valid · Enterprise plan") |
| Credits at start | 3,999,939 remaining at key save (61 of 4,000,000 used; resets Dec 22, 2026); 3,999,725 at the end of Task 1 |
| Alerts (count, `has_more`) | 0 (empty list, no `has_more`; quota line "0 of 25,000 alerts in use · 0 of 500 script / indicator alerts · fire cap 500,000 a day") |
| Destinations | 0 |
| Alert users | 0 |
| Scripts | 0 (no `walk-1122` resource anywhere) |
| Subjects confirmed | AAPL, NVDA, MSFT (Stock); SPY, VOO (ETF); GLD (ETF · Trust); `/sec/1067983` Berkshire Hathaway (13F portfolio block shown); `ZZZZQ` = "not known"; `/sec/9999999999` = not covered |
| Live call during walk? | No (2026-11-22 ~11:45 UTC, a Sunday). Next scheduled: date-only conferences on Nov 23 (AYA, SCZM, ULS, CGAU, VIST, SKE); next timed earnings calls TUYA Nov 22 19:30 ET and ZEPP 20:30 ET (Q3 FY2026) |
| Closed-end fund / ETN used | ADX (Adams Diversified Equity Fund, registered fund) / DJP (Barclays ETN, ARCX) |
| End-user defaults (to restore) | Never set: active alerts, script / indicator alerts and fires per day all "No limit" |
| Receiver URL (Task 8) | |
| D1 / D2 ids (Task 8) | |
| Walk alert ids (Tasks 9–10) | |
| End counts (Task 10): alerts / destinations / users / scripts | |
| Credits at end (Task 11) | |

## Findings

<!-- ### F001 — <page>: <one-line defect> -->

### F001 — Onboarding card: a refused key says "your previous key is kept" although none is stored
- Check: T1.5 · Severity: nit · Class: dashboard
- Where: http://localhost:3001/ (onboarding card, no key stored)
- Steps: type `invalid-walk-key` → Save
- Expected: the refusal names no previous key when none exists
- Actual: "This key was refused. Check it in your Data API dashboard; your previous key is kept."
- Evidence: lead's T1.5 run; `keyErrorText` in `src/components/api-key/use-key-validation.ts` always appended it
- Outcome: fixed in 2d82df0 (`keyErrorText(error, hasStoredKey)`, test `key-gate.test.tsx`; re-checked in the top-bar key dialog with a stored key: the sentence is kept there)

### F002 — `GET /v1/filers?phase=manager` returns a filer whose `phase` is `public`
- Check: T1.14 · Severity: minor · Class: api
- Where: http://localhost:3001/institutions?q=berkshire (and the ⌘K search, Institutions pill)
- Steps: search `berkshire` with the Institutions pill / open `/institutions?q=berkshire` → API sheet → answer
- Expected: every row of a `phase=manager` list has `phase: "manager"` (the parameter and the field are both "Lifecycle phase" in the spec)
- Actual: row 3 = `cik 0001067983` BERKSHIRE HATHAWAY INC, `phase: "public"`; the search badges it "Filer" inside the managers block
- Evidence: request `GET /v1/filers?limit=50&phase=manager&q=berkshire`, request id req_01M81GV001NZDDBHSSJ824P0RR
- Outcome: open (Task 11: API → backend tasklist, or by design if `phase=manager` means "files 13F" — then the spec description should say so)

### F003 — A 13F manager without a ticker (`/sec/949012`) gets no 13F portfolio block
- Check: T1.19 · Severity: major · Class: api
- Where: http://localhost:3001/sec/949012 (BERKSHIRE ASSET MANAGEMENT LLC/PA, opened from the search's Institutions group and listed on `/institutions`)
- Steps: open `/sec/949012`
- Expected: the 13F portfolio ("Load the latest quarter"), as on `/sec/1067983`; `/institutions` says "Each opens its filer page with its quarterly 13F portfolio"
- Actual: no phase badge, no 13F portfolio block; Filings = "Unknown · Not known to the SEC store · No instrument is known for 949012 (GET /v1/instruments?q=)". The page shows the portfolio only for `phase === "manager"` or a 13F form in the filings facet (`isManagerFiler`): `/v1/filers/949012` answers `phase: null` (while the `phase=manager` list badges the same CIK "Institution") and `/v1/filings?symbol=949012` answers 404 for an unlisted filer, so neither signal reaches the page
- Evidence: page text; `FilerDetail` has no `forms` field (spec), `listFilers` rows do
- Outcome: open (Task 11: API → backend tasklist — `FilerDetail.phase` should be `manager` for a 13F filer, and / or `/v1/filings` should take an unlisted filer's CIK; no client workaround per GUIDE §7)

### F004 — `/sec/$cik` filings table shows raw ISO dates
- Check: T1.19 · Severity: minor · Class: dashboard
- Where: http://localhost:3001/sec/1067983
- Steps: open the page, look at the Filings table
- Expected: days formatted ("Nov 19, 2026"; CLAUDE.md "No raw ISO date in a cell")
- Actual: Filed `2026-11-19`, Period `2026-11-17`
- Evidence: `SecFilingsView` in `src/components/sec/sec-filer-views.tsx` rendered `filing_date` / `report_date` as they came
- Outcome: fixed in 80a404c (`formatDay`, test `sec-filer.test.tsx`; re-checked in the browser)

### F005 — `/v1/me/usage` daily / family / key rows lag far behind `period.used_credits`
- Check: T1.20 · Severity: minor · Class: api
- Where: http://localhost:3001/account?days=7|30|90
- Steps: open `/account`, switch 7 / 30 / 90 days
- Expected: the windows' credits include today's billed requests (`used_credits` is "live"; the daily rows are "credits billed (2xx responses only)")
- Actual: every window says "88 credits · 91 requests" and the walk key 27 credits / 33 requests, while "Used this period" was 190 (later 275) since the period began today 09:42 CET; the family labels are the old v1 names ("Earnings Calls", "Company", "SEC Filings", "Metadata") while `allowed_families` lists the 7.x families (Instruments, Companies, Events, …)
- Evidence: `/account` page text at ~12:40 CET
- Outcome: open (Task 11: API → backend tasklist; if the rollup lag is by design, the spec should state it)

### F006 — `HEAD /status` and `HEAD /licensing` answer 200 with the app shell instead of the 301
- Check: T1.22 · Severity: minor · Class: dashboard
- Where: `curl -sI http://localhost:3001/status?x=1`, `curl -sI http://localhost:3001/licensing`
- Steps: the check's `curl -sI` (HEAD)
- Expected: 301 → `https://status.data.invinite.com/?x=1` / `https://data.invinite.com/docs/licensing`
- Actual: `HTTP/1.1 200`, `content-type: text/html` (a GET answered the 301 correctly)
- Evidence: the server routes had only a `GET` handler
- Outcome: fixed in 46e3a95 (`HEAD` handler beside `GET`, test `redirect-routes.test.ts`; re-checked with curl: both 301 with the right Location)

### F007 — A failed (non-404) instrument read loops: ~1 `getInstrument` a second, endless skeleton
- Check: T1.23 · Severity: major · Class: dashboard
- Where: http://localhost:3001/this-route-does-not-exist-walk (any `/$ticker` page whose instrument read fails with something other than a 404, e.g. a 503)
- Steps: open the URL, wait, read the network list
- Expected: one request, then the "Failed to load the instrument" error (or the not-known notice, F008)
- Actual: the page stayed a skeleton; the network list showed `getInstrument` server-function calls at ~1 / s (5,700+ buffered after a few minutes). The layout renders the page (`<Outlet />`) under a failed read; the overview's own `useInstrument` mounted, React Query refetched the errored query on mount, the refetch reset it to pending, the layout swapped back to its skeleton (unmounting the overview), the read failed again, … Here the requests failed input validation (no API call, no credits), but a real API error (503) would have hit the API every second
- Evidence: `read_network_requests` (`_serverFn/…getInstrument…` repeated), `performance` entries 5 → 10 → 15 → 21 in 20 s for a 16-character symbol
- Outcome: fixed in 8329554 (`useInstrument` `retryOnMount: false`, test `v2-sec-queries.test.tsx`: a later reader of a failed read sends no request)

### F008 — A `$ticker` segment longer than 15 characters shows a validation failure instead of "not known"
- Check: T1.23 · Severity: minor · Class: dashboard
- Where: http://localhost:3001/this-route-does-not-exist-walk
- Steps: open the URL
- Expected: the "not known" notice (T1.23: a non-existent route is treated as a symbol)
- Actual: the server function's input validation (`symbol` ≤ 15 characters) failed before any API call: a plain error, never the notice (and, before F007, the loop)
- Evidence: `symbolSchema = z.string().trim().min(1).max(15)` in `server-functions.ts`
- Outcome: fixed in 6752d59 (`isSymbolParam` / `SYMBOL_MAX_LENGTH` in `src/lib/instruments.ts`: the hook stays idle, the layout renders "THIS-ROUTE-DOES-NOT-EXIST-WALK is not a known instrument · A symbol has at most 15 characters."; tests `instruments.test.ts`, `ticker-layout.test.tsx`; CLAUDE.md "Navigation from `datasets`" updated; re-checked in the browser: no request)

### F009 — ETN instruments are named after their issuing bank, not the note
- Check: T1.26 · Severity: nit · Class: data
- Where: http://localhost:3001/instruments?type=etn, http://localhost:3001/DJP
- Steps: open the ETNs tab
- Expected: the note's name (e.g. "iPath Bloomberg Commodity Index Total Return ETN" for DJP)
- Actual: `name` = the issuer ("BARCLAYS BANK PLC", "BANK OF MONTREAL /CAN/", "UBS AG") on every ETN row and in the `/DJP` header, so dozens of rows read the same
- Evidence: `/v1/instruments?type=etn` page 1
- Outcome: open (Task 11: data → backend tasklist)

### F010 — `/account`: recharts warns "width(-1) and height(-1) of chart" on every mount
- Check: T1.28 · Severity: minor · Class: dashboard
- Where: http://localhost:3001/account
- Steps: open the page, read the console
- Expected: a clean console
- Actual: two `[warn] The width(-1) and height(-1) of chart should be greater than 0 …` per visit (the `ResponsiveContainer`'s default first size before it measures)
- Evidence: console sweep with markers around the page visits
- Outcome: fixed in 3c43903 (`ChartFrame` passes `initialDimension`, the shared frame of the account chart and both price charts; test `account-page.test.tsx`; re-checked: no warning between the markers)

### F011 — `/calendar`: the day headings (and header) never stick — the table is wider than its column
- Check: T2.1 · Severity: minor · Class: dashboard
- Where: http://localhost:3001/calendar (viewport 1700 px)
- Steps: open the page, scroll into a day group
- Expected: sticky day headings with counts (CLAUDE.md "Global pages")
- Actual: table 1279 px in a 1088 px column (`max-w-6xl`): `DataTable` sticks headings only when the table fits, so they scrolled away at every width; the Call column's meta line ("first-party time (low confidence) · via ir_feed · Asia/Hong_Kong (inferred)") and the Report meta did not wrap (table cells are `whitespace-nowrap`)
- Evidence: column widths Call 356 / Report 215 / Company 236; after the fix the table is 1088 px and every heading sits at `top: 56px`
- Outcome: fixed in f62befd (`CELL_META_CLASS` in `calendar-semantics.tsx`, company cell 180 px; test `calendar-semantics.test.tsx`; re-checked in the browser)

### F012 — `/live-calls`: "Next scheduled calls" puts tomorrow's date-only events before tonight's calls
- Check: T2.5 · Severity: minor · Class: dashboard
- Where: http://localhost:3001/live-calls (no call live, Sun Nov 22)
- Steps: open the page
- Expected: the next calls first (TUYA Nov 22 19:30 ET, ZEPP 20:30 ET)
- Actual: six date-only Nov 23 conferences (AYA, SCZM, ULS, CGAU, VIST, SKE); TUYA / ZEPP missing. `/v1/events?sort=scheduled_at` orders a date-only event by its day's UTC midnight (= 19:00 ET the evening before), and the page took the first 6
- Evidence: page text; `limit: 6` + `sort: scheduled_at` in `live-calls.tsx`
- Outcome: fixed in 6d6c544 (`nextCallsOf`: one 50-row page in New York day order, `groupEventsByNewYorkDay`; test `market-pages.test.tsx`; re-checked: TUYA, ZEPP, then the Nov 23 events)

### F013 — `GET /v1/ipos?sort=listing_date` puts offerings without a listing date first
- Check: T2.6 · Severity: major · Class: api
- Where: http://localhost:3001/ipo-calendar (Upcoming)
- Steps: open Upcoming; then `?from=2026-11-01`
- Expected: by listing date ascending, offerings without one last (the page's description; Postgres' own ASC default is NULLS LAST)
- Actual: the first 50 rows all have `listing_date: null`, A–Z by id (AAGO, AAS, ABDC, …); TRCX (listing Nov 23, 2026) only shows with `?from=` — so the Upcoming tab never shows the next listings on page 1. The spec's `sort` description does not state the null order
- Evidence: `GET /v1/ipos?limit=50&sort=listing_date&stage=…`; with `listing_date.gte=2026-11-01` one row, TRCX Nov 23
- Outcome: open (Task 11: API → backend tasklist — nulls last for `listing_date` ascending, or state the order in the spec; no client re-sort per GUIDE §7)

### F014 — `/v1/ipos`: duplicate rows for one IPO and inconsistent SPAC / share fields
- Check: T2.6 · Severity: minor · Class: data
- Where: http://localhost:3001/ipo-calendar?tab=recent
- Steps: open Recent, open the ANT rows' Details
- Expected: one row per offering
- Actual: Anthropic, PBC (ANT, Nov 19) has 5 rows: one priced XNAS offering (S-1 333-299633, $83.00, 980,000,000 shares) and 4 "Trading" rows with no price / shares / exchange (e.g. S-1 333-300148, first public Nov 19). Also HYAC "Haymaker Acquisition Corp V" shares offered 0 with a $250M size; KACQU "Kartoon Studios Acquisition Corp." ($10.00 units, 30,000,000) carries no SPAC badge (`is_spac` false)
- Evidence: Recent tab rows 1–6, Details dialogs
- Outcome: open (Task 11: data → backend tasklist)

### F015 — IPO Details dialog: the issuer is not linked
- Check: T2.6 · Severity: minor · Class: dashboard
- Where: http://localhost:3001/ipo-calendar?tab=recent → a row's "Details"
- Steps: open Details
- Expected: the issuer links `/sec/$cik` (T2.6)
- Actual: title and facts only, no link (the table row had one)
- Evidence: dialog links `[]`
- Outcome: fixed in 965ce55 (Issuer → `/sec/$cik` and Symbol → `/$ticker` rows in `IpoDetail`; test `market-pages.test.tsx`; re-checked: "Anthropic, PBC → /sec/2130357", "ANT → /ANT")

### F016 — Market holidays: the same holiday named differently across years
- Check: T2.7 · Severity: nit · Class: data
- Where: http://localhost:3001/market-holidays
- Steps: open Upcoming / Past
- Expected: one name per holiday
- Actual: "New Years Day" (2027) vs "New Year's Day" (2026); "Thanksgiving" (2026) vs "Thanksgiving Day" (2027)
- Evidence: page rows
- Outcome: open (Task 11: data → backend tasklist)

### F017 — `/v1/instruments?is_active=false&type=stock` answers no row
- Check: T2.8 · Severity: minor · Class: data
- Where: http://localhost:3001/instruments?active=delisted&type=stock
- Steps: open the Stocks tab with "Delisted"
- Expected: delisted stocks with the "Delisted" badge
- Actual: "No instrument matches these filters."; without `type` the delisted rows are all ETFs (ADBU, ADDS, ADFI, …)
- Evidence: request id req_01M81JF5TW9YJCA1EEH11Q96W4 (`GET /v1/instruments?is_active=false&limit=50`)
- Outcome: open (Task 11: data → backend tasklist, or by design if the universe keeps no delisted stock — then the spec should say so)

### F018 — CLAUDE.md: the Companies tab's fiscal year end is "null on every row today"
- Check: T2.9 · Severity: nit · Class: doc
- Where: http://localhost:3001/instruments?view=companies
- Steps: open the tab
- Expected: CLAUDE.md matches the app
- Actual: the column shows days ("Oct 31", "Dec 31", "Jun 30"): Data API 8.0 serves `fiscal_year_end`
- Evidence: page rows (A, AA, MSFT, MU)
- Outcome: fixed in 4552bb6 (CLAUDE.md "Reference (O7 group 7)")

### F019 — `GET /v1/filers?phase=manager` answered 503 `unavailable` after ~30 s
- Check: T2.11 · Severity: minor · Class: api
- Where: http://localhost:3001/institutions
- Steps: open the page (once); reload
- Expected: the list
- Actual: skeleton for ~30 s, then 503 "The SEC document store is unavailable; retry."; the reload answered in ~4 s
- Evidence: request id req_01M81JJ6MRGVKWX8Q40X3NJNT6
- Outcome: open (Task 11: API → backend tasklist — transient SEC store outage / slow answer)

### F020 — A 503 `unavailable` on an SEC view says "This SEC capability is not switched on yet"
- Check: T2.11 · Severity: minor · Class: dashboard
- Where: http://localhost:3001/institutions (during F019)
- Steps: as F019
- Expected: a state that fits an outage as well as a switched-off capability
- Actual: "Not switched on · This SEC capability is not switched on yet" above the API's "The SEC document store is unavailable; retry."
- Evidence: `READINESS_TEXT.not_ready` in `src/lib/sec/readiness.ts`
- Outcome: fixed in 6f48eef ("Unavailable · Not available right now", the API's detail below says which; tests `sec-source-panel.test.tsx`, `sec-v2-pages.test.tsx`; views with their own words — SEC search's "not switched on yet" — unchanged)

### F021 — `GET /v1/filers?phase=manager` stops after 50 rows (`has_more: false`)
- Check: T2.11 · Severity: major · Class: api
- Where: http://localhost:3001/institutions
- Steps: open the page, look for "Load more"
- Expected: the 13F managers by cursor (CLAUDE.md "`/institutions` (`/v1/filers?phase=manager` by cursor, 1 credit a page)"; the spec: "`phase=pre_ipo|public|former|other` lists the issuer lifecycle and pages by `cursor`; `phase=manager` lists 13F-HR filers")
- Actual: 50 rows (033 ASSET MANAGEMENT … 26North Partners LP), `has_more: false`, `next_cursor: null` — no way past "2…"
- Evidence: `GET /v1/filers?limit=50&phase=manager` answer (API sheet)
- Outcome: open (Task 11: API → backend tasklist — page `phase=manager` by cursor, or state the cap in the spec)

### F022 — Offering amounts read "$50.00 M" instead of the compact money format
- Check: T2.12 · Severity: nit · Class: dashboard
- Where: http://localhost:3001/offerings (and `/sec/$cik` private offerings)
- Steps: open the page
- Expected: "$50M" like every other money cell (`formatMoneyCompact`)
- Actual: "$50.00 M", "$2.73 M" (`formatNumberEnCompact` with a `$`)
- Evidence: `offeringUsd` in `sec-filer-views.tsx`
- Outcome: fixed in 78e9512 (test `sec-filer.test.tsx`; re-checked: "$50M", "$2.73M", "$0")

### F023 — `/offerings?industry=a` shows a raw validation error
- Check: T2.12 · Severity: minor · Class: dashboard
- Where: http://localhost:3001/offerings?industry=a
- Steps: open the URL
- Expected: a 1-character industry reads as none (the field already ignores < 2 characters)
- Actual: "Failed to load the offerings" with the server function's zod issue JSON (`too_small`, minimum 2)
- Evidence: page text; no API request sent
- Outcome: fixed in bc9f425 (`optionalText(80, 2)`; test `url-state.test.ts`; re-checked: the list loads, `?industry` dropped)

### F024 — `/v1/people`: one analyst split into four people by transcription variants
- Check: T2.13 · Severity: minor · Class: data
- Where: http://localhost:3001/people?q=chatterjee&role=analyst&sort=name
- Steps: open the URL
- Expected: one person for the JP Morgan analyst
- Actual: "Samak Chatterjee" (JPMorgan Chase, 2 calls), "Sameek Chatterjee" (JP Morgan, 5), "Samik Chatterjee" (JP Morgan, 22), "Somig Chatterjee" (JP Morgan, 1 — the AAPL Q4 FY2026 call)
- Evidence: `GET /v1/people?limit=50&q=chatterjee&role=analyst&sort=name`
- Outcome: open (Task 11: data → backend tasklist — person resolution across spelling variants)

### F025 — `/v1/catalog/metrics`: 307 of 342 metrics have no description
- Check: T2.14 · Severity: minor · Class: data
- Where: http://localhost:3001/catalog
- Steps: open Metrics, count the Description column
- Expected: a description per metric ("what each standardized metric means")
- Actual: 35 of 342 rows have one; the rest show "—"
- Evidence: page rows
- Outcome: open (Task 11: data → backend tasklist)

### F026 — API sheet lists the closed catalog tabs' requests
- Check: T2.14 · Severity: nit · Class: dashboard
- Where: http://localhost:3001/catalog → switch tabs → API
- Steps: open Metrics, then Sections … Mapping rules, open the API sheet
- Expected: the open tab's requests ("only the open tab requests (API sheet)")
- Actual: every tab visited so far listed (the hooks stay mounted with `enabled: false`; the sheet took any mounted observer). No extra request was sent — a fresh `?tab=forms` load listed only forms
- Evidence: sheet text after five tab switches
- Outcome: fixed in 7e5f2cd (`viewRequestsOf` uses `query.isActive()`; test `api-inspector.test.tsx`; CLAUDE.md O6 updated; re-checked: Metrics → Forms lists only forms)

### F027 — News: `?earnings=true` is dropped; the select writes `?earnings=%22true%22`
- Check: T2.18 · Severity: minor · Class: dashboard
- Where: http://localhost:3001/news-feed?earnings=true (and `/$ticker/news`)
- Steps: open the URL; pick "Earnings news only"
- Expected: the filter applies from a typed / linked URL
- Actual: the router parses `true` as a boolean, the schema `z.enum(["true","false"])` refused it → filter off and the param removed; the select's string is written JSON-quoted to round-trip
- Evidence: URL after picking; `validateNewsSearch`
- Outcome: fixed in 6ede6b4 (the schema accepts the boolean; test `labels.test.ts`; re-checked: `?earnings=true` → "Earnings news only", 49 of 50 hidden; the written form stays `%22true%22` — the router's round-trip rule)

### F028 — SEC filing search: raw ISO days in hits and the matches note; a visible relevance score
- Check: T2.23 · Severity: minor · Class: dashboard
- Where: http://localhost:3001/filings?paused=true&filedFrom=2026-01-01&searchForm=10-K ("Search every filer")
- Steps: search `going concern`
- Expected: days formatted ("No raw ISO date in a cell"); no visible score (O7 group 5: relevance in the match badge's tooltip)
- Actual: "10-K · 2026-09-17 · feam-20260630.htm" with "0.4787" beside it; "Filed 2026-02-25 to 2026-11-20."
- Evidence: page text
- Outcome: fixed in a3bb4d1 (`formatDay` in `SecHitCard` / `matchesText`, relevance in the badge title; test `sec-search.test.tsx`; re-checked: "10-Q · Nov 16, 2026 · …", "Filed Nov 16, 2026 to Nov 18, 2026.", tooltip "How the passage matched · relevance 0.4257")

### F029 — `/v1/datasets`: no forms for six data sets
- Check: T2.24 · Severity: minor · Class: data
- Where: http://localhost:3001/sec/datasets
- Steps: open the page
- Expected: the forms each data set covers
- Actual: "—" for f345 (Forms 3/4/5), formd (Form D), icsc, ncen (N-CEN), nport (N-PORT), rr; only f13 and fsn list forms
- Evidence: page rows
- Outcome: open (Task 11: data → backend tasklist)

### F030 — News search cost line names "the page's date window" in the market scope (which has none)
- Check: T2.20 · Severity: nit · Class: dashboard
- Where: http://localhost:3001/news-feed?scope=market
- Steps: open the market scope
- Expected: no day-window wording without day inputs
- Actual: "10 credits per page · the page's date window applies"
- Evidence: `NewsSearchBox` cost note
- Outcome: fixed in 20a0d06 (`newsSearchCostText`: the window only when `from` / `to` is set; test `news-search.test.tsx`; re-checked: "10 credits per page")

### F031 — `/aapl`: the alert entry points use the URL's lowercase symbol
- Check: T3.1 · Severity: minor · Class: dashboard
- Where: http://localhost:3001/aapl
- Steps: open the overview with a lowercase symbol
- Expected: the canonical `AAPL` everywhere the page names the instrument (the header's `h1` is `AAPL`)
- Actual: "No alert on aapl" → `/alerts?symbol=aapl`; "Create alert" items → `/alerts/new?symbol=aapl&type=…`; the count asks `listAlerts?symbol=aapl`
- Evidence: link hrefs on the page; `AlertEntryPoints` takes the route param as is
- Outcome: fixed in 7ff817a (`AlertEntryPoints` uses the answer's `symbol`; test `alert-entry-points.test.tsx`; re-checked on `/aapl`: "No alert on AAPL" → `/alerts?symbol=AAPL`)

### F032 — Stock / fund overview has no `PageHeader` and no "API" button
- Check: T3.4 · Severity: minor · Class: dashboard
- Where: http://localhost:3001/AAPL
- Steps: open the overview, look for the page title and the API button
- Expected: every page renders `PageHeader` ending in the API button (CLAUDE.md "Page shell": "Every page renders it")
- Actual: no `h2` title, no API button; only the alert entry row above the cards
- Evidence: `find "API"` → only the key button / "API status"; `$ticker/index.tsx` `TickerOverview` renders no `PageHeader`
- Outcome: fixed in 691443a (`PageHeader` "Overview" with the alert entry points as actions and the API button; test `fund-overview.test.tsx`; CLAUDE.md entry points line; re-checked)

### F033 — Standardized income statement: "Operating Costs And Expenses" equals R&D for AAPL
- Check: T3.7 · Severity: minor · Class: data
- Where: http://localhost:3001/AAPL/financials?view=standardized (presentation, quarterly)
- Steps: read the Operating Expenses subtree
- Expected: `is_operating_costs_and_expenses` is a total of operating costs (AAPL files no such line; it should be absent or the 19.08 B total), not one of its parts
- Actual: Operating Expenses 19.08 B → "Operating Costs And Expenses" 11.73 B (= its only child Research And Development 11.73 B) beside SG&A 7.35 B, every quarter
- Evidence: Q3 2026 column; the filed statement (10-Q 0000320193-26-000020, block b00040) has R&D 11,729 + SG&A 7,346 = Total operating expenses 19,075, no "operating costs" line
- Outcome: open (Task 11: data → backend tasklist)

### F034 — Balance-sheet columns name a source filing that holds no balance sheet for that year
- Check: T3.7 · Severity: minor · Class: api
- Where: http://localhost:3001/AAPL/financials?view=standardized&period=annual&statement=balance-sheet
- Steps: hover the column headers (tooltip = the period's `source`)
- Expected: the filing the balance-sheet values come from (a 10-K states two balance-sheet dates)
- Actual: FY2026, FY2025, FY2024 and FY2023 all "10-K filed 2026-11-03 · 0000320193-26-000026"; FY2022 the 10-K filed 2025-10-31 — the source follows the income statement's three-year span, so FY2023's / FY2024's balance sheet names a filing that does not contain it
- Evidence: `/v1/financials/standardized/presentation?company=AAPL&statement=balance-sheet&period=annual` rows' `source.accession`
- Outcome: open (Task 11: API → backend tasklist — `source` per statement, or say in the spec that it is the period's newest filing)

### F035 — Statement column tooltips show a raw ISO day that can differ from the "From filing" picker's day
- Check: T3.10 · Severity: nit · Class: dashboard
- Where: http://localhost:3001/AAPL/financials?view=standardized&asOf=2024-11-22
- Steps: hover a column header, open "From filing"
- Expected: one formatted day per filing (CLAUDE.md "No raw ISO date")
- Actual: tooltip "10-Q filed 2024-08-01 · 0000320193-24-000081" (UTC slice of `filed_at`), picker "10-Q · Aug 2, 2024" (`formatDay` in the viewer's zone)
- Evidence: `filingSourceText` in `src/lib/financials/statements.ts` slices `filed_at`
- Outcome: fixed in 9428080 (`filingSourceText` uses `formatDay`; test `financials-v2-pages.test.tsx`; re-checked: "10-K filed Nov 3, 2026 · …")

### F036 — "Explain this number": a derived fact's operands read "Operand —", its source value "—", the formula raw fact ids
- Check: T3.12 · Severity: major · Class: dashboard
- Where: http://localhost:3001/AAPL/financials?view=standardized&layout=detailed → Total Revenue, Q4 2026
- Steps: click the value 114.48 B
- Expected: the four operands (FY total and Q1–Q3) with their values, the source fact's value, a readable formula
- Actual: Operands "Operand —" ×4; Source facts Value "—"; Formula `320193|RevenueFromContractWithCustomerExcludingAssessedTax|2025-09-28T00:00:00|2026-09-26T00:00:00|-|- - 320193|…`; a reported fact's source period reads "2026-03-29 – 2026-06-27" (raw ISO)
- Evidence: the answer's operands are `{ id, type, weighted_value, stored_value, … }` and the source fact's value sits in `derived.value`; `operandModel` / `sourceModel` in `src/lib/financials/fact-explanation.ts` read only `metric_id` / `concept` / `label` / `value`
- Outcome: fixed in ed8a636 (`operandModel` reads `id` / `weighted_value` / `stored_value`, `sourceModel` `derived.value`, `readableFormula` / `factIdText`, periods via `formatDay`; test `financials-v2-pages.test.tsx`; CLAUDE.md financials line; re-checked: four operands with values, source 114,477,000,000, formula in words)

### F037 — As-reported Presentation (quarterly) renders no rows when the newest quarter is a 10-K quarter
- Check: T3.13 · Severity: major · Class: dashboard
- Where: http://localhost:3001/AAPL/financials?view=as-reported
- Steps: open As reported (default layout presentation, quarterly)
- Expected: the filed tree (Net sales, Cost of sales, …) with a value per quarter
- Actual: the header row Q4 2026 … Q1 2025, no body row, only "Load more"
- Evidence: the page's answer has 8 rows; Q4 2026 and Q4 2025 carry `statements.income_statement.facts: []` (no filed Q4), the other six the full tree; `FinancialsPresentationTable` builds the tree from `typedPeriods[0]` only
- Outcome: fixed in d10a351 (the tree of the newest period that states one; test `financials-v2-pages.test.tsx`; re-checked: 18 rows, Q4 columns "—")

### F038 — Filings: raw ISO days in the facet line, the Fiscal Period fallback and the documents panel header
- Check: T3.20 · Severity: minor · Class: dashboard
- Where: http://localhost:3001/AAPL/filings (and `?docs=`, `/filings/$accession` Documents)
- Steps: open the list; open a row's Documents
- Expected: formatted days (CLAUDE.md "No raw ISO date in a cell")
- Actual: header "Newest filing 2026-11-19" / "31 10-K filings, newest filed 2026-11-03"; Fiscal Period of a Form 4 / 8-K = "2026-11-17" (the `report_date` when no fiscal period matches); panel header "Filed 2026-11-03 · Period 2026-09-26"
- Evidence: `facetSummary` (`src/lib/sec/parity.ts`), `filing-columns.tsx` fallback, `V2FilingDocumentsView` (`sec-source-panel.tsx`)
- Outcome: fixed in 170d9a0 (`facetSummary`, the Fiscal Period fallback and `V2FilingDocumentsView` use `formatDay`; tests `filings-page.test.tsx`, `sec-source-panel.test.tsx`; re-checked: "1366 4 filings, newest filed Nov 19, 2026", "Filed Nov 3, 2026 · Period Sep 26, 2026")

### F039 — A numeric-looking text param is dropped: `?form=144`, `?form=4`
- Check: T3.20 · Severity: minor · Class: dashboard
- Where: http://localhost:3001/AAPL/filings?form=144
- Steps: open the link (a shared or typed URL)
- Expected: the 144 filings
- Actual: the URL is rewritten to `/AAPL/filings`, every form shown — the router reads `144` as a number and `optionalText` (`src/lib/url-state.ts`) takes strings only (the class of F027); every route with an `optionalText` param is affected (`?company=320193` on `/people`, `/search`, a numeric `?q=`)
- Evidence: URL after load; the picker itself writes `?form=%224%22` and works
- Outcome: fixed in e7b4cbd (`optionalText` preprocesses a finite number to its text; test `url-state.test.ts`; CLAUDE.md URL state rule; re-checked: `?form=4` lists the 1366 Form 4 filings)

### F040 — "HTML" on a Form 4 frames its XML primary document as one run-on line
- Check: T3.21 · Severity: minor · Class: dashboard
- Where: http://localhost:3001/AAPL/filings?filing=0001140361-26-044952
- Steps: a Form 4 row → HTML
- Expected: an HTML view, or a plain statement that the filing has no HTML document (with the original and the documents reader)
- Actual: "HTML preview" frames `…/form4.xml`: "X0609 4 2026-11-17 0000320193 Apple Inc. AAPL 0001780525 Newstead Jennifer false …" (the XML's text without markup)
- Evidence: the documents list of the filing has `form4.xml` only ("No readable version"); `FilingHtmlBody` frames any primary URL
- Outcome: fixed in 766896c (`isHtmlDocumentUrl`: a non-`.htm` primary is not framed — "No HTML document: the primary document is form4.xml." + Open the original + reader; test `filings-page.test.tsx`; CLAUDE.md parity line; re-checked)

### F041 — AAPL FY2026 10-K: generic section outline and filing facts still "pending" 19 days after filing
- Check: T3.28 / T3.29 · Severity: minor · Class: api
- Where: http://localhost:3001/filings/0000320193-26-000026?panel=sections&version=8be0b759-1a9d-5f89-8308-bd86185f5e1f · `?tab=facts`
- Steps: Documents → Sections (Headings); Facts tab
- Expected: the outline and the facts of a 10-K filed Nov 3, 2026 (its standardized financials, fact places and legacy outline are served)
- Actual: Headings "Pending · Being prepared"; Facts "Pending · Complete through Oct 31, 2026"; `?outline=legacy` answers the full outline (Items 1–16)
- Evidence: `/v1/document-versions/8be0b759-…/sections`, `/v1/filings/0000320193-26-000026/facts` `meta.coverage`
- Outcome: open (Task 11: API → backend tasklist; the facts data set release lag, or by design — then the spec should name the cadence)

### F042 — Legacy section outline reads "Part I · Item Item 1."
- Check: T3.28 · Severity: nit · Class: dashboard
- Where: http://localhost:3001/filings/0000320193-26-000026?panel=sections&outline=legacy&version=…
- Steps: open the legacy outline
- Expected: "Part I · Item 1."
- Actual: "Part I · Item Item 1." — the column prefixes "Item " to an `item_id` that already reads "Item 1."
- Evidence: `DocumentSectionsView` in `src/routes/filings/-components/filing-detail-views.tsx`
- Outcome: fixed in d1dcb13 (`itemText`; test `filing-detail.test.tsx`; re-checked: "Part I · Item 1.")

### F043 — Filing facts / notes: calendar-month periods instead of the filed contexts, duplicate rows, apostrophes dropped
- Check: T3.29 · Severity: major · Class: data
- Where: http://localhost:3001/filings/0000320193-26-000020?tab=facts&tag=AccountsPayableCurrent,NetIncomeLoss (AAPL 10-Q for Jun 27, 2026)
- Steps: open Facts / Notes
- Expected: the contexts as filed (instants Sep 27, 2025 / Jun 27, 2026; durations Mar 29 – Jun 27, 2026), one row per fact
- Actual: `instant: "2025-09-30"`, "Apr 1, 2025 – Jun 30, 2025", "Oct 1, 2024 – Jun 30, 2025"; NetIncomeLoss 23,434,000,000 for the same period and dimensions listed three times (four for 84,544,000,000); notes read "Period end Jun 30, 2026" and "the Companys condensed consolidated …" (the ’ is lost)
- Evidence: raw answer of `/v1/filings/0000320193-26-000020/facts` (`{"tag":"AccountsPayableCurrent","value":69860000000,…,"instant":"2025-09-30"}`); the filed statement (block b00040) says "June 27, 2026" / "September 27, 2025"
- Outcome: open (Task 11: data → backend tasklist)

### F044 — `/filings/123` shows a raw validation error instead of a not-found state
- Check: T3.33 · Severity: minor · Class: dashboard
- Where: http://localhost:3001/filings/123
- Steps: open a malformed accession
- Expected: a not-found / "not an accession number" state (a well-formed unknown one already reads "Not known to the SEC store")
- Actual: "Error · Failed to load the filing" + the zod issue JSON (`invalid_format`, pattern …)
- Evidence: `FilingPage` asks `useV2Filing(accession)` unchecked; the server function's `accessionSchema` refuses it (the class of F008)
- Outcome: fixed in 40d4400 (`isAccessionParam` in `src/lib/sec/source.ts`: no request, Notice "123 is not an accession number"; test `source.test.ts`; CLAUDE.md filings line; re-checked)

### F045 — Insider trades: a swapped filed / traded day range is sent as is (empty answer)
- Check: T4.2 · Severity: minor · Class: dashboard
- Where: http://localhost:3001/AAPL/insider-trades?side=sell&from=2026-11-01&to=2026-10-01&tfrom=2026-11-20&tto=2026-11-01&sort=oldest
- Steps: open a URL whose `from` > `to` (typed or shared)
- Expected: the range put in order, as dividends do (task T4.2 "a swapped range ordered")
- Actual: `GET /v1/insider-trades?…&filed_at.gte=2026-11-01&filed_at.lte=2026-10-01&…&transaction_date.gte=2026-11-20&transaction_date.lte=2026-11-01` → "No insider trades for these filters."
- Evidence: API sheet; the page passed `search.from` / `to` / `tfrom` / `tto` straight to the hook
- Outcome: fixed in 380d946 (pure `insiderTradesRequest` orders each range; test `sec-v2-pages.test.tsx`; re-checked: `filed_at.gte=2026-10-01&filed_at.lte=2026-11-01`, `transaction_date.gte=2026-11-01&…lte=2026-11-20`)

### F046 — Insider trade footnotes keep the data set's CSV quoting (`"Each … (""RSU"") …"`)
- Check: T4.3 · Severity: minor · Class: data
- Where: http://localhost:3001/AAPL/insider-trades?trade=<id of Khan Sabih's RSU line, accession 0001140361-26-038028>
- Steps: Details on a Form 3/4/5 data set line with footnotes
- Expected: the footnote text as filed: `Each restricted stock unit ("RSU") represents …`
- Actual: `F1 "Each restricted stock unit (""RSU"") represents the right to receive, at settlement, one share of common stock."` — wrapping quotes and doubled inner quotes (F3 the same: `The ""target"" number …`); unquoted footnotes (F2) are fine
- Evidence: `/v1/insider-trades/{id}` `footnotes[].text` (source "SEC Form 3/4/5 data set")
- Outcome: open (Task 11: data → backend tasklist — unescape the data set's TSV/CSV quoting at ingest)

### F047 — Holders: section reasons read as codes ("coverage partial", "upstream unavailable")
- Check: T4.4 · Severity: nit · Class: dashboard
- Where: http://localhost:3001/AAPL/holders (overview; also the 13F tab's reason line)
- Steps: open the overview
- Expected: each source's reason in words (CLAUDE.md "every contract enum labelled")
- Actual: 13F block "coverage partial", N-PORT block "upstream unavailable" — the codes with spaces (`holderReasonText` knew four other reasons only; the spec types the reason as text)
- Evidence: `meta.sections[]` `{source: "13f", state: "partial", reason: "coverage_partial"}`, `{source: "nport", state: "unavailable", reason: "upstream_unavailable"}` (req_01M81QFHJV6N4K2TCMKX56BD4G)
- Outcome: fixed in adbf1bc (`HOLDER_REASON_TEXT` adds both; test `fund.test.ts`; re-checked: "Not every report of this source is loaded yet, so the list may be incomplete.")

### F048 — 13F holder rows: `investment_discretion` is null on every row
- Check: T4.5 · Severity: minor · Class: data
- Where: http://localhost:3001/AAPL/holders?tab=13f (98 rows; also `?period=2026-06-30&instruments=all`, 100 rows)
- Steps: read the Discretion column
- Expected: SOLE / DFND / OTR from each 13F information table (a required field of the form)
- Actual: "—" on every row; the answer's `investment_discretion: null` (voting authority is filled); the spec's own example row is null too
- Evidence: `/v1/holders?limit=25&symbol=AAPL` data[0] (BlackRock, accession 0002012383-26-003985) `investment_discretion: null`
- Outcome: open (Task 11: data → backend tasklist)

### F049 — 13F values of some managers are 1,000× too small (reported in thousands)
- Check: T4.5 / T4.7 · Severity: major · Class: data
- Where: http://localhost:3001/AAPL/holders?tab=13f · `?tab=changes`
- Steps: compare Shares × the ~$333 AAPL price with Value
- Expected: value in USD (BlackRock 1,157,077,341 sh = $385,329,896,040 is right)
- Actual: SUN LIFE FINANCIAL 91,362 sh = $30,425; COHEN & STEERS 11,500 sh = $3,830; PEAPACK GLADSTONE 1,274,764 sh = $424,523 (changes tab, value change $41,381) — the filer's thousands are stored as dollars, so totals, ranks and changes mix units
- Evidence: rows of `/v1/holders?source=13f&symbol=AAPL` and `/v1/holder-changes?symbol=AAPL` (Sep 30, 2026 quarter)
- Outcome: open (Task 11: data → backend tasklist — normalise pre-/mis-reported thousands at ingest)

### F050 — News page description says "Texts are the publishers' own words"
- Check: T4.12 · Severity: minor · Class: dashboard
- Where: http://localhost:3001/AAPL/news (and `/news-feed`, same view)
- Steps: read the page description
- Expected: the item text is Invinite's summary, never the publisher's text (CLAUDE.md "News page": API 2.0.0; the panel's own notice says so)
- Actual: "Texts are the publishers' own words, shown with their source and date; …"
- Evidence: `NewsPageView` default description in `src/routes/$ticker/news/index.tsx`
- Outcome: fixed in 42bc8eb ("Each item is Invinite's summary of the publication, shown with its source and date; …"; test `news-page.test.tsx`; re-checked)

### F051 — News attribution: "© Apple Inc.." (double period)
- Check: T4.15 · Severity: nit · Class: dashboard
- Where: http://localhost:3001/AAPL/news?item=0436683c-9294-4be0-954c-6c9df2c50c73
- Steps: open an Apple newsroom item, read the Notice line
- Expected: "© Apple Inc."
- Actual: "© Apple Inc.." — `AttributionBlock` appends "." to a publisher name that ends in one
- Evidence: `news-item-panel.tsx` notice line
- Outcome: fixed in 34322fe (one trailing period; test `news-page.test.tsx`; re-checked "© Apple Inc.")

### F052 — `/v1/holders?source=nport` answered 503 `unavailable` for several minutes
- Check: T4.6 · Severity: minor · Class: api
- Where: http://localhost:3001/AAPL/holders?tab=nport (and NVDA), overview N-PORT block "Unavailable · upstream unavailable"
- Steps: open the N-PORT tab at ~14:36 CET
- Expected: the N-PORT holders (they came back ~20 min later: "Complete · as of Jul 31, 2026 · 25 shown of 2,343")
- Actual: "503 unavailable: The SEC document store is unavailable; retry." for AAPL and NVDA
- Evidence: `GET /v1/holders?limit=100&source=nport&symbol=AAPL` req_01M81QK5JV3M61VR2ASANW873A; the page rendered the notice correctly
- Outcome: open (Task 11: API → backend tasklist — an outage of the N-PORT source; cf. F019)

### F053 — A news item without a summary still carries "Summary written by Invinite from the publication above"
- Check: T4.15 · Severity: nit · Class: api
- Where: http://localhost:3001/AAPL/news?item=a6e35ab3-d589-4404-8801-fa7b059c6751 ("Apple reports fourth quarter results", 8-K 0000320193-26-000024)
- Steps: open the item
- Expected: a statement that fits a headline-and-link item
- Actual: Notice "Summary written by Invinite from the publication above; not the publisher's text…" right above "Headline and link only · No summary is served for this item" (the dashboard renders the API's `attribution.statement` as sent)
- Evidence: `/v1/news/{id}` `attribution.statement` with `/text` `content_status: no_text`; also: the company's Q4 earnings release has no summary
- Outcome: open (Task 11: API → backend tasklist)

### F054 — `/v1/announcements?company=` answers no row for AAPL, NVDA and MSFT
- Check: T4.19 · Severity: minor · Class: data
- Where: http://localhost:3001/AAPL/news?view=announcements (NVDA, MSFT the same)
- Steps: open the Announcements tab
- Expected: developments read from the companies' news (the tab's purpose; NVDA / MSFT publish many)
- Actual: "No announcements read from this company's news yet." (complete answer, `data: []`); the item panels show no "AI-extracted developments" either
- Evidence: `GET /v1/announcements?company=NVDA&limit=50` req_01M81R2R6W9ZX1AA7VGN0NRFQK; the filters are sent correctly (`announced_at.gte=…T00:00:00.000Z`, `effective_from.gte`, `effective_to.lte`, `sort=announced_at`)
- Outcome: open (Task 11: data → backend tasklist)

### F055 — Documents tree: document and call rows show raw ISO dates
- Check: T4.23 · Severity: minor · Class: dashboard
- Where: http://localhost:3001/AAPL/documents
- Steps: read a row's date
- Expected: "Nov 3, 2026" (CLAUDE.md "No raw ISO date in a cell")
- Actual: "Q4 FY2026 call 2026-11-02", "FY2026 Form 10-K · sec filing · 2026-11-03", "2026 Annual Report · 2026-11-06"
- Evidence: `documentDate` / the call row in `document-tree.tsx` printed `event_date` / `filing_date` / `call.date` as is
- Outcome: fixed in da651e6 (`formatDay`; test `documents-page.test.tsx`; CLAUDE.md documents line; re-checked: "Q4 FY2026 call Nov 2, 2026", "… Nov 3, 2026")

### F056 — Documents: `?kind=sec_filing` is dropped and the Kind filter cannot pick it
- Check: T4.24 · Severity: minor · Class: dashboard
- Where: http://localhost:3001/AAPL/documents?kind=sec_filing
- Steps: open the URL / look for "sec filing" in the Kind select
- Expected: the 87 SEC filing links of the tree ("sec filing" badges), as `/v1/catalog/document-kinds` lists `sec_filing`
- Actual: the URL is rewritten to `/AAPL/documents`, every document shown; the select has no such kind (`COMPANY_DOCUMENT_KINDS` lacked it)
- Evidence: `/catalog?tab=document-kinds` row "Sec filing · sec_filing"
- Outcome: fixed in d76f6af (`sec_filing` added; test `documents.test.ts`; CLAUDE.md documents.ts line; re-checked: 87 documents, no call rows)

### F057 — AAPL "2026 Annual Report" listed three times, one is a prospectus supplement
- Check: T4.23 / T4.27 · Severity: nit · Class: data
- Where: http://localhost:3001/AAPL/documents (Reports · 2026)
- Steps: read the folder; Exact search `iP`
- Expected: one annual report per year, kinds as published
- Actual: three "2026 Annual Report" rows (Nov 6, 2026 151 KB; Nov 5, 2026 628 KB; Jan 22, 2026 276 KB); a hit on "2026 Annual Report · p. 8" reads "…in this prospectus supplement and the accompanying prospectus…"; ESG 2025 "Annual green bond impact report" (21.9 MB) is the Environmental Progress Report covering FY2024
- Evidence: tree rows and the document search hit
- Outcome: open (Task 11: data → backend tasklist)

### F058 — N-PORT holder rows: no filing date; SPY's series named "N/A"
- Check: T4.6 · Severity: minor · Class: data
- Where: http://localhost:3001/AAPL/holders?tab=nport
- Steps: read Filed and Holder
- Expected: the N-PORT filing date (the row has the accession and EDGAR link) and the fund's name
- Actual: Filed "—" on all 100 rows; the SPY row's holder name is "N/A" (tickers SPY, Issuer file Nov 19, 2026)
- Evidence: `/v1/holders?limit=100&source=nport&symbol=AAPL` rows `filing_date: null`
- Outcome: open (Task 11: data → backend tasklist)

### F059 — Events: `started_at` / `ended_at` null on every captured, published call
- Check: T5.1 · Severity: minor · Class: data
- Where: http://localhost:3001/NVDA/earnings-calls?tab=past (and the call page's Metrics "Press release → call")
- Steps: open the Past tab; read Started / Ended
- Expected: the capture's start / end instants for a call with `capture_status: published`, `has_audio: true`
- Actual: "—" / "—" on all 39 past rows; Metrics & diff "Press release → call —"
- Evidence: `GET /v1/events/22056489-ca4b-4e8e-9d6b-03678d13d178?expand=calendar,observations` req_01M81RW4NYYXTP0HCQTP5ZP11C (`started_at: null`, `ended_at: null`, `capture_status: "published"`); same on `cce56779-…` (Q4 FY2026) in `/v1/events?company=NVDA&fiscal_year=2026` req_01M81RT7XNGKE2J9DWYKBNK72W
- Outcome: open (Task 11: data → backend tasklist)

### F060 — Calls list: the Upcoming tab offers "Load more" that can only add past calls
- Check: T5.1 · Severity: nit · Class: dashboard
- Where: http://localhost:3001/NVDA/earnings-calls (Upcoming, 1 row)
- Steps: open the list; look under the Upcoming table
- Expected: no "Load more" once a past call is loaded (the newest-first list's next pages hold only older calls; the tab count already reads "1", not "1+")
- Actual: "Load more · 1 loaded" under the one upcoming row
- Evidence: `DataTable hasNextPage={hasNextPage}` for both tabs in `$ticker/earnings-calls/index.tsx`
- Outcome: fixed in 7a0643f (`tabHasMore`; test `overview-and-calls.test.tsx`; re-checked: no button on Upcoming, Past keeps it)

### F061 — Slides: a deck the PDF viewer cannot load shows a bare "Failed to fetch" in an empty 75vh frame
- Check: T5.21 · Severity: minor · Class: dashboard
- Where: http://localhost:3001/NVDA/earnings-calls/22056489-ca4b-4e8e-9d6b-03678d13d178?tab=slides
- Steps: open the Slides tab
- Expected: the deck, or a reason and a way to the file
- Actual: red "Failed to fetch" at the top of an empty 75vh box. Cause here: `storage.invinite.com` sends `Access-Control-Allow-Origin` only for listed origins (`https://data.invinite.com`, `https://dashboard.data.invinite.com` — checked with curl), not `http://localhost:3001`, so pdf.js's fetch fails on localhost (environment, not prod); the viewer had no fallback for any load error
- Evidence: console "Access to fetch at 'https://storage.invinite.com/…/q3-fy2027-earnings-presentation.pdf' from origin 'http://localhost:3001' has been blocked by CORS policy"
- Outcome: fixed in 7f6e9b0 (`PdfViewerError`: "The PDF cannot be shown here (Failed to fetch)." + "Open the PDF in a new tab"; test `pdf-document-section.test.tsx`; re-checked)

### F062 — Call page: source codes shown raw (edgar, ir_feed, confirmed_domain, sec, q4_reports)
- Check: T5.4 / T5.21 / T5.23 / T5.24 · Severity: nit · Class: dashboard
- Where: http://localhost:3001/NVDA/earnings-calls/cce56779-a8d5-43d5-9287-39d79b1e3d42 (header, Press release, Slides, Documents)
- Steps: read the call-time provenance, the press release badges, the deck badges, the documents' Trust column
- Expected: words (the contract describes each code)
- Actual: "ir_feed · low confidence", "edgar · high confidence", badges "edgar" / "sec", "q4_reports" / "confirmed_domain", Trust "confirmed_domain"
- Evidence: `call-header.tsx` `callTimeProvenance`, `press-release-tab.tsx`, `slides-tab.tsx`, `documents-tab.tsx` printed the fields as is
- Outcome: fixed in e9be3bb (`trustTierLabel`, `callTimeSourceLabel`, `pressReleaseOriginLabel`, `originCodeLabel` in `labels.ts`; tests `labels.test.ts`, `press-release-tab.test.tsx`, `earnings-o7.test.tsx`; CLAUDE.md labels line; re-checked: "Company IR feed · low confidence", "8-K exhibit", "SEC filing", "Company domain")

### F063 — Guidance / KPI history money reads "$25.00 B", axis "$50.00 B"
- Check: T5.18 · Severity: nit · Class: dashboard
- Where: http://localhost:3001/NVDA/earnings-calls/22056489-ca4b-4e8e-9d6b-03678d13d178?tab=guidance (Physical AI revenue; KPI history of "Segment: data center")
- Steps: read the range column and the history chart's y axis
- Expected: "$25B" like every other money cell (`formatMoneyCompact`, cf. F022)
- Actual: "$25.00 B / mid $25.00 B", axis "$0 · $50.00 B · $100.00 B …"
- Evidence: `formatGuidanceValue` built `$` + `formatNumberEnCompact`
- Outcome: fixed in 48ebf88 (`usd` → `formatMoneyCompact`; test `labels.test.ts`; re-checked: "$25B / mid $25B")

### F064 — KPI table: raw unit code after the stated value; "Segment growth:edge computing"
- Check: T5.18 · Severity: nit · Class: dashboard
- Where: http://localhost:3001/NVDA/earnings-calls/22056489-ca4b-4e8e-9d6b-03678d13d178?tab=guidance → KPIs
- Steps: read Value and Metric
- Expected: "$8.2 billion", "42%"; "Segment growth: edge computing"
- Actual: "$8.2 billion usd", "42% pct"; badge "Segment growth:edge computing"
- Evidence: `kpi-table.tsx` appended `kpi.unit`; `metricLabel` only knew the `segment:` prefix
- Outcome: fixed in ee77550 (`kpiUnitSuffix`, `<metric>:<slug>` in `metricLabel`; test `labels.test.ts`; re-checked)

### F065 — KPIs: press-release mentions carry a fiscal period one year ahead; filing links on the wrong origin
- Check: T5.18 · Severity: major · Class: data
- Where: http://localhost:3001/NVDA/earnings-calls/22056489-ca4b-4e8e-9d6b-03678d13d178?tab=guidance → KPIs → "Segment: data center" history
- Steps: read Period of the press-release rows; read Filing
- Expected: the Q3 FY2027 call's press release states Q3 FY2027 figures
- Actual: every press-release mention is one fiscal year ahead: Nov 17, 2026 call "Q3 FY2028 $107.6 billion", Aug 26 "Q2 FY2028", May 20 "Q1 FY2028", Feb 25 "Q4 FY2027", Nov 19, 2025 "Q3 FY2027" (the transcript mentions of the same calls are right). Press-release rows have Filing "—" while transcript rows link the 8-K press release (`q3fy26pr.htm`). Only 6 KPIs on the Q3 FY2027 call, all from the press release
- Evidence: `GET /v1/kpis?event=22056489-…` and the KPI history `GET /v1/kpis?company=NVDA&metric=…` (13 mentions on 5 calls)
- Outcome: open (Task 11: data → backend tasklist)

### F066 — Price moves: utterances read "Speaker spk00" instead of the speaker's name
- Check: T5.22 · Severity: minor · Class: dashboard
- Where: http://localhost:3001/AAPL/earnings-calls/2463cda2-9968-411d-886c-e638d71f34b3?tab=price-moves
- Steps: read "Largest minute moves" and the bucket table
- Expected: the speaker named as everywhere else on the call page (the contract's `utterance_refs` carry only `speaker_label`; `/v1/participants?event=` maps labels to names)
- Actual: "Speaker spk00", "Speaker spk02", "Speaker spk05"
- Evidence: `UtteranceRefs` printed `Speaker ${speaker_label}`
- Outcome: fixed in 7a15b24 (`speakerNamesOf` / `utteranceSpeaker`; participants asked only once there are buckets, the Transcript tab's cached query; test `price-attribution-tab.test.tsx`; CLAUDE.md price-moves line; re-checked: "John Ternus", "Erik Woodring")

### F067 — Call page: the tab bar scrolls sideways inside its box; "Price moves" hidden behind the API button
- Check: T5.6 · Severity: minor · Class: dashboard
- Where: http://localhost:3001/NVDA/earnings-calls/22056489-ca4b-4e8e-9d6b-03678d13d178 (1084 px viewport)
- Steps: look at the tab bar's right end
- Expected: every tab visible / reachable
- Actual: the list (801 px) scrolls in a 703 px `overflow-x-auto` box with no visible scrollbar; "Price moves" sits under the API button, reachable only by a sideways wheel or arrow keys
- Evidence: `call-tabs.tsx` wrapper `min-w-0 grow overflow-x-auto`
- Outcome: fixed in 2030e93 (the list wraps like the Holders tabs, triggers keep their width; test `no-transcript-notice.test.tsx`; re-checked: Prosody / Price moves on a second row)

### F068 — Call Documents tab: the Filings table shows a raw ISO filed day
- Check: T5.23 · Severity: minor · Class: dashboard
- Where: http://localhost:3001/NVDA/earnings-calls/cce56779-a8d5-43d5-9287-39d79b1e3d42?tab=documents
- Steps: read Filings → Filed
- Expected: "Feb 25, 2026" (CLAUDE.md "No raw ISO date in a cell"; cf. F055)
- Actual: "2026-02-25"
- Evidence: `FilingsTable` printed `doc.filing_date`
- Outcome: fixed in ca69d0d (`formatDay`; test `documents-tab.test.tsx`; re-checked)

### F069 — Published NVDA transcripts: CEO / IR unnamed ("Unknown speaker 1/2"), analyst names misspelled
- Check: T5.3 / T5.13 · Severity: minor · Class: data
- Where: http://localhost:3001/NVDA/earnings-calls/cce56779-a8d5-43d5-9287-39d79b1e3d42 (Q4 FY2026); calls-list search hits on Q3 FY2026, Q2 FY2027
- Steps: read the Speakers transcript / the company transcript search hits
- Expected: Jensen Huang and the IR host named (they are named on the Q4 press release and other calls)
- Actual: 15 turns "Unknown speaker 1" / "Unknown speaker 2" on Q4 FY2026 (Jensen's Q&A answers), "Unknown speaker 3" in Q3 FY2026 / Q2 FY2027 hits; "Harlan Suhr", "Stacy Raskin", "Mark Lipakis", "Erin Rakers", "Antoine Chequepin" (Q4 FY2026), "Jen Huang" (GTC Taipei 2026 keynote, "Speaker uncertain"); AAPL Q4 FY2026 participants list "Unknown speaker 1". Related to F024
- Evidence: `GET /v1/events/cce56779-…/transcript?include=words`; `/v1/search/transcripts?company=NVDA&q=data+center…`
- Outcome: open (Task 11: data → backend tasklist)

### F070 — An upcoming non-earnings event opens on "Price moves" (its only tab) instead of "No transcript yet"
- Check: T5.27 · Severity: minor · Class: dashboard
- Where: http://localhost:3001/NVDA/earnings-calls/77d3d72c-3129-43e5-ac83-a9fef6511afc (UBS conference, Dec 1, 2026)
- Steps: open the event
- Expected: "No transcript yet" + why, as for an earnings call (T5.27)
- Actual: the tab bar held only "Price moves" (every flagged tab hidden for a non-earnings event) and the page asked `/v1/events/{id}/price-attribution` for an event that has not happened: "Price moves are not available for this call yet"
- Evidence: `call-tabs.tsx` `hidden()` hid the Transcript tab too
- Outcome: fixed in 218fabd (the Transcript tab stays, muted; test `no-transcript-notice.test.tsx`; CLAUDE.md non-earnings line; re-checked: "Transcript | Price moves", "No transcript yet")

### F071 — Press releases carry no `news_id` though News holds the item; that item's time is wrong
- Check: T5.24 · Severity: minor · Class: data
- Where: http://localhost:3001/NVDA/earnings-calls/22056489-ca4b-4e8e-9d6b-03678d13d178?tab=press-release, http://localhost:3001/NVDA/news?from=2026-11-17&to=2026-11-18
- Steps: look for the press release's news link; find the item in News
- Expected: `news_id` set → "News item" link (CLAUDE.md press-release tab)
- Actual: `news_id: null` on the Q3 FY2027 and Q4 FY2026 press releases; `/NVDA/news` lists "NVIDIA Announces Financial Results for Third Quarter Fiscal 2027" (SEC EDGAR, Earnings results) at "Nov 17, 2026, 1:00 PM GMT+1" = 12:00 UTC, nine hours before the 8-K's acceptance (21:20:51 UTC)
- Evidence: `GET /v1/events/22056489-…/press-release` (`news_id: null`, `published_at: 2026-11-17T21:20:51Z`)
- Outcome: open (Task 11: data → backend tasklist)

### F072 — Price attribution not derived for NVDA's last two calls
- Check: T5.22 · Severity: minor · Class: data
- Where: http://localhost:3001/NVDA/earnings-calls/22056489-ca4b-4e8e-9d6b-03678d13d178?tab=price-moves (and `b1dfd0fb-…`, Q2 FY2027)
- Steps: open Price moves
- Expected: minute rows for a recorded after-hours call (AAPL Q4 FY2026 has 89 minute bars)
- Actual: 404 `price_attribution_unavailable` → "Price moves are not available for this call yet" on Q3 FY2027 (5 days old) and Q2 FY2027 (3 months old); the notice renders correctly, no toast
- Evidence: `GET /v1/events/{id}/price-attribution` 404 on both
- Outcome: open (Task 11: data → backend tasklist)

### F073 — Transcript versions: `change_note` is a pipeline code ("company_text d1777505", "naming")
- Check: T5.12 · Severity: nit · Class: data
- Where: http://localhost:3001/NVDA/earnings-calls/22056489-ca4b-4e8e-9d6b-03678d13d178 (version select)
- Steps: open the version select
- Expected: a note a reader understands (free text the UI shows as is)
- Actual: "Version 3 · corrected by the system (company text) · Nov 19, 2026, 11:21 PM GMT+1 · company_text d1777505", "Version 2 · final · … · naming"
- Evidence: `GET /v1/events/22056489-…/transcript-versions?limit=200` `change_note`
- Outcome: open (Task 11: data → backend tasklist)

### F074 — Fund holdings: the as-of picker lists raw ISO days
- Check: T6.3 · Severity: nit · Class: dashboard
- Where: http://localhost:3001/SPY/holdings
- Steps: open the "As of" picker
- Expected: formatted days ("Nov 19, 2026 · Issuer file"; CLAUDE.md "No raw ISO date")
- Actual: "2026-11-19 · Issuer file", "2026-06-30 · SEC N-PORT filing"
- Evidence: `fundPickerDays` in `src/lib/sec/fund.ts` used `entry.as_of` as is
- Outcome: fixed in 28c460f (`formatDay`; test `fund.test.ts`; re-checked: "Nov 19, 2026 · Issuer file … Sep 30, 2025 · SEC N-PORT filing")

### F075 — Filing search on a fund symbol indexes none of the fund's forms but answers "complete"
- Check: T6.6 · Severity: major · Class: api
- Where: http://localhost:3001/SPY/filings?search=true
- Steps: "Search text" → `expense ratio` → Search (1 search, 100 credits)
- Expected: passages from SPY's prospectus / reports (485BPOS, N-30D, 497 are in its filings list; CLAUDE.md `[FU2870]`: a fund page searches its SEC filings), or a coverage note saying the fund's forms are not indexed
- Actual: "No passages found". `meta.index` = `completeness: "complete"`, `lexical: { state: ready, indexed: 0, pending: 0, failed: 0, not_indexed_by_policy: 0 }`, `forms_indexed` = 10-K*, 10-Q*, 8-K*, 20-F*, 40-F*, 6-K*, S-1*, F-1*, S-4*, F-4*, 424B4, 425, DEF 14A, DEFA14A — no fund form (N-CSR, N-30D, 485BPOS, 497, N-PORT), so a fund page's search can never find anything, yet coverage says complete and the search is billed
- Evidence: `GET /v1/search/filings?limit=10&mode=lexical&q=expense+ratio&symbol=SPY` req_01M81VCPFHDHZNW6BGYVM6BVA9 (charged 100)
- Outcome: open (Task 11: API → backend tasklist — index the fund forms, or answer `completeness: partial` / `not_indexed_by_policy` > 0 for a symbol whose filings are outside `forms_indexed`)

### F076 — SPY (a unit trust) has almost no fund metadata
- Check: T6.2, T6.18 · Severity: minor · Class: data
- Where: http://localhost:3001/SPY, http://localhost:3001/sec/884394
- Steps: open the overview and the trust's filer page → API sheet
- Expected: SPY's expense ratio (0.0945 %), index fund = yes; the filer's fund series with its name, ETF flag, exchange and class ticker
- Actual: `/v1/funds/SPY`: `is_index: null`, `expense_ratio_net` / `_gross` / `_as_of` null, `advisers: []`, `share_classes: []`, `homepage_url: null`; `/v1/filers/884394?expand=fund` series `cik:884394`: `series_name`, `is_etf`, `exchange` null, `share_classes: []` — the Fund series row reads "— · — · —" beside the ETF that `/v1/instruments/SPY` knows on ARCX
- Evidence: `GET /v1/funds/SPY?expand=coverage` req_01M81V7D9ZZFDHNWKR8GFEYHJR; `GET /v1/filers/884394?expand=…,fund`
- Outcome: open (Task 11: data → backend tasklist — the UIT path (S-6, no series id) gets no N-CEN / prospectus enrichment)

### F077 — VOO shows the series' cheapest class's expense ratio (0.01 %), not VOO's (0.03 %)
- Check: T6.7 · Severity: major · Class: data
- Where: http://localhost:3001/VOO (and `/sec/36405` Vanguard 500 row)
- Steps: open the overview → Size and costs
- Expected: the ETF class's net expense ratio (VOO 0.03 %); `/v1/funds/VOO` is the class `C000092055`
- Actual: "Expense ratio (net) 0.01% · as of Dec 31, 2025", gross 0.01 % — the Institutional Select class's figure (`expense_ratio_net: 0.0001`); the filer page's series row the same
- Evidence: `GET /v1/funds/VOO?expand=coverage` req_01M81VDV5P57KH34EX4MD0JE3H (`class_id: "C000092055"`, `expense_ratio_net: 0.0001`)
- Outcome: open (Task 11: data → backend tasklist — a class's `/v1/funds/{symbol}` must carry its own class's ratio, or name the class the ratio belongs to)

### F078 — VOO: `datasets` lists dividends but `/v1/dividends` answers 404 `not_covered`; coverage empty
- Check: T6.7 · Severity: minor · Class: data
- Where: http://localhost:3001/VOO, http://localhost:3001/VOO/dividends
- Steps: open the overview's "Data available" card; open Dividends (sidebar offers it from `datasets`)
- Expected: VOO's quarterly dividends (as SPY's "dividends through Sep 18, 2026"), and the coverage card naming them
- Actual: overview "No data family holds rows for this fund yet." (`coverage.families: []`, though its holdings are served); Dividends: 404 "No dividend data is available for VOO."
- Evidence: `GET /v1/dividends?limit=40&sort=-ex_date&symbol=VOO` req_01M81WBDNBE5AF0V8XH42YT2XF; `/v1/funds/VOO?expand=coverage` req_01M81VDV5P57KH34EX4MD0JE3H
- Outcome: open (Task 11: data → backend tasklist; the page's rendering of the 404 is F093)

### F079 — ADX's N-PORT composition has no weights
- Check: T6.9 · Severity: minor · Class: data
- Where: http://localhost:3001/ADX/holdings
- Steps: open the page
- Expected: sector / country / asset-class weights, as SPY's N-PORT compositions have ("the N-PORT percent of net assets")
- Actual: "Partial · No weights for this composition." (`meta.reason: weights_unavailable`) for "SEC N-PORT filing · as of Jun 30, 2026", whose positions all carry a weight %
- Evidence: page text; `/v1/funds/ADX/weights` (API sheet)
- Outcome: open (Task 11: data → backend tasklist)

### F080 — `/sec/$cik` filings: Roles column shows snake_case codes
- Check: T6.14 · Severity: nit · Class: dashboard
- Where: http://localhost:3001/sec/1067983
- Steps: read the Roles column
- Expected: words ("subject company", "filed by", "reporting owner")
- Actual: "filed_by, listed, subject_company", "listed, reporting_owner"
- Evidence: `SecFilingsView` joined `filing.roles` as answered (the spec's list is open: "filer, subject, …")
- Outcome: fixed in 404acfb (`filingRoleLabel`, unknown codes with `_` → space; test `sec-filer.test.tsx`; re-checked: "filed by, listed")

### F081 — Filing roles inconsistent: a filer's own older filings carry only "listed"
- Check: T6.14 · Severity: minor · Class: data
- Where: http://localhost:3001/sec/1067983?form=13F-HR
- Steps: filter 13F-HR
- Expected: Berkshire is the `filer` of every one of its 13F-HR filings
- Actual: the newest (Nov 16, 2026) reads "filer, listed"; every older one (Aug 14, 2026 back to 2017) only "listed"; most Form 4 rows likewise "listed" while the newest read "issuer, listed"
- Evidence: `GET /v1/filings?limit=40&symbol=1067983&form=13F-HR`
- Outcome: open (Task 11: data → backend tasklist — roles only derived for recently ingested filings?)

### F082 — 13F portfolio: Alphabet Class C (CUSIP 02079K107) labelled GOOGL
- Check: T6.15 · Severity: minor · Class: data
- Where: http://localhost:3001/sec/1067983?period=2026-09-30
- Steps: load the portfolio
- Expected: 02079K305 → GOOGL, 02079K107 → GOOG
- Actual: both rows "GOOGL · ALPHABET INC" (and link `/GOOGL`); SPY's issuer file maps them correctly (GOOGL / GOOG)
- Evidence: `GET /v1/filers/1067983/holdings?period_end=2026-09-30` row `security.cusip 02079K107`, `symbol GOOGL`
- Outcome: open (Task 11: data → backend tasklist — CUSIP → symbol resolution for share classes)

### F083 — `/sec/$cik` 13F portfolio: no way to pick another quarter
- Check: T6.15 · Severity: minor · Class: dashboard
- Where: http://localhost:3001/sec/1067983
- Steps: "Load the latest quarter"
- Expected: `?period=` choosable (the Holders page has a quarter picker; T6.15 "quarter `?period=`")
- Actual: a static "Period ending Sep 30, 2026"; older quarters only by editing the URL
- Evidence: `src/routes/sec/$cik.tsx`
- Outcome: fixed in 96d6918 (`quarterPickerOptions` in `src/lib/sec/source.ts`, 8 quarters back, a linked older one kept; test `source.test.ts`; CLAUDE.md "Ownership and offerings"; re-checked: Jun 30, 2026 picked → `?period=2026-06-30`, 13F filed Aug 14, 2026)

### F084 — Filer header: fiscal year end as raw `MM-DD`
- Check: T6.12 · Severity: nit · Class: dashboard
- Where: http://localhost:3001/sec/320193
- Steps: read the header facts
- Expected: "Sep 25" (the Companies tab's `fiscalYearEndText`)
- Actual: "fiscal year end: 09-25"
- Evidence: `SecFilerHeader`
- Outcome: fixed in 252d298 (test `sec-filer.test.tsx`; re-checked: "Dec 31" on `/sec/1067983`)

### F085 — Private offerings summary: raw ISO first / latest filed days
- Check: T6.20 · Severity: minor · Class: dashboard
- Where: http://localhost:3001/sec/2122354
- Steps: read the "Private offerings (Form D)" facts
- Expected: "Sep 30, 2026"
- Actual: "first filed: 2026-09-30", "latest filed: 2026-09-30"
- Evidence: `SecPrivateOfferingsView`
- Outcome: fixed in 792510c (test `sec-filer.test.tsx`; re-checked)

### F086 — Fund series row of a unit trust reads its raw fund key; scope "fund"
- Check: T6.18 · Severity: nit · Class: dashboard
- Where: http://localhost:3001/sec/884394
- Steps: read the Fund series table
- Expected: the trust's name; the scope in words as on the overview ("this fund")
- Actual: "cik:884394" as the series name; "$781.19B · fund · as of Jun 30, 2026"
- Evidence: `SecFundView` (`series_name ?? fund_key`, own scope map)
- Outcome: fixed in 4ac420a (a `cik:` fund key reads as the filer's name, scope via `netAssetsScopeText` — "series total, all share classes" / "this fund" on both pages; test `sec-filer.test.tsx`; CLAUDE.md "SEC document store"; re-checked: "SPDR S&P 500 ETF TRUST … $781.19B · this fund")

### F087 — Offering detail: size compact beside exact amounts
- Check: T6.20 · Severity: nit · Class: dashboard
- Where: http://localhost:3001/offerings/021-599189
- Steps: read Amounts
- Expected: one format in the block
- Actual: "Offering size $26.92M", "Sold $810,062", "Remaining $26,108,938"
- Evidence: `OfferingDetailView` used the list's compact `offeringAmountText`
- Outcome: fixed in ec64c34 (exact size in the detail, lists keep compact; test `offerings-pages.test.tsx`; re-checked: "$26,919,000")

### F088 — Offering `year_of_inc` answers the Form D element name (`overFiveYears`)
- Check: T6.20 · Severity: nit · Class: api
- Where: http://localhost:3001/offerings/021-599189
- Steps: read Issuer → Incorporated
- Expected: per the spec, "a year, or Over Five Years / Within Last Five Years"
- Actual: "overFiveYears"
- Evidence: `GET /v1/offerings/021-599189` `year_of_inc: "overFiveYears"`
- Outcome: open (Task 11: API → backend tasklist — answer the words the spec describes; no client relabel)

### F089 — Unknown CIK: the not-covered notice three times
- Check: T6.19 · Severity: minor · Class: dashboard
- Where: http://localhost:3001/sec/9999999999
- Steps: open the URL
- Expected: one not-covered state (as `ZZZZQ` for instruments)
- Actual: header notice, the same notice again under Lifecycle, and a Filings block "Unknown · Not known to the SEC store · No instrument is known for 9999999999"
- Evidence: page text
- Outcome: fixed in 69632ac (`isNotFound` in `src/lib/api/errors.ts`; the page renders the header notice alone; test `errors.test.ts`; re-checked: one notice)

### F090 — Unknown person: empty calls / history blocks under the not-found notice
- Check: T6.23 · Severity: minor · Class: dashboard
- Where: http://localhost:3001/people/00000000-0000-4000-8000-000000000000
- Steps: open the URL
- Expected: the `PeopleState` not-found alone
- Actual: "Not found · No person with this id", then "Calls … No call of this person is stored yet." and "Role & firm history · No role or firm stated on the loaded calls" (`/v1/participants?person=` answers 200 empty)
- Evidence: `GET /v1/people/00000000-…` 404 req_01M81VWD09Y5VFV2RRA00Q6KHS
- Outcome: fixed in a771081 (blocks hidden on `isNotFound(person.error)`; re-checked: notice alone)

### F091 — Exchange-traded trust: "Size and costs" promises N-PORT net assets
- Check: T6.8 · Severity: nit · Class: dashboard
- Where: http://localhost:3001/GLD
- Steps: read the Size and costs card
- Expected: no N-PORT promise for a trust that files none (the composition card says so)
- Actual: "N-PORT net assets, prospectus expense ratio" over "Net assets —"
- Evidence: `FundProfileView`
- Outcome: fixed in 650171a ("Shares and short interest; a trust files no N-PORT report"; test `fund-overview.test.tsx`; re-checked)

### F092 — SEC filing search on a fund page says "Search this company's SEC filings"
- Check: T6.6 · Severity: nit · Class: dashboard
- Where: http://localhost:3001/SPY/filings?search=true
- Steps: open "Search text"
- Expected: wording that fits a fund
- Actual: label / placeholder "Search this company's SEC filings"
- Evidence: `sec-filing-search.tsx`
- Outcome: fixed in 318127f ("Search SPY's SEC filings"; test `sec-search.test.tsx`; re-checked without running a search)

### F093 — Dividends: a 404 `not_covered` renders as "Error · Failed to load dividends"
- Check: T6.7 · Severity: minor · Class: dashboard
- Where: http://localhost:3001/VOO/dividends
- Steps: open the page
- Expected: a state notice in the API's words (CLAUDE.md "a hook whose page renders the error"; the not-covered pattern of the other pages)
- Actual: "Error · Failed to load dividends · No dividend data is available for VOO."
- Evidence: req_01M81WBDNBE5AF0V8XH42YT2XF (404 `not_covered`); `DividendsView` used `ErrorState`
- Outcome: fixed in 5ac5b83 (`RequestErrorState` with `notFound`; test `reference-pages.test.tsx`; re-checked: "Not covered · No dividend data is available for VOO.")

### F094 — Every docs link (and `/licensing`, "Create one") points to `data.invinite.com`, which has no DNS record
- Check: T7.1 · Severity: major · Class: api
- Where: http://localhost:3001/AAPL/filings → API → "Docs: listFilings" (`https://data.invinite.com/docs/get--_v1_filings`); also the sidebar's Licensing, `/licensing` 301, the key card's "Create one" / account links (`src/lib/app-url.ts`)
- Steps: open the API sheet, follow a docs link; `dig data.invinite.com` (local resolver, 1.1.1.1 and 8.8.8.8)
- Expected: the docs page of the operation opens (CLAUDE.md O6 `docsUrl`; the spec's own `docs_url`s name the same host)
- Actual: the browser pane refuses the navigation; `curl` "Could not resolve host"; no A / CNAME record on public resolvers (`status.data.invinite.com` and `api.data.invinite.com` resolve). The dashboard builds the links as documented — the Data app origin is not live
- Evidence: link `href`s / `rel="noopener noreferrer"` / `target="_blank"` correct in the sheet; DNS answers empty
- Outcome: API → backend tasklist (Task 11: publish the Data app / docs at `data.invinite.com`, or change the documented origin in the spec and `app-url.ts` together)

### F095 — API sheet JSON tree: the last chunk's button reads "Show 26 more of 26"
- Check: T7.3 · Severity: nit · Class: dashboard
- Where: http://localhost:3001/AAPL/filings → API → fiscal periods → Show answer (JSON) (76 rows)
- Steps: open the answer; read the button under the 50 rows
- Expected: a count that says what is shown of all
- Actual: "Show 26 more of 26" (it meant 26 of the 26 remaining; reads as a tautology)
- Evidence: `json-tree.tsx` label
- Outcome: fixed in ffad973 ("Show 26 more (50 of 76 shown)"; test `api-inspector.test.tsx`; re-checked)

### F096 — A URL day that is no calendar day (`?from=2026-13-45`) renders a raw zod validation dump
- Check: T7.9 · Severity: minor · Class: dashboard
- Where: http://localhost:3001/AAPL/insider-trades?from=2026-13-45 (also `/AAPL/filings?from=…`, every route using `optionalDay`)
- Steps: open the URL
- Expected: an invalid value falls back to the default without an error (URL state rule)
- Actual: `optionalDay` only checked the shape `\d{4}-\d{2}-\d{2}`, so the day reached the server function's `z.iso.date()`: "Error · Failed to load insider trades" + the JSON issue list (`invalid_format`, the date regex, `filedAtGte`)
- Evidence: page text; no Data API request in the sheet (refused before it)
- Outcome: fixed in 48a50a4 (`optionalDay` = `z.iso.date()`; test `url-state.test.ts`; re-checked: the param is dropped, 40 filings / 50 trades listed)

### F097 — Several filters and tabs add a history entry per change (Back steps through them)
- Check: T7.8 · Severity: minor · Class: dashboard
- Where: `/AAPL/financials` view tabs, `/calendar` filters, `/ipo-calendar` filters, `/market-holidays` tab, `/account` window, `/institutions` sort, `/AAPL/documents` category / section / kind / year, the news / news-feed item close
- Steps: switch a tab / filter (pushState counted in the page)
- Expected: written `IN_PLACE` (`replace: true, resetScroll: false`), except `/search`'s submitted query (CLAUDE.md URL state rule)
- Actual: `navigate({ resetScroll: false, … })` without `replace`: one history entry each (Ratios → Standardized pushed `/AAPL/financials`); closing a news item pushed too, so Back reopened it. Holders, insider trades, news tabs, call page were already in place
- Evidence: `history.pushState` counter; grep of `navigate({` calls
- Outcome: fixed in a04bfb3 (9 routes use `IN_PLACE`; a source-scan test in `url-state.test.ts` fails on a same-page search navigation without it; CLAUDE.md URL state rule; re-checked: no push on financials / holidays / documents)

### F098 — Phone width: the sidebar sheet stays open after picking a page
- Check: T7.12 · Severity: minor · Class: dashboard
- Where: http://localhost:3001/account at 390 × 844 → Toggle sidebar → Funds
- Steps: open the sheet, pick a link
- Expected: the sheet closes after navigation
- Actual: `/funds` loaded under a still-open sheet covering the page
- Evidence: `[role=dialog]` "Sidebar" present after the navigation
- Outcome: fixed in 2772c86 (the mobile sheet closes on a link click, `ui/sidebar.tsx`; test `src/components/ui/sidebar.test.tsx`; re-checked)

### F099 — Ratios: every chart button and chart title name the category ("Chart Liquidity"), not the metric
- Check: T7.17 · Severity: minor · Class: dashboard
- Where: http://localhost:3001/AAPL/financials?view=ratios
- Steps: read the chart buttons' names; open a chart
- Expected: the charted metric named (CLAUDE.md "the series named by the metric")
- Actual: ratios put the metric in the first (group) column and the category in `label`; the button / dialog used `label` → "Chart Liquidity" for Current Ratio and Quick Ratio alike
- Evidence: `aria-label` of the row buttons
- Outcome: fixed in 590c65b (`chartName` = "Current Ratio · Liquidity"; test `financials-v2-pages.test.tsx`; re-checked: dialog title "Current Ratio · Liquidity")

### F100 — A focused tab panel shows no focus ring
- Check: T7.15 · Severity: nit · Class: dashboard
- Where: http://localhost:3001/AAPL/holders (Tab past the tab list)
- Steps: Tab from "Overview" into the panel
- Expected: a visible focus indicator everywhere
- Actual: the Base UI panel takes focus (`tabindex=0`) but `TabsContent` was `outline-none` with no ring
- Evidence: computed style of the focused `[role=tabpanel]`
- Outcome: fixed in 5bc30f6 (`focus-visible:ring-[3px]`; test `src/components/ui/tabs.test.tsx`; re-checked)

### F101 — Closing a URL-driven dialog drops focus to the page: the DataTable remounted every cell on a rebuilt column set
- Check: T7.15 · Severity: minor · Class: dashboard
- Where: http://localhost:3001/AAPL/filings → focus a row's "HTML" → Enter → Escape
- Steps: open and close the HTML viewer from the keyboard
- Expected: focus returns to the trigger
- Actual: focus on `<body>`: the `?filing=` change rebuilt `filingColumns(…)`, and `flexRender` mounts a function template as its own component type, so every cell (and the sort header) remounted — the focused button was a detached node. Same for any `DataTable` page whose columns are built in render (sort toggles, row actions)
- Evidence: the focused node `document.contains` false after opening
- Outcome: fixed in fad704e (`DataTable` calls templates inside one stable `ColumnContent`; test `data-table.test.tsx`; re-checked: focus back on "HTML", rows / calendar / holders render)

### F102 — Icon-only tree toggles and many filter selects have no accessible name
- Check: T7.17 · Severity: minor · Class: dashboard
- Where: `/AAPL/financials` (statement tree chevrons, statement / segment / category / basis / horizon / sign selects), `/calendar` (session, event type, date certainty, event status), `/AAPL/news` filters, `/sec/1067983` form select
- Steps: list buttons / comboboxes without a name (`read_page`, accessible-name check)
- Expected: every icon-only button and form field named
- Actual: the chevron buttons had no name or state; `FilterSelect`'s `aria-label` was optional and 17 uses left it out (a select trigger shows its value, not what it filters)
- Evidence: page scan (the TanStack devtools' own buttons excluded — dev only)
- Outcome: fixed in 12b1c8a ("Expand / Collapse <row>" + `aria-expanded`; `FilterSelect` requires `aria-label`, every use named; test `financials-v2-pages.test.tsx`; re-checked: no unnamed combobox on financials / calendar)

## Summary (filled by Task 11)

| Class | blocker | major | minor | nit | fixed | API tasklist | other |
| --- | --- | --- | --- | --- | --- | --- | --- |
| dashboard | | | | | | | |
| api | | | | | | | |
| data | | | | | | | |
| doc | | | | | | | |
