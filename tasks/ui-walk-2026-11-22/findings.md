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

## Summary (filled by Task 11)

| Class | blocker | major | minor | nit | fixed | API tasklist | other |
| --- | --- | --- | --- | --- | --- | --- | --- |
| dashboard | | | | | | | |
| api | | | | | | | |
| data | | | | | | | |
| doc | | | | | | | |
