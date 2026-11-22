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

## Summary (filled by Task 11)

| Class | blocker | major | minor | nit | fixed | API tasklist | other |
| --- | --- | --- | --- | --- | --- | --- | --- |
| dashboard | | | | | | | |
| api | | | | | | | |
| data | | | | | | | |
| doc | | | | | | | |
