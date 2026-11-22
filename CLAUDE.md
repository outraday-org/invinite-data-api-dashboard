# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm run dev          # Start dev server on port 3001
pnpm run build        # Production build
pnpm run test         # Run tests (vitest; vitest.config.ts, node env, src/**/*.test.ts + *.test.tsx — a component test starts with `// @vitest-environment jsdom`; kept apart from the Netlify / Start plugins of vite.config.ts)
pnpm run lint         # Run ESLint
pnpm run check        # Run ESLint --fix && tsc --noEmit
pnpm run generate:api # Regenerate API types (schema.d.ts) and the operations table (operations.gen.ts) from openapi.json
```

## Architecture

This is a TanStack Start (React SSR) dashboard for the Invinite financial data API. It uses file-based routing with TanStack Router and server functions for API calls.

### API Layer (`src/lib/api/`)

- **openapi.json**: the pinned data API spec, adopted from the API's versioned `reference/openapi.json` (see "Data contract ownership"). Since backend `tasks/instruments-and-funds-api` task 6 it is the Data API 7.0 contract (instruments, funds, holders; copied from the uncommitted `../invinite-data-api-instruments` clone until 7.0 is released, task 8). Copy it over, then `pnpm generate:api` (its output is committed after `pnpm run check`'s `eslint --fix`, which re-sorts it). `pnpm-workspace.yaml` holds pnpm 11's `allowBuilds` (esbuild `true`; `@parcel/watcher`, `msw`, `sharp`, `unrs-resolver` `false` — prebuilt binaries / an unused msw worker): without a decision for every dependency build script pnpm 11 stops with `ERR_PNPM_IGNORED_BUILDS`. A new dependency with a build script needs its own entry
- **schema.d.ts**: Auto-generated TypeScript types from OpenAPI spec. Regenerate with `pnpm run generate:api`
- **types.ts**: Derived response/entity types using the `ApiResponse` helper to extract typed responses from schema
- **client.server.ts**: Creates typed `openapi-fetch` client with Bearer auth
- **server-functions.ts**: TanStack Start server functions (`createServerFn`) with Zod validation. These run on the server and handle API calls
- **queries.ts**: React Query hooks (`useQuery`/`useInfiniteQuery`) that call server functions. Each hook manages API key from store and shows error toasts
- **errors.ts**: `ApiRequestError` (`status`, `code` = the body's `error`, `body`). Every earnings server function throws it via `throwApiError(error, response)`; the shared earnings hook helpers (`useEarningsQuery` / `useEarningsInfinite` in `queries.ts`) revive it on the client (`rethrowApiError` → `fromSerialized`: a server function's thrown Error crosses to the client as a plain `Error` with its own properties) and never retry an API answer (`retryUnlessApiError`). A hook with `errorMessage: null` is status-aware — no toast, the page renders the state: event, transcript, press release, stats, comparison, prosody, price attribution (a 404 `not_found` is a page state there: not derived yet / first call, the reason in `detail`), audio, slides, investor documents / document search, transcript search, live audio (403 `forbidden` = audio refused, 503 `unavailable` = media outage / search off) and the live list (its 15-s refetch would otherwise toast on every failure; the "Live now" strip shows a one-line note). The other earnings hooks toast with their `errorMessage`. The REST plan gate is the `403` problem `plan_required` (the legacy `403 { error: "Forbidden" }` is still read) (`isTierError`; `forbidden_tier` is the WebSocket's code). A v2 problem+json body is read too (see "Data API v2"). Non-earnings hooks keep their own pattern (raw `throw error` + `useErrorToast`)
- **Earnings calls**: every earnings page reads the events family (see "Data API v2"); no old `/v1/earnings-calls/*` server function or hook is left (people: `/people` + `/people/$personId`, see "People"; the 7.0 contract has no webhook or analyst route). `getApiBaseUrl` / `useApiBaseUrl` return the (non-secret) API base URL for the `/v1/stream` WebSocket. `useV2Event` refetches every 30 s while `isEarningsEventLiveish` (armed / capturing / captured without a transcript); `useV2LiveEvents(enabled)`; `useV2LiveAudio` is never stale and refetches only every 15 s while `not_started`

### SEC document store (the SEC family of the Data API: filers, filings, document versions, holdings, filing search)

- **API layer**: the old `/v1/sec/*` routes were deleted with the old v1 API (backend data-api-v2 task 12, 2026-11-11); every SEC view reads the redesigned operations (see "Data API v2"): `getV2Filers` (`GET /v1/filers?q=`, one page of ≤ 50, `useV2Filers`), `getV2FilingSearch` (`GET /v1/search/filings`, `symbol` = ticker, fund key or CIK, `mode`, `case_sensitive` boolean only with `literal`, cursor; `useV2FilingSearchInfinite`), `getV2Filings` / `getV2Filing` / `getV2DocumentVersion` / `getV2DocumentFigure` / `getHolders` / `getFilerHoldings`. Types `V2FilersResponse` / `V2FilerMatch` / `V2FilingSearchResponse` / `V2FilingSearchHit` / `SecSearchCoverage` (= `meta.index`) / `SecSearchMode` / `SecReadinessStatus` in `types.ts` (`SecJson` narrows the spec's free-form nested objects to `JsonValue`). Not ported (no contract equivalent): the metric-export download (`/v1/sec/exports/*`) and the section outline hook — both had no UI
- **Readiness** (`src/lib/sec/readiness.ts`): `secErrorState` classifies the problems (403 `excluded` vs the plan gate `plan_required`, 404 `not_covered` → unknown, 503 `unavailable` → not_ready, 400, 409 `restart_required`, 413), `v2CoverageState` a 200's `meta.coverage` (pending / partial); `reasonText` / `coverageReasonText` (earnings + SEC coverage reasons, generic fallback); `isV2GenuineEmpty` = complete coverage, `isSearchGenuineEmpty` = complete page coverage AND a complete `meta.index`. `src/components/sec/sec-readiness-notice.tsx` `SecReadinessNotice` (`error` | `coverage`) renders every state; never an empty result
- **View models** (`src/lib/sec/source.ts`): guards over the free JSON (never `as`): `toV2FilingDocuments`, `toBlocks`, `pageLabel` (printed label only when present AND `quality.printed_labels_trusted`, else "p. N (ordinal)"), `citationText` (version + block + page, never a URL), block ranges `blocksFrom` / `blocksBefore` / `blocksLeadingTo` (paging inside one version), `toSecHitView` (a search hit: the cited block = the first `document_spans[].blocks[].block_id`, the original = `citation.source.url`), `toMetaSource`, `latest13fPeriodEnd`, `recentQuarterEnds`. `parity.ts`: the `$ticker/filings` list on `/v1/filings`: `toFilingListRow` (`report_date` → fiscal / calendar quarter via `useCompanyFiscalPeriods` = every cursor page of `/v1/fiscal-periods?company=`, matched by `period_end`), `formTypesOfFacet` (picker = `meta.form_facet`), `primaryDocumentOf` (the HTML view = the primary document's public `source_url`, the filing loaded only when a row is opened; null → "No public copy yet" + the source panel; a primary that is no `.htm` / `.html` — a Form 3 / 4 / 5's XML — is never framed: "No HTML document" + the original + the source panel); pages by `next_cursor`. Fixtures (tests only): `v2-fixtures.ts` (filings, filing, document version, filers, filing search, holdings, …); the two calendar events live in `src/lib/earnings/calendar-fixtures.ts`. `no-direct-sec-calls.test.ts`: no code path requests sec.gov or an LLM host (sec.gov only as an outbound link)
- **Panel** (`src/components/sec/sec-source-panel.tsx`): `SecSourceDialog({ target })` / `SecSourcePanel` — a filing (`{ kind: "filing", accession }`: `/v1/filings/{accession}?expand=documents` → "Read" a document with a `current_version_id`) or a citation (`{ kind: "citation", versionId, blockId }`: `/v1/document-versions/{id}` from a few blocks before the block, highlighted; `V2DocumentReader({ versionId, focusBlockId? })`). Pure views `V2FilingDocumentsView`, `SecBlocksView` (footnotes beside their block, "Footnote bN" navigates, "Open figure" → `SecFigureView` = the public `image.url` or "The image has no public copy yet", previous / next blocks), tested in `src/routes/-tests/sec-source-panel.test.tsx`
- **Entry points**: `$ticker/filings` rows → "Documents" (the panel's `filing` target); `$ticker/documents` search source chips "Company documents" | "SEC filings" (`sec-filing-search.tsx` `SecFilingSearch({ symbol })` = the page's ticker; Keyword / Exact + Match case; 100 credits a page; "More results" by cursor; 503 `unavailable` = "SEC filing search is not switched on yet"; hits open their cited block); landing "SEC filers" card (`sec-filer-lookup.tsx`: a CIK opens its page, a name searches `/v1/filers?q=`, a row shows its listing or "No ticker" and its phase), the top-bar search's Institutions & filers group, `/institutions` and the holders / holdings / portfolio cells → `/sec/$cik` (`src/routes/sec/$cik.tsx`, outside `$ticker`: no ticker invented; the sidebar's context lists its blocks as anchors, `FILER_ANCHORS`): filer identity + lifecycle from `/v1/filers/{cik}` (see "Data API v2"), a "Fund" block (`SecFundView`) from the same request's `expand=fund` (Data API release 5.7, backend us-universe sublist 2 task 4: one row per series — name + ETF badge, exchange MIC, class tickers, net expense ratio, net assets with scope `fund` / "series total, all classes" and date, 1y / 5y / 10y returns of the expense ratio's class; fractions shown as percent; `fund: null` = no block), a "Private offerings (Form D)" block (`SecPrivateOfferingsView`; Data API release 5.7, backend us-universe sublist 2 task 6) from the same request's `expand=private_offerings` summary (count, first / latest filed, total sold, latest exemptions with short labels `exemptionLabel`) and, only when the count is above 0, the rows of `useV2OfferingsInfinite` = `GET /v1/offerings?company=<cik>` (`getV2Offerings`; latest filing, offering id = Form D file number or first accession, amendments, industry, exemptions, offering size or "Indefinite", sold, investors; "More offerings" by cursor; `private_offerings: null` = no block), filings `/v1/filings?symbol=<cik>` (form facet, cursor; `symbol=` takes a CIK with a listed stock or a fund that is its own registrant — an unlisted filer answers 404, as 6.x's `company=<cik>` did) → panel, and for a 13F manager (phase `manager` or a 13F form in the facet) the portfolio `/v1/filers/{cik}/holdings?period_end=` (`useFilerHoldingsInfinite`, the `Holder` row; a fund registrant answers 404 naming `/v1/funds/{fund_key}/holdings`) on a click (`meta.coverage` / `pinned_at` / `counting` via `V2MetaLine`, "More positions" by cursor) (`sec-filer-views.tsx`, tested in `sec-filer.test.tsx`)
- **Shared search pieces**: `src/components/search/search-highlight.tsx` (`SpanHighlightedText`, `HighlightedText`, `SearchCoverageNote`), re-exported by `ask-this-call.tsx`; `Notice` lives in `src/components/ui/notice.tsx` (re-exported by `media-state.tsx`)

### Filings (backend `tasks/data-api-dashboard` O7 group 3)

- **`$ticker/filings`**: `?form=&items=&from=&to=&sort=asc&live=true&search=true&source=&block=&filing=&docs=` —
  `items` (8-K items, comma list) and the filed-day range go to `/v1/filings` as `items` / `filed_at.gte` / `.lte`
  (the spec's `format: date`: an instant is a 400; `useV2FilingsInfinite` `from` / `to` / `items`); columns Items,
  "Details" (`/filings/$accession`), HTML, Documents, EDGAR (the row's `edgar_index_url`, outbound); the header's
  facet line `facetSummary` (one form's count + `newest_filing_date`, else the newest filing). "Search text" opens
  `SecFilingSearch` for the page's symbol — stocks and funds alike (`[FU2870]`: an ETF / closed-end fund page searches
  its SEC filings; `symbol=` takes the fund's ticker, a series is searched alone). "Live" = `useLiveFilings` (below):
  rows whose frame `ticker` is the page's symbol join a newest-first list without an end date / items filter, marked
  "New" (`mergeLiveRows`).
- **Live filings** (`src/lib/live/use-live-filings.ts`, pure `live-filings.ts`, frame `parseFilingFrame` /
  `newFilingFrameSchema` in `ws-frames.ts`): `new_filing` frames reach EVERY connection of `/v1/stream` (channel
  `filings`, STANDARD; IDA `ablyRealtimeListener.ts` `broadcastToAll`) — no subscribe frame, nothing sent. One per
  accession, newest first, ≤ 200; nothing is replayed. Close 4001 / 4003 / 4029 stop (no reconnect loop) and turn the
  switch off with `LiveStopNotice`; other closes reconnect 1 s → 30 s × 10. The socket is not an HTTP request
  and is not in the API inspector. Page wiring: `$ticker/filings/-components/use-live-filings-feed.ts`.
- **One stream socket, one switch**: `src/lib/live/stream-socket.ts` `openStreamSocket` is the socket lifecycle of
  the three channel hooks `use-live-filings.ts`, `use-live-news.ts` and `use-live-alerts.ts` (admission closes
  `admissionCloses` 4001 / 4003 / 4029 = final stops, backoff 1 s → 30 s × 10 then `CONNECTION_LOST`, the channel's
  10-s re-subscribe `resubscribeLater`, unsubscribe + close on a stop or dispose); a hook owns only its channel
  (subscribe frame, frame parsing, what it keeps). `use-live-transcript.ts` keeps its own loop (resume by `since_seq`,
  stalled timer) and shares only the backoff constants. The switch + pill + stop notice of filings and news is
  `src/components/live/live-toggle.tsx` (`LiveToggle`, `LiveStopNotice` with `LIVE_FILINGS_PLAN_NOTE` /
  `LIVE_NEWS_PLAN_NOTE`); the alert event feed keeps its "Live: on / off" header button.
- **`/filings`** (`src/routes/filings/index.tsx`): `/v1/filings` needs `symbol`, so no REST list — the live stream since
  the page opened (on by default, `?paused=true`; `?form=` filters the arrived rows in the browser and says how many it
  hides; a row links its instrument's filings or `/sec/$cik` and its filing page) and "Search every filer"
  (`SecFilingSearch marketWide symbol=""`: `/v1/search/filings` without `symbol`; filters `?searchForm=&searchItem=
  &filedFrom=&filedTo=` committed on Search only — every search page is billed 100 credits; `SearchMatchesNote` states
  `meta.index.matches` — examined / total or "at least", order, `complete_since`, filed range — and `hint` /
  `narrow_with`; a hit links `/filings/$accession`, since a hit names no company).
- **`/filings/$accession`** (`src/routes/filings/$accession.tsx`, pure views `-components/filing-detail-views.tsx`):
  header from `useV2Filing(accession, ["documents"])` (the cache the HTML dialog and source panel share); tabs
  `?tab=` Documents (default) · Facts (`/facts`, `?tag=` concepts) · Notes (`/notes`, `?noteTag=`) · Review chain
  (`/review-chain`, `?depth=` 1–6, `?direction=up|down`; nodes / edges / twins / completeness are free JSON read through
  guards) · Holdings (`/holdings`, only for `hasFiledHoldings` = 13F-HR* / NPORT-P*; `meta.family`) · Parties &
  relations (a second `useV2Filing(…, ["parties", "relations"])` on open). Each tab's hook runs only while it is open.
  Documents: "Read" / "Sections" / "Fact places" per readable version (`V2FilingDocumentsView` `extraActions`) open it
  below: `?version=&panel=sections|places&block=&outline=legacy` — the reader at `?block=`, the section outline
  (`/sections`; a heading opens its first block, `sectionStartBlock`) or the fact places (`/v1/fact-places?document_version=`,
  PRO; a place opens its block, links the annotated rendition). A filing fact carries no fact id, so places are listed
  per document version (`fact=` takes a standardized fact id: the financials lineage, group 4).
- **`/sec/datasets`** (`src/routes/sec/datasets.tsx`): `GET /v1/datasets` (`useV2DatasetsInfinite`), each SEC code with
  its name (`DATASET_LABELS`; an unknown code shown as stated), newest release, date, forms; export.
- Tests: `src/routes/-tests/filing-detail.test.tsx` (tabs, data sets, live list), `filings-page.test.tsx` (items,
  EDGAR, details, live row, facet line), `sec-search.test.tsx` (market-wide cap note, filters on submit),
  `src/lib/live/live-filings.test.ts`, the filings cases of `ws-frames.test.ts`, `v2-sec-queries.test.tsx`; fixtures
  `src/lib/sec/filing-detail-fixtures.ts` (tests only).

### Data API v2 (served under `/v1` since 2026-11-11; backend tasks/data-api-v2 tasks 4–12)

- **The cut-over (backend data-api-v2 task 12, owner decision 2026-11-11; pinned spec `info.version` 2026-11-11, invinite-data-api `0cfaa6f`)**: the OLD v1 API was deleted (`/v1/company/*`, `/v1/standardized/*`, `/v1/as-reported/*`, `/v1/sec/*`, `/v1/earnings-calls/*`, `/v1/ws`, …) and the redesigned v2 contract renamed to `/v1` (same operationIds, schemas, envelopes, problem codes; every `/v2/*` path answers 404). Every call of this app is on that contract: search = `GET /v1/instruments?q=` (`getInstruments`, `useInstrumentSearch`; see "Instruments and funds"), the layout = `useInstrument` (`GET /v1/instruments/{symbol}`), the news / documents / stock overview company details = `useV2Company` (`GET /v1/companies/{company}`, stocks only), fiscal periods = `/v1/fiscal-periods`, the SEC views as in "SEC document store", the realtime socket = `WS /v1/stream` (channels `events.live` and `news`). The `V2*` / `getV2*` / `useV2*` names, `v2.ts` and the `v2-*` file names are kept from when the contract was `/v2`; below, "v1" names the deleted old API. Pages: company overview (`$ticker/index.tsx`: `useV2Company(ticker, { expand: ["coverage"] })` — the `Company` object itself, a "Data available" card of the coverage families with their `through` day (`coverageEntries` in `src/lib/api/v2.ts`), the CIK links `/sec/$cik` via `filer_cik`, 404 `not_covered` = a notice), dividends (`useV2DividendsInfinite`, `symbol` = the ticker of any instrument, sort `-ex_date`), stock splits (`useV2SplitsInfinite`, `-execution_date`), market holidays (`useV2MarketHolidaysInfinite`, `-date`) and `/sec/$cik` identity + lifecycle (`useV2Filer(cik, ["lifecycle", "proposed_symbols", "former_names", "successors", "fund"])` → `SecFilerHeader` / `SecLifecycleView` in `sec-filer-views.tsx`: listing or "No ticker", phase, the snake_case `lifecycle` (phase, kind, first_public_seen_at, last_observed_at, registration_tracks with their review status, pending_actions, warnings; `null` = "No lifecycle evidence"), proposed symbols, successors, former names; 403 `excluded` / 404 `not_covered` / 503 `unavailable` are notices). The earnings calendar, calls list, call page and Documents page moved in task 7 ("Events family" below). The news page moved in task 8 ("News page" below). The filings, insider-trades, institutions (now Holders) and IPO pages moved in task 6 ("SEC family" below). The financials, ratios, growth, CAGR and segments pages moved in task 5 ("Financials family" below). The `/sec/$cik` filings list and 13F manager portfolio and the documents-page SEC search moved with the cut-over (task 12)
- Server functions `getV2Company`, `getV2Dividends` (`exDateGte` / `exDateLte` → `ex_date.gte` / `ex_date.lte`), `getV2Splits`, `getV2MarketHolidays` (`dateGte` / `dateLte` → `date.gte` / `date.lte`), `getV2Filer`; types `V2*Response` / `V2Dividend` / `V2Split` / `V2MarketHoliday` / `V2CompanyCoverage` in `types.ts`. An unknown query parameter is a 400 `unknown_parameter`: each function sends only the operation's declared parameters and drops the unset ones (`v2Query`; `expand` = `v2Expand`, sorted comma list)
- Lists answer `{ data, has_more, next_cursor, meta }` and page by `cursor` = the previous `next_cursor` (`limit` 1–200, no offset): the hooks are `useEarningsInfinite` with `initialPageParam: null` + `nextCursorOf`; the cursor is the page param, never in the query key; the filters are, so a changed filter starts at page 1 and never sends an old cursor (400 `cursor_mismatch`). Tested in `src/lib/api/v2-queries.test.tsx` / `v2.test.ts`
- Errors on `/v1` (and `/health`, `/status*`) are RFC 9457 `application/problem+json` (`type, title, status, detail, code, param?, errors?, request_id, docs_url`): `ApiRequestError` reads `code` = the problem `code`, `message` = `detail`, `body.param`, `body.errors` (`{ param, code, detail }[]`), `requestId` = `request_id` (revived by `fromSerialized`); `useErrorToast` appends ` (<code>, request <id>)` (`errorDescription`), so a v2 toast quotes the code and the request id (402 `insufficient_credits` / 429 `rate_limited` are problems too)
- **Events family (task 7)**: the earnings calendar, the calls list, the call page and the Documents page are on v2. Server functions `getV2Events` (`company`, `type` — omitted = `earnings_call`, `all` = every type —, `status` upcoming / live / ended, `scheduledAtGte` / `scheduledAtLte` → `scheduled_at.gte|lte`, `dateKind` = date certainty confirmed / estimated, `expand: ["calendar"]`, `sort`), `getV2Event` (`expand` calendar, observations), the per-event `getV2PressRelease` (body always), `getV2Qa` (cursor), `getV2Slides` (`include` markdown / timeline — the timeline is opt-in in v2 —, `pages`), `getV2Audio`, `getV2LiveAudio`, `getV2EventStats`, `getV2EventComparison` (`prior`: only the derived previous call answers, another id = 404 naming it; O7), `getV2Prosody` (`section`), `getV2PriceAttribution`, `getV2Transcript` (`layer` raw / cleaned, `words`, `version`), `getV2TranscriptText` (`split` none / sections), `getV2TranscriptVersions`, `getV2TranscriptDiff` (`from`, `to`), `getV2TranscriptSearch` (`company` | `event` | neither = every company, `type` — a hit's `preparedRemarks` is sent as `prepared` —, `mode`, `conferenceDateGte` / `conferenceDateLte` → `conference_date.gte|lte` (O7); ONE page, ≤ 8 hits, `has_more: false`, `meta.index` = v1's `coverage`, `meta.query`), `getV2Guidance` (`company` | `event`, `metric`, `periodKind`, `basis`; ALWAYS `review=any`: the contract default `approved` matches no row today), `getV2Kpis` (`event`, or `company` + `metric` + `sort`: the KPI history, O7), `getV2Participants` (`event`), `getV2InvestorDocuments` (`company` | `event`, `category`, `kind`, `fiscalYear`; both sources `company` | `call`; `pages` and `body_text` are null in lists — v2 has no page count, so none is shown), `getV2InvestorDocument` (`pages` → `expand=pages`: the per-page text as `pages[]`, plus `body_text`), `getV2InvestorDocumentSearch` (`company`, `kind`, `mode`; ONE page, ≤ 20 hits; no source filter, no case switch). Hooks `useV2EventsInfinite` (404 `not_covered` quiet: the calls list's "Not covered" card), `useV2LiveEvents`, `useV2Event`, `useV2Transcript` / `useV2TranscriptText` / `useV2TranscriptVersions` / `useV2TranscriptDiff`, `useV2QaInfinite`, `useV2Participants`, `useV2PressRelease`, `useV2GuidanceInfinite`, `useV2KpisInfinite`, `useV2EventStats`, `useV2EventComparison`, `useV2Prosody`, `useV2PriceAttribution(id, { live })`, `useV2Audio`, `useV2Slides`, `useV2LiveAudio`, `useV2InvestorDocumentsInfinite`, `useV2InvestorDocument(id, { pages })`, `useV2TranscriptSearch`, `useV2InvestorDocumentSearch`; every per-event hook takes the event id ("" = idle). Types `V2Event` (`exchange` a MIC such as XNAS; `video` has no `provider`: `videoProvider` in `video.ts` reads it from the URL host), `V2EventCalendar`, `V2QaPair`, `V2Participation`, `V2GuidanceItem` (`id` / `metric_normalized` / `review_status` / `sources` nullable), `V2KpiMention`, `V2InvestorDocument`, `V2TranscriptSearchHit`, `SearchCoverage` (= `meta.index`), … in `types.ts`. Tested in `src/lib/api/v2-events-queries.test.tsx`
- **SEC family (task 6)**: `$ticker/filings`, `insider-trades`, `institutions` (since 7.0 `holders`) and `ipos` are on v2. The `ipos` issuer name links to `/sec/$cik` (`ipoIssuerCik`: the company row's CIK, else the registration track's; release 5.7), where the issuer's Form D private offerings are listed. Server functions `getV2Filings` (`symbol`, `form` list, `filedAtGte` / `filedAtLt` → `filed_at.gte` / `.lt`, `sort` only `filed_at` / `-filed_at` — `report_date` is a 400 until the door sorts by it), `getV2Filing` (`expand` documents / parties / relations), `getV2DocumentVersion` (`blocks`, `footnotes`, `neighbors`; no `limit` in v2: paging by `selection.next_block`), `getV2DocumentFigure`, `getHolders` / `getHolderChanges` / `getFilerHoldings` (see "Instruments and funds"), `getV2InsiderTrades` (`side` buy / sell, the day range as `filed_at.gte` / `.lt` the next midnight), `getV2Ipos` (`company` optional, `stage` list = `V2_IPO_STAGES` in `v2.ts`, `sort`). Hooks `useV2FilingsInfinite`, `useV2Filing(accession, expand)`, `useV2DocumentVersion`, `useV2DocumentFigure`, `useHoldersInfinite`, `useHolderChangesInfinite`, `useFilerHoldingsInfinite`, `useV2InsiderTradesInfinite`, `useV2IposInfinite` — all status-aware (`errorMessage: null`); a list whose first page has `meta.coverage.state: pending` (`data: []`) is asked again every 30 s (`refetchWhileCoveragePending`, `useEarningsInfinite`'s `refetchInterval`). Types `V2Filing`, `V2FilingDetail`, `V2FilingDocument`, `V2FormFacet`, `V2Holder`, `V2HolderChange`, `V2InsiderTrade`, `V2Ipo`, `V2IpoStage`, `V2MetaCoverage`, `V2MetaSource`, … in `types.ts`. Readiness (`src/lib/sec/readiness.ts`): `v2CoverageState(meta.coverage)` (pending / partial = a notice, `through` its detail; complete = none), `isV2GenuineEmpty`, and `secErrorState` maps the problems through `V2_PROBLEM_STATUS` (403 `excluded`, 404 `not_covered` → unknown, 503 `unavailable` → not_ready; the problem `detail` is shown); `SecReadinessNotice coverage={meta.coverage}`. Guards (`source.ts`): `toV2FilingDocuments` (`current_version_id`, `source_url` https only), `toMetaSource` / `metaSourceParts` (`dataset_release`, `version_id`, `accession`, `fetched_at`), `versionIdOf` / `secUrlOf` read v2's `version.id` / `source.url` too, `recentQuarterEnds`. Shared pieces `src/components/ui/data-table.tsx` (`DataTable`, see "Page shell": rows, "Load more", the empty line only for a complete answer) and `v2-meta-line.tsx` (`V2MetaLine`: coverage + through, `pinned_at` snapshot, `counting`, `meta.source`). Pages: filings = `/v1/filings?symbol=<ticker>` (form picker = `meta.form_facet`); the HTML view = `/v1/filings/{accession}?expand=documents` (primary = the row's `primary_document`, else the document whose `type` is the form; v2 documents have no role); "Documents" opens the source panel's `filing` target (`V2FilingDocumentsView` → `V2DocumentReader` over `/v1/document-versions/{current_version_id}`; `SecBlocksView` / `SecFigureView` take a v1 or v2 answer); the panel's `citation` target (the documents-page SEC search) reads the same `/v1/document-versions/{id}`. Holders: see "Instruments and funds". Insider trades = side filter + filed day range; columns "Traded" (`transaction_date`), "Owner CIK" (`owner_cik`) and a "Derivative" badge (`is_derivative`) from the Form 3/4/5 dataset fields of release 5.7 (backend us-universe sublist 2 task 5; sec-api rows show "—"). IPOs = market-wide `/v1/ipos` (no company), stage filter, one row per offering: stage, exchange MIC, final price else range, Registration / Listing source badges. Not in the v2 contract, so not shown: a filing document's role, MIME type, size, availability and text / visual readiness. Tested in `src/lib/api/v2-sec-queries.test.tsx`, `src/routes/-tests/sec-v2-pages.test.tsx`, `filings-page.test.tsx`, `sec-source-panel.test.tsx`, `src/lib/sec/{readiness,source,parity}.test.ts`; fixtures `src/lib/sec/v2-fixtures.ts` (tests only)
- **Instruments and funds (Data API 7.0, backend `tasks/instruments-and-funds-api` task 6)**: an instrument is one exchange-traded US symbol with ONE `type` (`stock | etf | closed_end_fund | etn`); a fund carries `structure` (`registered_fund` | `exchange_traded_trust`: GLD, IBIT, USO … file 10-K, never N-PORT, so they have no holdings report). Server functions `getInstruments` (`q`, `type`), `getInstrument`, `getFunds` (`q`, `type`, `structure`, cursor), `getFund`, `getFundPositions` (`/v1/funds/{fund}/holdings`, `asOf`, ≤ 200 a page), `getFundWeights` (`/v1/funds/{fund}/weights`), `getHolders` (`/v1/holders?symbol=`: `source` `13f | nport | issuer_file` = that source's full list by cursor; no `source` = the overview, owner decision 12: one door page per source in `data`, `meta.sections[]` = `{source, state, reason, as_of, total, rows, has_more}`, no cursor; `periodEnd` is never sent with `issuer_file`, a 400 there), `getHolderChanges` (`/v1/holder-changes?symbol=`), `getFilerHoldings` (`/v1/filers/{cik}/holdings`). Hooks `useInstrumentSearch` (toasts), `useInstrument` (status-aware; the layout reads it once per symbol), `useFunds`, `useFund`, `useFundPositionsInfinite`, `useFundWeightsInfinite`, `useHoldersInfinite`, `useHolderChangesInfinite`, `useFilerHoldingsInfinite` ("" = idle). Types `V2Instrument` / `V2InstrumentType` / `V2FundStructure` / `V2Dataset`, `V2Fund` / `V2FundListItem`, `V2FundPosition*` / `V2FundSource` / `V2FundStoredDate` / `V2FundCompositionReason`, `V2FundWeight*`, `V2Holder` / `V2HolderSource` / `V2HolderSection(State)`, `V2HolderChange*`, `V2FilerHoldingsResponse`.
  - **Navigation from `datasets`**: `src/lib/instruments.ts` is the only map — `SECTION_DATASETS` (the `$ticker` section → the dataset it shows; a list = any of them: `financials` = statements, metrics or segments; the market pages are top-level routes since O5), `sectionDatasets`, `servesSection`, `instrumentBadges` (Stock / ETF / Closed-end fund / ETN, + "Trust" for an exchange-traded trust, + "Delisted"), `datasetGateText`. No per-type list lives in the dashboard: the sidebar's context (`src/lib/navigation.ts` `instrumentSectionGroups`) shows a section only when the instrument's `datasets` has its dataset (AAPL: no Holdings; SPY: no financials / earnings / insider items; GLD: no Holdings; an ETN: profile, dividends, splits, Holders). A symbol the API does not know (404) — or a segment longer than any symbol (`isSymbolParam`, > 15 characters: no request) — renders one "not known" notice instead of the pages; a typed URL to a section the instrument lacks renders the gate sentence (an exchange-traded trust's holdings name its structure), never a failing page. The header shows the instrument's name, logo and badges (no brand-colour dots since O5). The search (`ticker-search.tsx`) keeps the current section only when the picked hit's `datasets` has it, else opens the overview.
  - **Overview** (`$ticker/index.tsx`): a stock = the company profile (`useV2Company(…, expand coverage)`); a fund = `FundProfileView` (type, structure, issuer / trust → `/sec/$cik`, series, registration, index fund, advisers; net assets with date and scope — `series` = "series total, all share classes" for a class of a multi-class series such as VOO, whose `market_cap` is null and not shown —, expense ratio, shares outstanding, short interest; share classes, listed ones linking their page; the composition line = one `limit=1` `listFundPositions` request for its source + as-of, or for an exchange-traded trust the "no holdings report" sentence without a request); an ETN = `InstrumentCard` (the listing only).
  - **Holdings** (`$ticker/holdings`, sidebar "Holdings", dataset `fund_holdings`) = the fund's freshest composition labelled by `FundSourceBadge` ("Issuer file · as of D" / "Issuer file (monthly)" / "SEC N-PORT filing", never "current"), positions largest weight first with "Load more", a Notional column only when a row states one, `meta.reason` as a sentence (`single_asset_trust` = a notice), an as-of picker over `meta.composition.stored_dates` (`fundPickerDays`), and the weights block (one bar list per dimension, buckets as stated, never scaled to 100 %, the basis in words). Views `src/components/sec/fund-views.tsx` (`FundCompositionList`, `FundWeightsBlock`, `FundSourceBadge`, `weightText`), helpers `src/lib/sec/fund.ts` (every contract enum labelled: sources, reasons, holder sources, section states; `fund.test.ts` reads the enums from `openapi.json`).
  - **Holders** (`$ticker/holders`, sidebar "Holders", dataset `holders`, stocks and funds alike): tabs Overview (`HoldersOverview`: one block per `meta.sections[]` entry with its state, as-of, count — "N shown of T" / "more available" — and reason; "Show all" opens that source's tab; rows of different sources are never merged), "Institutions (13F)", "Funds (N-PORT)", "ETFs (issuer files)" (`HoldersList`, one `Holder` table whose columns follow the source; the issuer-file scope line names `meta.funds_with_issuer_file` — never presented as complete), "13F changes" (`HolderChangesList`). One quarter picker (`period_end`, not for issuer files). A fund holder links its page when `holder.symbols` is not empty (an unlisted fund is text only, owner decision 13); an N-PORT row with `holder.issuer_file_as_of` shows "Issuer file D". Views `src/components/sec/holder-views.tsx`. A source's list is asked only once its tab is open.
  - **Funds** (`/funds`, sidebar Browse): `GET /v1/funds` with type (ETF / Closed-end fund), structure ("with holdings" = `registered_fund`), exchange filters, sort by symbol / name (the contract has no net-assets sort), a ticker / name search, all in the URL, the net assets column, "Load more"; an ETN is no fund, an unlisted mutual fund never a resource.
  - Tested in `src/lib/instruments.test.ts`, `src/lib/sec/fund.test.ts`, `src/routes/-tests/{ticker-layout,ticker-search,fund-overview,funds-page,holdings-page,sec-v2-pages}.test.tsx`, `src/lib/api/v2-sec-queries.test.tsx`; fixtures `src/lib/instruments-fixtures.ts` (instruments with the API's `datasets`, VOO fund, a funds page) and `V2_FUND_*` / `V2_HOLDERS_*` / `V2_HOLDER_CHANGES` / `V2_FILER_HOLDINGS` in `src/lib/sec/v2-fixtures.ts`.
- **Financials family (task 5)**: `$ticker/financials-standardized`, `financials-as-reported`, `financials-ratios`, `financials-growth`, `financials-cagr` and `segmented-financials` are on v2 (same URLs); no `/v1/standardized/*`, `/v1/as-reported/*`, `/v1/financial-metrics/*` or `/v1/segmented-financials` server function is left. Server functions `getV2Standardized` / `getV2StandardizedDetailed` / `getV2StandardizedPresentation`, `getV2AsReported` / `getV2AsReportedDetailed` / `getV2AsReportedPresentation` (`company`, `statement` any of `V2_STATEMENTS` = income-statement / balance-sheet / cash-flow (v1 `cash-flow-statement`), `period`, `fiscalYear` / `fiscalQuarter` / `fiscalYearGte|Gt|Lte|Lt`, `asOf`, `filing`, `sort`, `limit`, `cursor`; as-reported also `reportedOnly`, `displaySign` — never sent on standardized), `getV2Ratios` (`category` any of `V2_RATIO_CATEGORIES`; v1 `solvency` = `leverage`), `getV2Growth` (`basis` yoy / qoq = v1 `growth_type`), `getV2Cagr` (`horizon` 3 / 5 / 10 = v1 `period_years`), `getV2Segments` / `getV2SegmentsDetailed` (`metric`, `axis`), `getV2Fact` (`/v1/facts/{fact_id}`), `getV2FactPlaces` (`/v1/fact-places`, `fact` | `documentVersion`, `status`; O7). Hooks `useV2FinancialsInfinite({ basis, view })` (picks the operation; `view` summary / detailed / presentation), `useV2RatiosInfinite`, `useV2GrowthInfinite`, `useV2CagrInfinite`, `useV2SegmentsInfinite`, `useV2SegmentsDetailedInfinite`, `useV2Fact`, `useV2FactPlaces(factId)` — all status-aware (O7: every period-list hook takes `fiscalYearGte` / `fiscalYearLte`), a pending first page asked again every 30 s. Pure view models in `src/lib/financials/statements.ts` (`periodLabel`: annual rows carry `fiscal_quarter` 4, so the label reads the `period`; `statementLines` flat summary / detailed lines, `presentationPeriods` trees (the tree of the newest period that states one: an as-reported Q4 is empty), `filingSourceText` = the column header tooltip incl. "restated by a later filing" (the day as the "From filing" picker names it), `completePeriodsOnly` = a column only once all rows of its period are loaded (growth bases, CAGR horizons, segment facts), `segmentLines` / `dimensionsText`). The statement pages = one statement select + `ViewButtons` (summary / detailed / presentation, default presentation; detailed + presentation are PRO: 403 `plan_required` = "Your plan does not include this view") + period buttons; as-reported adds "Reported only" and the display-sign select; "Load more" adds older periods (columns). `components/financials-presentation/types.ts` keeps `PresentationFact` / `TreeRow`; the raw node types are v2's (`is_total` snake_case, a standardized node by `metric_id`); `FinancialsStateNotice` (pending = "Statements / Metrics are being prepared", 404 `not_covered` = "No data for this company"). Segments: `/v1/segments` has no `segment_id` filter, so the segment picker filters the loaded rows (and says when it hid them all); CAGR asks `period=annual`; growth / CAGR values are fractions (0.12 = 12 %, `formatFractionPercentCompact`). O7 group 4 (backend `tasks/data-api-dashboard/1-overhaul` task 7): the statement tabs have an "As of" day and a "From filing" picker (`as_of` / `filing`, exclusive; the filings = the loaded periods' sources, `point-in-time.tsx` `filingChoices`) and `meta.point_in_time` as a banner with "Back to current"; every tab has the fiscal-year window (`FiscalYearRange`, `fiscal_year.gte` / `.lte`, a half-typed year sends nothing); in the standardized Detailed view a value is a button (no chart) opening "Explain this number" (`financials-presentation/fact-explain-dialog.tsx`: `/v1/facts/{id}` rule / formula / operands / source facts with their filing → SEC source panel + EDGAR folder, and "Show in filing" = the placed spots of `/v1/fact-places?fact=` → the panel's citation at the block; pure model `src/lib/financials/fact-explanation.ts`, free JSON read defensively: a derived value's operands name a raw fact by `id` (cik | concept | start | end, shown as concept · period by `factIdText`) with `weighted_value`, its source fact's value sits under `derived.value`, and `readableFormula` writes the formula's raw fact ids as concept · period); the Segments tab has Summary / Detailed (PRO `listSegmentsDetailed`, a `DataTable` with Export: concept, filing caption, unit, filing) and metric / axis selects sent to the API (options from the loaded rows; equal axis names keep their taxonomy prefix); CAGR has the period buttons (default annual) beside the horizon. Overview tiles add ownership (institutional, insider, short float: the API's `*_pct` are percent values), address, FIGI and listed / delisted (`CompanyFactTilesView`, no request). No Fama-French tile: the Data API removes `fama_sector` / `fama_industry` (always null; owner decision 2026-11-21), and nothing reads them, so an answer without them renders; `openapi.json` / `schema.d.ts` still list them until the next spec adoption. Tested in `src/lib/api/v2-financials-queries.test.tsx`, `src/routes/-tests/financials-v2-pages.test.tsx`; fixtures `src/lib/financials/v2-fixtures.ts` (tests only)
- v2 differences the pages absorb: no event selector (everything by `event_id`), no offset (cursor; the calendar and the company lists load by "Load more" / `useAutoLoadPages`), problem+json errors, transcript turns with a null `start_ms` (a company-published transcript: "no audio timings"), no `live_audio` / `as_of` on the live list (the live player always asks `/live-audio`, whose `disabled` status is the "no live audio" note; "started N min ago" counts from the answer's arrival), no participation flags vs the prior call (the Participants tab lists the speakers only), no `transcript_provider` / `current_version` (the newest published version is current), no `company` on the documents list (the name comes from `useCompanyDetails`)

### Earnings helpers (`src/lib/earnings/`)

- **documents.ts**: company documents (backend-earnings-calls ir-site-inventory task 15): `COMPANY_DOCUMENT_KINDS` / `IR_SECTION_KINDS` (copies of IDA `constants.ts` — the spec types `kind` / `section` as comma lists; change with IDA), `SECTION_LABELS` / `sectionLabel` / `documentKindLabel`, `validateDocumentsSearch` (the Documents route's `category` / `section` / `kind` / `year` and the text filter `q`, trimmed, empty = none; invalid → no filter), `ASSET_GROUP_CATEGORIES` / `CATEGORY_LABELS` / `categoryLabel` (the document tree's eight spine folders, a copy of IDA `asset-groups.ts`; change with IDA), `buildDocumentTree(documents, calls, query)` (category → path segments → documents, any depth, split on `group`; counts every descendant; categories in spine order, folders by `compareFolderKeys` = the pipeline's `compareGroupPaths`: dated newest first, named A–Z, `undated` last; documents not placed yet (`category` null) last as "Not yet placed", by IR section and year; in a folder the call rows first, then the API's order; a `query` keeps the matches of `matchesQuery` = title, kind label, folder path and labels, the full `group_label`, year, date — or of the folder's own label), `segmentLabel` (`fy2027` → FY2027, `q2` → Q2, `cy2026` → 2026, `faq` → FAQ, `09-10-<slug>` → "Sep 10 · Slug"), `folderLabel(path, docs, eventTitles)` (readable-event-folder-names task 4; every node, call-only folders too, from ALL its documents so a filter never changes a label: an event day folder reads "May 18 · <name>" = the stored name after " · " of a month-led `group_label` ("May 18, 2025 · GTC Taipei 2025", IDA `eventFolderDisplayLabel`), else the `event_title` of a document's event (`eventTitleMap` of the loaded events, passed as `buildDocumentTree`'s 4th argument), else the slug; every other folder only its own segment — "Q2", "2025", "Tax", never the parent's words), `callPlacement` / `callEntries` / `filterCallEntries` (one call row per event with a press release, slides or documents: the `group` of its loaded documents, else `earnings/fy<Y>/q<N>`, `earnings/cy<Y>/<MM-DD>` (`callCalendarDate`: a timed call's New York day, a date-only one's UTC date) or `events/<Y>`), `defaultOpenKeys` / `allKeys`, `documentHref` (the permanent public `url`, else `source_url` of a link-only row), `documentPageHref` (`#page=<n>` only on a `.pdf` path), `pagesOf` (the pages JSON `{ pages: [{ n, title, text }] }`); tested in `documents.test.ts`
- **format.ts**: `eventLabel` (an earnings call's fiscal period, a non-earnings event's `event_title`), pure `formatCallTime` (the viewer's browser timezone — never the company `tz`; 2nd arg overrides it for tests —, date only when `call_time_source` is null), `formatFiscalPeriod`, `dateStatusVariant` (Badge variant), `formatMs` (`m:ss` / `h:mm:ss`, = the admin console's `formatClock`), `zonedDate`, `callCalendarDate` / `isUpcoming` / `isCallToday` (the pipeline's `eventCalendarDate` rule: a date-only event's `scheduled_at` is midnight UTC of its calendar date — read it in UTC, never in `tz`; `formatCallTime` too; a timed call's date is read in `tz`), `calendarDefaultWindow` (yesterday … today + 14, New York days) / `calendarWindow` / `orderedWindow` (swap `from > to`), `formatStartedAgo`, `SESSION_LABELS`, `formatBytes`, `formatInstant` (timestamp with time, "—" when absent); tested in `format.test.ts`
- **media-timing.ts**: the live stream's URL refresh rules, ported from the admin console (`LIVE_STREAM_REFRESH_BEFORE_MS` 5 min, `urlNeedsRefresh`, `msUntilRefresh`; `formatClock` is `format.ts`' `formatMs`). Slides, the slide timeline, documents and audio are permanent public URLs (IDA 2625063, backend `tasks/data-api-stable-media-urls/`): rendered as answered, never refreshed; a failing image is the browser's broken image. **edgar.ts**: `edgarFolderUrl(cik, accession)`. **video.ts**: `VIDEO_PROVIDER_LABELS`, `httpsUrl` (https only, else null), `videoProvider(video)` / `videoProviderLabel` (v2's `video` has no `provider`: read from the `embed_url` / `url` host, null = another host), `videoEmbedSrc(video)` (`embed_url` + `autoplay=1` only when `embeddable` is not false AND the host is that provider's privacy-enhanced player — `www.youtube-nocookie.com` / `player.vimeo.com`; anything else is linked, never framed); tested. **transcript.ts**: `toTranscriptView(format, data)` (`TranscriptFormat` speakers / cleaned = `/transcript` turns (raw / cleaned layer; `start_ms` read defensively, null = untimed), text / sections = `/transcript-text` blocks through `textAnswerData`; sections carry `qa_start_ms`), `transcriptPlainText`, `speakerName`, `turnIndexAt` (the turn containing a position), `qaStartTurnIndex` (the first turn at / after `qa_start_ms`). **labels.ts**: metric / direction / period / basis / review / tone / role-group / participation labels (`metricLabel`, `DIRECTION_STYLES`, `roleGroup`: `executive` + `ir_host` = management, `participationKindLabel`, `participationDetailText`), `percent` (0–1 share), `formatDecimal`, `formatSigned`, `formatGuidanceValue` / `formatGuidanceRange` (`usd` / `pct` / `shares` units), `highlightTerms(text, query)` (plain string scan, never a regex from the query). All tested. **scroll-to-turn.ts**: `scrollToTurn(ms, timeoutMs)` scrolls / flashes the Transcript tab's `[data-start-ms]` turn containing `ms`, polling briefly for it; false = no timed turn (DOM, untested)

### Earnings pages (`src/routes/$ticker/earnings-calls/`, `earnings-calendar/`)

- `-components/`: shared pieces — `availability-icons` (the five `has_*` flags; "not available" never says why), `call-status-badge` (`DATE_STATUS_LABELS` Title Case + Live / Published; the calendar shows ONE badge per row, `CalendarRowStatus` in `calendar-semantics`, the other dimensions in its tooltip), `call-time` ("date only" caption), `event-link` (→ `/$ticker/earnings-calls/$eventId` under the call's own symbol), `webcast-link`, `event-video` (`EventVideoLink`: the calendar's video icon → the call page, beside `WebcastLink`), `live-now-strip` (`/live`, "Live audio" badge from `live_audio`; the calendar shows every live event, the calls list `LiveNowStrip ticker=` only that company's — nothing, not even an error note, while it has none), `live-dot` (the pulsing live dot), `calendar-filters` (`validateCalendarSearch`: every search field optional, invalid values fall back, `from > to` swapped; event type omitted = the API's default `earnings_call`, "All events" = `type=all`; `dateKind` = v2 date certainty (`confirmed` | `estimated` → `date_kind`, omitted = any); `session` and `calendarStatus` have no `/v1/events` parameter: `matchesCalendarSearch` filters the loaded rows), `calendar-semantics` (the per-event `calendar`: `CalendarCallCell` = call time + time quality / source / zone, or "No call" for a report-only event; `CalendarReportCell` = report day + BMO / AMC / exact / unknown + the results filing; `CalendarStatusBadge`; tested in `src/routes/-tests/calendar-semantics.test.tsx`), `event-type-badge` (the type of a non-earnings event; calendar, company calls — asked with `type=all` — and the call header)
- The calendar is the market calendar: `/v1/events` without `company`, `expand=calendar`, the New York day window as `scheduled_at.gte|lte` (≤ 92 days without a company, else a 400); every status (no `status` = cancelled too); `now` is taken once per mount with a lazy `useState` initializer. The calls list asks `company=<ticker>&type=all&sort=-scheduled_at`

### Documents page (`src/routes/$ticker/documents/`)

- Nav item "Documents" (backend-earnings-calls ir-site-inventory task 15). `?category=&section=&kind=&year=&q=` (`validateDocumentsSearch`) → `useV2InvestorDocumentsInfinite({ company, category, kind, fiscalYear })` (the IR library and every call's documents, `source: "company" | "call"`, 200 per page; `section` has no v2 parameter: it filters the loaded rows) and `useV2EventsInfinite({ company, type: "all" })` (200 per page; feeds the call rows). Both lists load every page by themselves (`useAutoLoadPages` without `max`, `src/lib/api/use-auto-load-pages.ts`; the API has no totals): the header counts the loaded documents and adds "+" while either has a next page
- `-components/document-tree.tsx`: the nested tree of `buildDocumentTree` (data-api-document-tree-sync task 3; a document / call row is one line from `sm` up and wraps below it, its date + actions on their own right-aligned line — at 390 px the ~250 px actions column scrolled the page sideways until 2026-11-21; own collapsible list, toggles keyed by the full path; every category open with its newest folder at each level; under `?q=` every folder holding a match is open and the user's toggles wait until it is cleared). Call row = "Call" badge, the event label + New York date (→ call page), `AvailabilityIcons`, links to the call's Press release / Slides / Documents tabs (only those it has). Document rows = kind badge, a "Call" badge (→ the call's Documents tab) on a call document — except a call's `sec_filing` link, which gets a muted "Call" action instead (no call material) —, title, date (`documentDate`: a `sec_filing` row = its EDGAR `filing_date`, else its fiscal period, never the call's `event_date`; IDA backend earnings drizzle 0096), size (no page count: v2 lists none), "Event" (an IR-library row with an event → call page `?tab=documents`), "Open" (the public `url`, `rel="noopener noreferrer"`) or "Open page" for a link-only row (`url` null: a webcast replay page, `link_status` expired → badge), "Show text" only when `pages_url` exists (a `text_pending` file and a call document have none). No URL refresh: every `url` / `pages_url` is permanent
- `-components/document-filters.tsx`: the text filter (written to `?q=` 200 ms after the last keystroke, replacing the history entry; client-side over the loaded tree) beside the API's Category / Section / Kind / Year filters (a section or kind filter hides the call rows; category / year keep the calls of that folder / fiscal year)
- `-components/document-text.tsx`: "Show text" dialog = `useV2InvestorDocument(id, { pages: true })` → `pages[]` per page (`pagesOf` reads the array); a file over 2 MB has no inline pages → a link to the public `pages_url`
- `-components/document-search.tsx`: `DocumentSearch({ identifier })` (`/v1/search/investor-documents?company=`, one page of ≤ 20, submit-only; mode chips Keyword (`lexical`, default) / Exact (`literal`, the API's case-sensitive default: v2 has no case switch and no source filter) — `SEARCH_MODES`, a keyword search needs every word — a chip re-runs the submitted query; a 400 under Exact → "Exact search needs 3 characters or a company") and the pure `DocumentSearchResults` (tested): lead "Passages from company-published documents, not verified facts."; every hit names its document, year and page and opens the file at `#page=<n>` (PDF); `SearchError` / `HitPassage` / `MatchBadge` (the relevance in its tooltip) / `SearchCoverageNote` / `SearchEmptyState` are `ask-this-call.tsx`'s
- The calls list's search box toggles Transcripts (`AskThisCall`) | Documents (`DocumentSearch`). Component tests: `src/routes/-tests/documents-page.test.tsx`, `document-search.test.tsx`

### News page (`src/routes/$ticker/news/`)

- **v2 (backend tasks/data-api-v2 task 8)**: the list is `GET /v1/news?company=<ticker>` (`getV2News` / `useNewsPage`: `kind`, `topic`, the `from` / `to` UTC days as `published_at.gte` / `published_at.lt` of the next midnight — `dayStartInstant`; keyset `next_cursor`); the panel is `GET /v1/news/{id}` (`useNewsItem`, the list row), `GET /v1/news/{id}/text` (`useNewsText`; `getV2NewsText` follows `next_cursor` and joins every page's blocks) and `GET /v1/announcements?item=` (`useNewsAnnouncements`, the v1 developments). v2 has no market-wide feed: decision 15 requires `company=` on every list, so dropping the "Whole market" view is accepted (lead, 2026-11-09) — the scope switch is gone and `?scope=market` reads the company. Source, earnings and Company-published (+ its publication type / category / tag) have no `/v1/news` parameter: `matchesNewsFilters` filters the loaded page, so a page can show fewer than 50 rows; the page then says how many it hid, and a page whose every row was hidden says so with a "Load the next page" button while `next_cursor` is set (never an empty-looking list). The summary renders from the blocks as React elements (`summary-body.tsx`: heading / paragraph / list, bullets dropped — no HTML injected; `summary-html.ts` is no longer used by the panel). The branded PDF comes from the v2 item's `pdf` (owner decision 2026-11-09; `PdfDocumentSection`, hidden when null). Not in the v2 contract, so not shown (lead decision G4): sightings, companies, `source_words` and `superseded_by` (a correction shows a notice from `supersedes_id`); no empty section. The live toggle subscribes the channel `news` on `WS /v1/stream`. The bullets below describe the v1 page where they differ

- Nav item "News" after "Documents" (backend earnings `tasks/inhouse-news-pipeline` task 17). `?scope=&published=&source=&kind=&topic=&earnings=&pubType=&category=&tag=&from=&to=&item=&live=` (`validateNewsSearch` in `src/lib/news/labels.ts`: invalid → none; `published`, `pubType`, `category`, `tag` only in the company scope, `category` / `tag` only with `published` — the API needs exactly one publisher). `useNewsPage` → `GET /v1/news` (FREE), one page per KEYSET cursor (`cursor` in the query key, `null` = page 1). Pager (owner 2026-11-01): `-components/news-pager.tsx` Previous / "Page N" / Next CENTRED UNDER the table (no load-more, no infinite scroll; hidden while there is one page), over the visited-cursor stack of the pure `src/lib/news/pager.ts` (Next pushes the page's `next_cursor`, Previous pops it and reads the cached page; the stack is bound to a key of every filter + `from` / `to`, so any change starts at page 1); live items join page 1 only. The date inputs stay empty by default: without `from` / `to` the API pages back through the whole news history (IDA history mode), with them the same pager walks that ≤ 92-day range. `scope=market` drops `ticker`; "Company-published" sends `publisher=<CIK>` (the company's verified newsroom publications, from `useCompanyDetails`) INSTEAD of the ticker. No wire items exist (owner 2026-10-28): sources are `edgar` / `ir:<host>` (`sourceLabel`). Value sets (`NEWS_KIND_LABELS`, topics, publication types, claim statuses) mirror IDA `src/lib/news/constants.ts` No media filter or column since API 2.0.0 (backend earnings `tasks/X-inhouse-news-summaries-2026-11-07` task 5: the API serves no images or files)
- `-components/news-table.tsx` (headline → `?item=`, "Published by <issuer>" = `publishedBy` = the item's `publications`, never a mentioned company; else "By <attribution.publisher>"), `news-filters.tsx` (reuses `FilterSelect` of `calendar-filters.tsx`; categories / tags = the publisher's labels in the loaded items, `issuerLabels`), `news-item-panel.tsx` (`useNewsItem`, STANDARD, default detail `staleTime`; `NewsItemView` pure; dialog subtitle "Invinite's summary of the announcement"). Since API 2.0.0 (backend earnings `tasks/X-inhouse-news-summaries-2026-11-07`, owner 2026-11-07) the API serves Invinite's LLM summary of every publication, never the publisher's text or media; the panel renders, in order: the header (kind / earnings / source / "Published by" badges, `superseded_by` notice) and `AttributionBlock` — the D26 reference rendering (publisher + host, published, source link, EDGAR form · accession, the API's `statement` "Summary written by Invinite …" + "© <publisher>" for `rights: issuer`) — → the lede (`description`, the LLM lede; `data-testid="news-lede"`) → `-components/summary-body.tsx` `SummaryBody` (with "Summary by Invinite · N of M words" from `summary_words` / `source_words`) = `summary_html` sanitized AGAIN in the browser (`src/lib/news/summary-html.ts` `prepareSummaryHtml`: a DOMPurify instance, tags `h2, p, ul, li, strong, em` only, NO attributes — the API emits none; no DOM / SSR → the text) in `@tailwindcss/typography` `prose`, else `summary_text` as paragraphs (`paragraphs` in `src/lib/utils.ts`, shared with the press-release tab) → "AI-extracted developments" (claim status badge — "Planned" stands out; no `evidence` quotes: the API dropped them) → the branded PDF (`PdfDocumentSection`, `data.pdf`) → "Seen on" (`sightings`). Without a summary (`content_status: no_text`: published before summaries started, metadata-only or a reserved source): "Headline and link only" + "Open at source" (never an empty block or a fetched teaser). 404 / plan gate are states. Never re-add a publisher-text field, an image / file row or a media filter
- Live (`LiveToggle` of `src/components/live/live-toggle.tsx`, `?live=true`, default off): `src/lib/live/use-live-news.ts` opens its own `liveWsUrl` socket (the stored key; never logged) and subscribes `newsSubscribeFrame` (`channel: "news"`, `tickers: [ticker]`, none in the market scope; kinds / sources / `earnings_only` from the filters); `news_item` frames (`parseNewsFrame` in `ws-frames.ts`, mirroring IDA `types/newsMessages.ts`: told apart from earnings frames by `channel: "news"`; the stream renames the registry's `news.live` both ways, IDA `src/lib/v1/stream.ts`) are re-checked with `matchesNewsFilters` (topic, publisher, publication type, category, tag, `earnings=false` are not socket filters) and merged on top by `mergeLiveItems` (one per id, marked "New"). `forbidden_tier` / close 4003 → STANDARD plan notice, `channel_unavailable` → "not enabled", close 4029 → "Live feed unavailable: connection limit", 4001 / `bad_message` → error: each STOPS (no reconnect loop) and turns the switch off; other closes reconnect 1 s → 30 s × 10, `unavailable` re-subscribes after 10 s, and a re-subscribe refetches the list (missed items are not replayed)
- Tests: `src/routes/-tests/news-page.test.tsx` (`NewsPageView`, `NewsItemView`), `src/lib/news/labels.test.ts`, `src/lib/news/pager.test.ts`, the news cases of `ws-frames.test.ts`; fixtures `src/lib/news/news-fixtures.ts` (tests only)
- **O7 group 2 (backend `tasks/data-api-dashboard` task 7, 2026-11-21)**: the page has tabs News | Announcements (`?view=announcements`) and the shared list logic lives in `-components/use-news-list.ts` (`useNewsList`: pager, page-side filters, live merge; used by `/news-feed` too). News: a search box (`news-search.tsx` `NewsSearchBox` → `GET /v1/search/news`, STANDARD, 10 credits a page, `useV2NewsSearchInfinite`; submit-only, Keyword / Exact chips, field any / title / lede / summary, the page's day window, "More results" by cursor; hits in the shared layout — `MatchBadge` with the relevance in its tooltip, "Headline" / "Lede" / "Summary · <block heading>", `HitPassage` — the headline opens `?item=`; 503 `unavailable` "News search is not enabled" on prod 2026-11-21, `[FU2995]`), `?sort=oldest` (→ `sort=published_at`; Live clears it, it clears Live: live items join the newest-first list only) and `?event=<event id>` (`news-event-filter.tsx`: "Filter by call" asks the company's 20 newest events, `type=all`, only on that click or with `?event=` set). The page-side filters auto-advance the pager while a page shows no row (`shouldFillPage`, ≤ 10 pages per filter change, paused by Previous; the hidden line names the skipped pages). Export = the shown page (`ExportMenu` without "load all": the pager). Announcements (`announcements.tsx`, `AnnouncementsView` in a `DataTable` + export, `useV2AnnouncementsInfinite` → `GET /v1/announcements?company=`, STANDARD, 2 credits a page): `?aTopic=&aFrom=&aTo=&effFrom=&effTo=&aSort=oldest` → `topic`, `announced_at.gte|lt`, `effective_from.gte`, `effective_to.lte`, `sort`; columns announced, title + summary (model-derived, said once above the table) + named products / counterparties, topic, claim status (confidence in the tooltip), effective range with `date_precision` (`effectiveLabel`) and the stated text, the news item (`?item=` panel). v2's `source.id` is `edgar` | `ir` with the host in `source.host` (live 2026-11-21; the v1 `ir:<host>` id stays readable): `sourceLabel(source)` and the source filter read both. The press-release tab links its archival item (`news_id` → `/$ticker/news?item=`)
- **`/news-feed`** (`src/routes/news-feed.tsx`, `BROWSE_NAV` "News feed"): `GET /v1/news` refuses a list without `company` or `event` (400 `invalid_parameter`, documented "one of the scope filters is required"; `req_01M7ZBPES0JQRY488JS45XZJ7N`), but `company` takes a comma list of 1–50 merged by `published_at` (one request, 1 credit; a fund in the list is dropped, an unknown ticker 404s the request). So scope "Watchlist" = up to 20 tickers kept in this browser (`src/lib/news/watchlist.ts`, `localStorage` `invinite.news-watchlist`, try/catch, read after mount) read as ONE `company=<list>` per keyset page with the News page's pager, filters (no Company-published), export and live switch (`tickers: [...]`) — not a per-ticker fan-out; scope "Whole market · live" (`?scope=market`) = the `news` channel without tickers only, since Live was switched on (no window / order: nothing is listed) and the search box without a company (`/v1/search/news` takes none). `?scope=&kind=&topic=&source=&earnings=&from=&to=&sort=&live=&item=` (`validateNewsFeedSearch`). Tests: `news-feed.test.tsx`, `use-news-list.test.tsx` (auto-advance), `news-search.test.tsx`, `announcements.test.tsx`, `press-release-tab.test.tsx`, `src/lib/news/watchlist.test.ts`, `src/lib/api/news-queries.test.tsx`

### Call page (`src/routes/$ticker/earnings-calls/$eventId/`)

- Non-earnings events (investor day, conference, AGM): the calls list asks `/events` with `event_type=all` and labels rows with `eventLabel` (title) + `EventTypeBadge` (calendar too); the header names the title and, with audio or a transcript, "Recorded from the company's public webcast."; `call-tabs.tsx` HIDES the flagged tabs (`has_*: false`) of such an event (an earnings call keeps them muted), the transcript-derived ones included

- Branded PDFs (backend inhouse-pdf-documents task 5): `src/components/pdf/pdf-inline-viewer.tsx`. `PdfInlineViewer` is the ONE browser-native inline view (the slides keep `pdf-viewer.tsx`); `PdfDocumentSection` = size + pages, View, a new tab, Download (`savePublicFile`: fetch to a blob, a new tab when the storage domain sends no CORS header for this origin), hidden when `pdf` is null. Transcript tab: the picked version's `pdf` from `/transcript/versions`, opened from its Download menu ("View PDF" = `PdfInlineViewer` in a dialog, "PDF" = `savePublicFile`; no permanent row since O3); news panel: `data.pdf` (`PdfDocumentSection`). The URL is permanent and public, no refresh
- Transcript tab: `qa_start_ms` (top level of every format; sections also in `data`) → "Q&A starts at m:ss" (`QaStart`, a seek button) in the meta line, on the Sections' Q&A header and as a Q&A divider above the first Q&A turn of Speakers / Cleaned
- URL state (O6-final, `-components/call-search.ts` `callSearchSchema`, every field optional, an invalid value → its default): `?tab=` (unknown → transcript; values `CALL_TAB_VALUES` in `-components/call-tabs.tsx`), `?format=` (`speakers` default, never written | `sections` | `cleaned` | `text`) and `?version=` (a published version; the transcript is asked only once the versions list is in — an unlisted version would be a wasted request —, one the list does not name or the newest one reads as the current one, so the player's words query is not doubled; a failed list asks the link's version as it is) — the Transcript tab reads both from the URL (`CallTabProps.search` / `onSearchChange`, written `IN_PLACE`) —, `?t=<seconds>` (a moment of the call). `?t=` on a call with a recording: the Transcript tab opens at that turn (`TranscriptJump.fromLink`: the URL's format is kept — Sections / Plain text just open at the top — and nothing is announced) and the player's Play button reads "Play from m:ss" (`CallAudioProvider` `startAtMs`, read once at mount): `/audio` is STILL never asked for on page load (a pro operation), the first Play asks for it and starts there; any other seek (a timestamp, a search hit) disarms it. On a call without a recording at load (a live call, a missed capture) `?t=` is ignored: no scroll (the live text is not the final transcript), "Tune in" / "From the beginning" as always, and the live → recording switch keeps the live position. The recording's `⋯` menu has "Copy link at current time" (whole seconds of the element; `copyCallLinkAt` writes `?t=` into the address bar first, then copies the page URL — `callLinkAt` —; without clipboard access the link is still in the address bar); the live bar has none (a live position is not a moment a link can reopen before the recording is out). The header shows the event id with its copy button. The page is keyed by `eventId`; `$ticker` is informational (a symbol mismatch still renders); an invalid id or a 404 → `NotFound`
- `call-tabs.tsx`: `CALL_TABS` (label, `has_*` flag, render) — only the active panel is mounted, so an unselected tab sends no request; a `has_*: false` tab shows a muted label and "Not available for this call" (`has_transcript: false` → `NoTranscriptNotice`, "No transcript yet" + why: not transcribed, or no recording for a `missed` / `expired` capture). Add a tab there. The transcript-derived tabs (`tabs/guidance-tab` → `guidance-table` / `kpi-table` / `guidance-history-panel`, `qa-tab`, `participants-tab`, `metrics-diff-tab`, `prosody-tab`) carry `has_transcript`; a transcribed but underived call shows each tab's empty state; a 404 that still arrives renders the same title through `MediaState`'s `notFound`, and the guidance / KPI / Q&A / participants hooks pass `quietStatuses: [404]` (no toast; any other error still toasts). `price-attribution-tab` has no flag (its own 404 state). Guidance (`/v1/guidance?event=`, `review=any`) "needs review" filters the loaded rows; the history dialog (`/v1/guidance?company=&metric=&period_kind=&basis=`, every page) is scoped to the clicked item's period kind + basis and opens only for an item with a `metric_normalized`. Every tab gets `eventId` (`CallTabProps`)
- "Price moves" (`?tab=price-moves`, `tabs/price-attribution-tab.tsx`, `useV2PriceAttribution` → `GET /v1/events/{event_id}/price-attribution`): the coincidence sentence as lead text (temporal coincidence, not attribution of cause), anchor facts (anchor kind, lag, uncertainty, market session, bar count, end-of-window return), the largest minute moves with their utterances, a cumulative-return line (`ChartFrame` from `src/components/charts/chart-parts.tsx`, the shared recharts plumbing of both price charts) and the bucket table (minute in New York time, return / cumulative in bps, utterance refs as `SeekButton`s). Derived returns only — the response has no price or volume field and the tab shows none. `404 price_attribution_unavailable` (no minute row yet) → `Notice`. While the call is live (`live: true`, `settled: false`, live-price-feed task 9) the answer holds the minute rows so far with a null summary: a "Live — minute rows so far, not settled" `Notice`, no anchor facts (`hasSummary`) and no top minutes; `PriceAttributionTab` passes `{ live: isEarningsEventLiveish(event) }` → `useV2PriceAttribution` refetches every 60 s (same query key as the live player's seed). `PriceAttributionView` (data / error / isLoading) is the pure body, tested in `src/routes/-tests/price-attribution-tab.test.tsx`
- Documents tab (`tabs/documents-tab.tsx`, `GET /v1/investor-documents?event=`, every page; "Show text" = the member route's `body_text`): the call material in one table (kind chips filter; no Pages column); the call's `sec_filing` links apart under a "Filings" heading (`FilingsTable`: title, EDGAR `filing_date`, accession, "EDGAR" → `source_url`). Tested in `src/routes/-tests/documents-tab.test.tsx`
- **Call player** (backend `tasks/data-api-dashboard` O2, owner 2026-11-21: own bar, one player, controls by state): `-components/player/call-player.tsx` `CallPlayer` is THE player — one bar between `AskThisCall` and the tab bar on every tab, sticky on `STICKY_TOP_CLASS` (below the pinned ticker header), compact once pinned (`data-compact`: tighter padding, one cycling speed button, no volume slider; the caption line stays). It renders from `engine.state` + `engine.capabilities` only and imports no engine (a test asserts it): `idle` = "Play the recording" (`playLabel`; "Play from m:ss" for a `?t=` link — the first play requests the media), `loading`, `error` = `MediaState` inline, media states = play / pause, `PlayerTime` + `SeekBar` (`seek-bar.tsx`: `role="slider"` + `aria-valuetext`, buffered range, hover time, `markers` `{ ms, label }`, ← / → 5 s, Shift 15 s, Home / End; a drag seeks on release with `{ play: false }`), ±15 s (`skip`), 1× / 1.5× / 2× (`rate`; remembered per browser, `PLAYER_RATE_STORAGE_KEY`, guarded), mute + level, Follow, download (`download` capability + a `download` prop) and the `⋯` details menu (`player-controls.tsx`). Page shortcuts (window keydown, never in an input / on a button / slider / menu item): Space play / pause, J / L ∓15 s. What is media-specific comes in as props (`caption`, `details` + `detailsNote` — the recording's one line "Permanent link; the file carries a forensic watermark." —, `download`, `markers`, `menu` — the recording's "Copy link at current time" —, `playLabel`): `player/recording-player.tsx` `RecordingPlayer` wires the recording's (`CaptionLine`, the Q&A start = the words transcript's `qa_start_ms` once that is in, the file facts, the download `savePublicFile(url, "<SYMBOL>-<Q3-FY2026>-call.<ext>")`: blob save, a new tab when the storage sends no CORS header; never proxied) and renders nothing without `has_audio` (unless a search hit plays). No Audio tab: `CALL_TAB_VALUES` has no `audio`, so an old `?tab=audio` falls back to the transcript (`.catch(undefined)`) and requests nothing
- **Engine contract** (`src/lib/player/`): `engine.ts` `PlayerEngine` (`state` idle / loading / recording / live-edge / live-behind / ended / error, `positionMs` at the last state event, `endMs`, `behindMs`, `paused`, `buffering`, `rate`, `volume`, `muted`, `capabilities { download, rate, skip }`, `play` (from idle it starts the lazy request), `pause`, `seekMs(ms, { play? })` (always callable: before the media is in it queues the seek and requests; default plays), `skip`, `setRate` (also `defaultPlaybackRate`, so a swapped source keeps it), `setVolume`, `jumpToLive?`, `error`), `engineHasMedia(state)`. `player-context.tsx`: `CallPlayerProvider` / `usePlayer()` = `{ engine, canSeek, follow, setFollow, mediaRef }` (slow fields + actions; `canSeek` = the call has something a timestamp can play — never "is it loaded"; `follow` default on, not persisted, the Follow button toggles it, `useFollowScroll` reads and clears it) and `usePlayerPosition()` (`usePlaybackPosition` of `src/lib/earnings/use-playback-position.ts` on `mediaRef`: media events + a rAF loop while playing, `bufferedMs` too) — subscribed by each per-frame reader (seek bar, time, caption line, `PlaybackTurns`, `SlideTimeline`), never by a provider. `file-engine.ts` `useFileEngine` (tested in `file-engine.test.ts`) is the finished recording: imperative src, `pendingSeekRef`, a changed recording URL swaps in at the same position / rate / play state, a search hit (`PlayedUrl`) replaces the source and plays from its `#t=`. O4 adds the HLS engine behind the same contract
- Audio host (`audio-context.tsx`): `CallAudioProvider` runs `useFileEngine` on the page's ONE `<audio>` (rendered hidden by the provider, no `controls`), provides it through `CallPlayerProvider`, and keeps the recording's own data in `useCallAudio()` (`audio` query, `recording`, `words` / `wordTurns`, `loaded`, `playedUrl` / `playUrl`, `canSeek`, `seekMs`). `/audio` is requested on the first play or timestamp click (`requested`; never on page load — an empty id keeps the query idle). Every `SeekButton` (`seek-button.tsx`: button with `canSeek`, text without, nothing for a null `start_ms`) calls `usePlayer().engine.seekMs`. `/audio` answers the recording's PERMANENT public URL (one forensic watermark per call, no `expires_at`, no polling — a call without a servable recording is the `403 forbidden` notice). Tests: `src/routes/-tests/call-player.test.tsx` (state → controls, keyboard, Follow, the lazy request, no bar without audio)
- **One turn layout** (backend `tasks/data-api-dashboard` O3): `-components/transcript/turn-block.tsx` `TurnBlock` is THE turn of the call page — Transcript tab, Q&A tab, and its header (`TurnHeader`: round image / initials, name, title · firm, the ▷ m:ss `SeekButton`, a badge, `coSpeakers` for a Q&A answer given by several executives; a `timestamp` slot — given, even `null`, it replaces the `SeekButton` — for the search hits, which may sit outside any player provider) on every search hit. `state` idle / spoken / active / upcoming + `activeWord`: while the audio PLAYS the heard turn has a soft background, its spoken word is marked, said text is full colour and everything after the playhead faded (`text-muted-foreground/40`); paused or nothing loaded = `idle`, nothing faded. A word click seeks to that word (delegated on the paragraph, `data-ms`). Memoised (`React.memo`): only turns whose state / active word changes re-render. `transcript/playback-turns.tsx` `PlaybackTurns` is the ONE playback subscriber of a list (it replaced `ActiveTurnBridge` and `FollowAlong`): `usePlayerPosition()` per frame → `heardSegment` / `segmentState` / `indexAt` (pure, `src/lib/earnings/follow-along.ts`, tested) over its `segments` (`{ startMs, endMs?, words }`; a Q&A block ends at its `*_end_ms`, a transcript turn at the next start; an untimed turn is always `idle`), published through a memoised context so `PlaybackTurnBlock`s re-render at word rate, never at frame rate. Words: the Transcript tab's Speakers format asks `/transcript?include=words` (`timedWordsOfTurns(toWordTurns(…))`); for the current version that is the very query (same key, ONE request) the provider asks once a recording is loaded (`useCallAudio().words` / `wordTurns`: caption line, Q&A, the Q&A marker). Checked against the live API 2026-11-21: `version=<n>&include=words` answers words (an older version is highlighted word by word too; version 1 is an unlisted pipeline step, 404), `layer=cleaned&include=words` answers 200 with every `words: []` — so Cleaned is asked without words and gets the turn-level state only (`timedWordsOf` would otherwise spread the text evenly and invent timings); Sections / Plain text have no turns. Untimed transcripts: no timestamps, no highlight, the "Company-published transcript (no audio timings)" line. Q&A tab: question and answer are `TurnBlock`s ("Question" / "Follow-up" / "Answer" badges), their words cut from the provider's words transcript by `question_start_ms` … `question_end_ms` / `answer_start_ms` … `answer_end_ms` (`wordsBetween`, `qaSegments`; plain text until a recording is loaded); the raw `person_id` is kept on the speaker (`personId`, task 7's person link), never printed; `useV2QaInfinite` sends `include=scores` → `QaScoreBadges` (Difficulty / Evasiveness 0–1, Non-answer · kind, Tone when not null) opening the evidence quotes, the casting order and `scored_by` (a `DropdownMenu` as the popover, like the player's `⋯`); `scores: null` renders nothing. **Follow** (`src/lib/player/use-follow-scroll.ts` `useFollowScroll({ activeIndex, containerRef, block?, enabled? })`, called by `PlaybackTurns` and `SlideTimeline`): while the player's `follow` is on AND the audio plays, the DOCUMENT scrolls the `[data-follow-index]` element into view (`block: "center"`, `FOLLOW_SCROLL_MARGIN_CLASS` = `scroll-margin-top` below the pinned bars + player) — in a timed turn it follows the heard WORD instead (`activeWord` → `[data-word-index]`, `followWordDelta`: its line kept between 10 % and 65 % of the area under the pinned bars, brought back to 30 % once it leaves, so a long turn is followed line by line); a `wheel` / `touchmove` (not on a slider — a seek-bar drag on a touch screen — nor inside an open menu / list / dialog) / scroll key (PageUp / PageDown / arrows / Home / End — not Space, the player's; not inside a slider / input / select / menu / dialog / tab list) on `window` switches it off, the player's Follow button back on; a programmatic scroll ("Jump to transcript") never does. Only the open tab is mounted, so only its list follows. Toolbar (`transcript/transcript-toolbar.tsx` `TranscriptToolbar`, one row): format switch · version select · Compare · `⤓ Download` (View PDF / PDF / Plain text (`transcriptPlainText`) / JSON of the shown answer / the recording — `savePublicFile`, enabled once the recording is loaded) · Copy; a muted stats line (`kind · N words · published … · Q&A starts at ▷ m:ss`). Filenames `callFileName` / `callFileStem` (`src/lib/download.ts`: `saveBlob` — the object URL is revoked a minute after the click, never at once —, `saveTextFile`, `saveJsonFile`, `savePublicFile` — `src/lib/news/download.ts` re-exports it): `<SYMBOL>-<Q3-FY2027>-transcript-v<n>.<ext>`, the recording `…-call.<ext>`. `caption-line.tsx` (`CaptionLine`, a port of the admin console's `CallCaptionLine.tsx`, the player's last row): one gliding row, the spoken word centred (transform, chunked window). Tests: `src/routes/-tests/transcript-layout.test.tsx` (states, paused = no fading, word click, one words request, Q&A slicing + scores, follow off on scroll), `src/lib/earnings/follow-along.test.ts`
- Event video (backend inhouse-event-video task 5): `-components/event-video.tsx` `EventVideoSlot` (page, under `LivePlayerSlot`) → `EventVideo({ video })` for the event's `video` (served whatever the capture / date status). Embeddable (`embeddable` not false, `videoEmbedSrc` non-null): a click-to-load facade — a neutral placeholder (never `thumbnail_url`: nothing reaches the platform before the click, GDPR), title, provider, play button — and only the click creates the `<iframe>` (`allow="autoplay; encrypted-media; picture-in-picture; fullscreen"`, `referrerPolicy="strict-origin-when-cross-origin"`: YouTube refuses an embed without a referrer, error 153). Not embeddable: "Watch on YouTube / Vimeo" (`rel="noopener noreferrer"`). Note "Played from the company's … channel". While `capture_status === "capturing"` the live player stays primary and the video waits under a "Watch the broadcast" disclosure. No CSP is set anywhere in this app (no headers in `netlify.toml`, no meta, no server header); adding one needs `frame-src https://www.youtube-nocookie.com https://player.vimeo.com` and the R2 media hosts (no `i.ytimg.com` / `i.vimeocdn.com`: thumbnails are not shown). Tests `src/routes/-tests/event-video.test.tsx`
- Slide timeline: the Slides tab shows `SlideTimeline` (`-components/slide-timeline.tsx`) above the deck when `/slides` answers a non-empty `timeline` (a missing field = `[]`, so an older API never breaks the tab) (player screenshots, `at_ms` on the clock of the recording `/audio` serves). With a recording loaded it follows `usePlayerPosition()` (the last `at_ms` ≤ position, `indexAt` binary search), prev / next seek the audio; while the audio plays the slide on screen is marked ("At the playhead") and, with Follow on, kept in view (`useFollowScroll`, `block: "nearest"`); its timestamp is a `SeekButton`; the Slides tab publishes the timeline as the seek bar's markers ("Slide N", `useCallAudio().setSlideMarkers`, merged by `RecordingPlayer`; never requested for the markers alone, kept when the tab closes); a click on the slide `seekMs`es (the first click loads the recording); without `has_audio` a plain carousel. Images are permanent public URLs, like the page images (no refetch). Tests `src/routes/-tests/slide-timeline.test.tsx`
- Speaker images (backend speaker images, the transcript PDF's rule): `src/components/earnings/speaker-avatar.tsx` `SpeakerAvatar` = the participation's `image_url` (photo / company or firm logo, permanent public URL) as a full circle (`object-cover`), else an initials disc (`src/lib/earnings/initials.ts` `initialsOf`, the PDF's `initialsOf` over `nameKey`: honorifics, suffixes, middle initials off; tested), a failing image = initials; no name or the operator = nothing, no reserved space. Shown in the Participants tab's Name column, on every Speakers / Cleaned transcript turn and beside the Q&A tab's analyst and each answerer (`TranscriptTab` for the turn formats and `QaTab` ask `/v1/participants?event=` → `useSpeakerImages` in `transcript-turns.tsx`, by `speaker_label`; the search hits by name, `useSpeakerImagesByName`). `image_url` is null until images are published
- `media-state.tsx`: `MediaState` (= `RequestErrorState` with `MEDIA_CODES`) renders 403 `forbidden` (audio: unlicensed, or the recording is not ready yet) / 503 `unavailable` / the plan gate (403 `plan_required`, checked first) / a 404 (only with `notFound`) as a `Notice`, anything else as `ErrorState`
- `ask-this-call.tsx`: `AskThisCall({ scope })` — `event` (call page, above the tab bar: "Play from here" — and the hit header's ▷ m:ss — seeks the loaded recording or `playUrl`s the hit AND jumps the transcript to it (`onJumpToTranscript(ms, { quiet: true })`: no notice for a call without a transcript), then the results collapse; without audio "Jump to transcript" = tab switch + a `TranscriptJump` `{ ms, nonce }` the page hands the Transcript tab through `CallTabProps.transcriptJump`: once its answer is in, Sections / Plain text / a 404 cleaned layer switch to Speakers, then `scrollToTurn`; an untimed transcript or a passage not found → a `toast.info` notice, never silence; `onTranscriptJumpHandled` clears it) or `company` (the calls list: hits link to their call, audio / slide open in a new tab). UI title "Search this call" (input label; placeholder `e.g. gross margin, data center revenue, "free cash flow"`): sends `mode: "lexical"` (keywords, no mode control; scoped by `event_id` / `identifier`, any word may match, BM25, and the management answer follows a matched analyst question). Runs on submit; a type chip re-runs the submitted query; `text-xs/relaxed`; a results header ("8 results for “gross margin”", a real button with `aria-expanded`) collapses / expands the list and stays, × clears; each hit's header is `TurnHeader` (avatar by speaker NAME from `/v1/participants?event=`, the Transcript tab's cached query, else initials; none on the calls list); 429 / 503 `unavailable` (search off or down) / plan gate / 400 (the API's message) render as notices; the answer is v2's one page (`data`, `meta.index`, `meta.query`; the score per hit's `match.type`). Shared with document search (backend inhouse-search-modes task 5): `HitPassage` marks the server's `match.spans` (`SpanHighlightedText`, code-point offsets → `highlightSpans` in `labels.ts`, `Array.from`), else guesses the query terms (`HighlightedText`: a hit with empty `spans`, e.g. the attached answer); `MatchBadge` (keyword / exact; with `score` the 4-decimal relevance goes into its tooltip — the transcript hits since O3, nothing visible); (no visible score anywhere since O7 group 5: the document hits pass `score` to `MatchBadge` too); `SearchCoverageNote` knows three reasons (`lexical_backfill_pending`, `projection_failed`, `coverage_unavailable`); the mode list is `labels.ts` `SEARCH_MODES` (chip order, compile-time exhaustive over the generated union, also the zod enum); `SearchCoverageNote` under the results when `coverage.completeness !== "complete"` (one line per reason); "No passages found" (`SearchEmptyState`) only with complete coverage. Pure body `AskResults`, tested in `src/routes/-tests/ask-this-call.test.tsx`
- **Live call on the player** (backend `tasks/data-api-dashboard` O4): ONE player for live and recorded calls. The page's live session = `live/use-call-live-session.ts` `useCallLiveSession(event)`: the call is followed live once it is `capturing` or in `/v1/events?status=live` (`useV2LiveEvents`, asked only while `isEarningsEventLiveish` — never for an `armed` call, which would bill `/live-audio` hours ahead); sticky for the page's life. `CallAudioProvider` (`live` prop) runs BOTH engines (each inert until used; swapping provider components would remount every tab) on two hidden `<audio>` elements (`data-engine="file"` / `"live"`) and publishes the HLS engine (`src/lib/player/hls-engine.ts` `useHlsEngine` over `useLiveAudio`) while the session runs with a stored key and `has_audio` is false, else the file engine. `useLiveCall()` (null off a live call) = the stream, the live hook, the socket (`useLiveTranscript`), the mode + `chooseMode`, the watch list, `onAir`, `recordingWait`. **The switch**: `has_audio` turning true stops hls.js (`useLiveAudio().stop()`) and, if the listener had tuned in, `fileEngine.seekMs(callMs, { play: wasPlaying })` — same call position, no reload (a played search hit or a key removed mid-call only stops hls.js); the socket stays until `transcript_ready`. `useV2Event(id, { refetchInterval })`: the page polls every 30 s while it saw the call live and `has_audio` is false, ≤ 60 min after the end (`recordingWaitInterval`, pure + tested), then the bar says "reload the page later" with a Reload button. Bar: `player/live-call-player.tsx` `LiveCallPlayer` (picked by `CallPlayerBar`) = `CallPlayer` + `notice` (asking for the stream, no live audio yet + "Check again" — a listener click, never polled, `retryStream`, no live audio for the call, "Call ended — the recording is being prepared"), `status` pills (buffering, waiting for the transcript, reconnecting, no data for 60 s, a `warning` frame, call ended) and `menu` (`⋯` → Playback: "synced to the transcript" / "as live as possible", radio, only with a live transcript and an `available` stream). `CallPlayer` live branches: `idle` + `jumpToLive` = Tune in / From the beginning; `live-edge` = `LivePill` (`role="status"`, `LIVE` / `LIVE · synced` from `engine.synced`) in place of the time, no ±15 s; `live-behind` = `BehindLiveButton` `−MM:SS` (aria "2 minutes 31 seconds behind live, back to live"), ±15 s; no speed (`rate: false`). `live-player-slot.tsx` `LivePlayerSlot` = notices (rescheduled, ended), "Live highlights" (the "Watch for keywords" form + hit / guidance rows with ▷), the price chart and Diagnostics (collapsed); no stored key → "Enter your API key to follow this call live". The Transcript tab shows `live/live-transcript-view.tsx` `LiveTranscript` while `useLiveCall()` and `!has_transcript` (`call-tabs.tsx`). Tests `src/routes/-tests/live-player.test.tsx` (provider + bar + transcript; the sync cases, states, `−MM:SS`, the switch with `has_audio` together with / a poll after `has_transcript`), `src/lib/player/hls-engine.test.ts`. See "Live earnings calls"
- Slides, the slide timeline, documents and audio are permanent public URLs (`storage-prod.invinite.com`, no `expires_at` since IDA 2625063); only the live stream's URL expires and refreshes. URLs still stay out of the router search; links use `rel="noreferrer"`

### Live earnings calls (`src/lib/live/`, `-components/live/`)

- **Browser WebSocket (owner decision 2026-10-09)**: `use-live-transcript.ts` opens `wss://<api>/v1/stream?api_key=<stored key>` itself (`liveWsUrl`; `/v1/ws` was deleted 2026-11-11 — the stream is the same session with the channels `events.live` (was `earnings-calls.live`) and `news` (was `news.live`)) — the one place the key leaves the server functions: Netlify cannot hold a server-side socket and the key already lives in localStorage. Never log that URL. A key change (`apiKeyUpdatedAt`) reopens the socket; unmount unsubscribes and closes it
- **WS flow**: `subscribe { channel: "events.live", event_id, since_seq, partials: true, prices: true }` (`since_seq` = the reducer's `lastSeq`, `-1` first: the API replays every final, no REST backlog); the API reorders finals and sends a `gap` frame before each jump (accepted, never re-subscribed; late finals still arrive); reconnect backoff 1 s → 30 s × 10 resumes from `lastSeq`; `attach_failed` / `unavailable` re-subscribe after 10 s; `resume_unavailable` is a note (live delivery continues); admission closes 4001 / 4003 / 4029 and `forbidden_tier` / `not_live` / `not_found` / `subscription_limit` / `bad_message` are final. No JSON ping (IDA answers it with `bad_message`): 60 s without a frame = the "stalled" pill only — every frame re-arms that timer EXCEPT `price_tick` (a tick a second would hide a stopped transcript). Frame schemas in `ws-frames.ts` mirror IDA `src/routes/websocket/types/earningsMessages.ts`
- **Ported from the admin console** (`../invinite/admin-dashboard/src/components/earnings-calls/`, keep in step): `live-transcript-reducer.ts` (local `LiveSpeakerAssignment` instead of the admin DTO) and `position-to-call-ms.ts`, each with its suite; `media-timing.ts` was ported by the call page into `src/lib/earnings/` (`LIVE_STREAM_REFRESH_BEFORE_MS`). `use-live-audio.ts`, `use-live-transcript.ts`, `live-transcript-view.tsx` are modelled on the admin ones, not copied (WS instead of Ably + BFF)
- **hls.js `1.7.3`, pinned** (`live-clients.ts`: lazy `loadHls`, `LIVE_HLS_CONFIG` + `SYNCED_HLS_CONFIG` = the admin values). `use-live-audio.ts`: 404 → ended, 403 → one fresh URL + reload at position, other fatal errors one recovery; a new URL is adopted only through `reload()` before the loaded one expires; buffering pill past 5 s, one reload of loading past 20 s; the `<audio>` is held in a ref (always mounted by `CallAudioProvider`, `data-engine="live"`); `stop()` (O4) tears hls.js down for the switch to the recording
- **Credits**: each `GET /v1/events/{event_id}/live-audio` is billed — v2 has no `live_audio` flag, so it is asked for every live call (`disabled` = no live audio): once per live view (`staleTime: Infinity`, no polling while `not_started`), before the loaded URL expires and once on a 403 (said in the Diagnostics too); never again after the switch to the recording
- **Synced / Live audio** (backend earnings `tasks/X-inhouse-kyutai-live-quality-2026-10-31` task 5): the transcript is released ≈ 8 s + STT latency behind the capture, so the player holds the AUDIO back to the text. `live-sync.ts` is the rule, pure and tested, a byte-identical twin of the admin console's and the invinite app's `live-sync.ts` (change all three): `audioCallMs ≤ newestFinal.endMs − 1500`, 0.9× past it, a pause past it by 3 s ("waiting for the transcript"), a forward jump 20 s behind it (landing on the newest final's start). Only finals move the point; partials are revealed by the audio (`liveTurns(…, callMs)`) and never move it. No new final for 25 s = the audio plays on. Synced is the default (`resolveLiveMode`; a refused transcript = Live audio, no toggle), persisted under `invinite-data-api-live-mode` (`src/lib/player/live-mode.ts`; chosen in the player's `⋯` menu). An explicit seek behind the point is follow mode (heard turn highlighted, click seeks) until the audio is back or the bar's `−MM:SS` button (the sync point's normal distance is `LIVE · synced`, never "behind"); the only automatic seek is the forward jump. `SYNCED_HLS_CONFIG`: `liveSyncDuration` 12, then `hls.targetLatency` = edge − newest final's start + 1.5 s, no count fields (hls.js refuses a mix), `liveMaxLatencyDuration` 24 h (its own 30-s jump would throw a held audio past the text). A Synced "Tune in" starts at the measured distance (the first playlist, `Hls.Events.LEVEL_LOADED`), or the audio starts ahead of the text and sits through a long pause. Live audio keeps hls.js's 30-s jump for a player that fell behind; "From the beginning" and an explicit seek lift it (`keepListenerPlace`) until the audio is back at the edge. `position.behindS` is relative to hls.js's sync position; the true distance is `edgeBehindS`. Live audio: > 10 s behind = follow mode, text as released ("transcript ≈ N s behind")
- **Live price line** (tasks/inhouse-live-price-feed task 9): `price_tick` frames (≤ 1 / s, only seconds with a trade; `priceTickFrameSchema` / `toPriceTick` in `ws-frames.ts`, mirroring IDA's `PriceTickFrame`) → `live-prices-reducer.ts` (`livePricesReducer`: ordered by `at`, a second seen again replaces its tick, ≤ 7,200 held, newest non-null `reference` / `prevClose`), returned by `useLiveTranscript` as `prices`. No second-level backlog exists: `LivePlayerSlot` seeds the line from the price-attribution minute rows while `live` (`useV2PriceAttribution(…, { live })`, every 60 s; a 404 = none yet). `live/live-price-chart.tsx` (`LivePriceChart`, `ChartFrame` 160 px, return bps ↔ price toggle, lead text "Temporal coincidence, not attribution of cause. Pre-market and after-hours bars are sparse.") between the audio and the transcript, "No price ticks yet." without ticks or rows; Diagnostics counts ticks and minute rows. Pure pieces in `live/live-price-chart-data.ts` (another basename than the component on purpose; tested): `clockOffsetMs` (call t0 = a tick's `at − call_ms`, else the stream's `call_t0`, else wall time), `mergeSeed` (a minute row = one point at its close, cumulative return vs the same reference as the ticks; rows from the first tick on dropped), `gapBreaks` (> 5 s between ticks / > 90 s next to a minute point = a break row; an `isolated` point gets a dot), `formatCallMs`. The cursor `ReferenceLine` marks the audio position while it plays (call clock only). Ticks that arrive after `call_ended` are not shown (the socket closes 5 s later). Component test `src/routes/-tests/live-price-chart.test.tsx` (point / gap counts in the chart's `aria-label`)

- **HLS engine** (`src/lib/player/hls-engine.ts`, O4): `useLiveAudio` on `PlayerEngine`, sync rules untouched. `state`: not tuned in `idle` (`play` / `jumpToLive` = Tune in, `seekMs(ms)` = From the beginning + the seek once the stream plays), `loading`, `live-edge` / `live-behind` (`canJumpToLive`; a refused autoplay shows the controls), `ended`, `error` (stream request failed / `unavailable`). Slow fields in whole seconds (`hlsEngineFields`, pure, tested): `positionMs` heard call ms, `endMs` = hls.js's sync edge (thumb at the right end), `behindMs` = `behindS` (Synced: 0 unless behind). `seekMs` → `seekCallMs` (`seekMedia` without `call_t0`), within 1 s of the edge → `jumpToLive`; `skip` clamps to the edge; `setRate` no-op; `paused` = the listener's (a hold pauses the element only). The engine object is memoised, and so is `CallPlayerProvider`'s value: the live hook's `timeupdate` re-renders no `usePlayer()` reader. **Call clock**: the provider's `clock` (`PlayerClock` `{ offsetMs, playing }`, `player-context.tsx`) makes `usePlayerPosition()` answer call ms (media ms + `playingDate − call_t0 − currentTime`, constant between discontinuities; 0 without `call_t0` = media time) and the listener's play state, so `PlaybackTurns` / the seek bar run on the live transcript's clock unchanged
- **Live transcript** (`-components/live/live-transcript-view.tsx` `LiveTranscript`, O4): `shownLiveTurns` (Synced at the sync point: only what the audio reached, `liveTurns(…, heardMs)`) → `PlaybackTurns` + `PlaybackTurnBlock` (segments `{ startMs, words: null }`, the newest turn open-ended): avatar / initials (image by name from `/v1/participants?event=`), provisional name + "title, firm" + a "live" badge whose tooltip is the source ("provisional — from question cue, confidence 0.90"; `llm` lighter), unnamed = "Speaker N", ▷ m:ss (before Tune in it starts the stream from the beginning and seeks there), the partial tail in italics (`TurnBlock` `partialText`), keyword marks (`TurnBlock` `marks`, `<mark data-keyword-mark>`). No inner box: the document scrolls; Follow follows the heard (at the edge: the newest) turn while the audio plays
- **Highlights / new frames** (O4): `ws-frames.ts` `keywordHitFrameSchema`, `guidanceFlashFrameSchema`, `warningFrameSchema` (fields from `openapi.json`; a warning `code` it does not know still parses); `subscribeFrame(…, watch)` adds `keywords` / `keyword_match`. `useLiveTranscript({ watch })`: a changed watch list re-subscribes on the SAME socket (unsubscribe + subscribe from `lastSeq`); hits / flashes → `src/lib/live/live-highlights.ts` (`liveHighlightsReducer`: a hit once per layer + seq + keyword, one flash per metric / period, a higher `revision` replaces; `formatGuidanceValue`, `parseKeywords` (comma list, 2–64 chars, ≤ 20), `splitByKeywords` (whole words + s / es / ed / ing / 's)) → `highlights`; `warning` → a bar pill. A final-layer hit has no ▷ (its clock is the recording's). `replay_truncated` is the alerts channel's (alerts task 2)

### Routing (`src/routes/`)

File-based routing with TanStack Router. The route tree is auto-generated in `routeTree.gen.ts`.

- `__root.tsx`: Root layout: top bar (sidebar toggle, search, theme, key / plan), the ONE sidebar (`AppSidebar`), the key gate around every page, SidebarProvider and Toaster
- `index.tsx`: the landing page with data (see "Shell (O5)")
- `$ticker/route.tsx`: Layout for all instrument routes: reads the instrument once (`useInstrument`), the pinned header, the gate sentence of a section its `datasets` lacks; unknown symbol = one notice
- `$ticker/*.tsx`: Instrument pages (filings, financials, dividends, holdings, holders, etc.)
- `funds.tsx`: the fund list (`/funds`); the global pages and redirects: "Shell (O5)"
- `filings/index.tsx` (`/filings`: live filings + search every filer), `filings/$accession.tsx` (one filing's tabs),
  `sec/datasets.tsx` (`/sec/datasets`): "Filings (O7 group 3)"
- `news-feed.tsx`: the watchlist news feed (`/news-feed`, O7 group 2; see "News page")
- `/status` redirects to `https://status.data.invinite.com` (the page lives in `../invinite-data-api/status/`): `status.tsx` is a server route answering 301 with the query kept — never a `netlify.toml` rule, which Netlify evaluates AFTER the SSR function (`path: "/*"`) and so never fires; the sidebar's Help block links there directly
- `/licensing` redirects to `https://data.invinite.com/docs/licensing` (the licensing matrix lives in the Invinite Data app's docs): `licensing.tsx` is a 301 server route like `status.tsx`; the sidebar's Help block links there directly

### State Management

- **API Key**: Zustand store in `src/lib/stores/api-key-store.ts` persists to localStorage (`invinite-data-api-key`). Handles SSR hydration with `hasHydrated` flag
- **Recents**: `src/lib/stores/ticker-store.ts` = the 8 recently opened subjects (instruments and filers, `invinite-recents`), written by `useRecordRecent` (`src/lib/recents.ts`) once a page has loaded its subject; read by the search's empty state and the landing page
- **Theme**: `src/lib/theme.ts` (`invinite-theme`: system / light / dark, `useTheme`, `THEME_SCRIPT` = the inline no-flash script in `<head>`)

### Page shell (backend `tasks/data-api-dashboard` O1)

- **The document scrolls** (the browser's scrollbar). `html` / `body` are `min-height: 100svh`; `body` sets the one base
  text size (`text-xs/relaxed`), so no element relies on the 16 px browser default. **No page body is a scroll box**: no
  `ScrollArea`, no `h-0 grow` flex chains, no fixed `h-[NNvh]` around a page's content. Inner scroll boxes are allowed
  only in dialogs, side panels (`sec-source-panel.tsx`), the PDF / HTML viewers and code / JSON blocks (a script's
  source, a template, an event payload, a webhook example); the call page has none outside its dialogs (the finished
  call's transcript since O3, the live transcript's since O4).
- **Pinned**: the top bar (`__root.tsx`, `sticky top-0 h-14`, `--app-topbar-height: 56px` on `<body>`) and on ticker
  pages the instrument header (`$ticker/route.tsx`, `sticky top-(--app-topbar-height)`), whose height a
  `ResizeObserver` writes as `--ticker-header-height` on `<html>` (`0px` without one). Anything else that sticks sits
  below both: `STICKY_TOP_CLASS` / `LG_STICKY_TOP_CLASS` in `src/lib/layout.ts` (literal class names: Tailwind only sees
  classes written out in the source). The content column steps aside by `--sidebar-width` while the fixed sidebar is
  open (`md:peer-data-[state=expanded]:pl-(--sidebar-width)`: the sidebar wrapper is a column, so without it content sat
  under the sidebar below ~1660 px).
- A search-param change that opens a panel or filters in place (`?item=` on News, the Documents filters) navigates with
  `resetScroll: false`: the document scrolls, so the router's default reset would jump to the top.
- **Gate before mount**: `$ticker/route.tsx` renders a section (`<Outlet />`) only once the instrument is known
  (skeleton while it loads), so a gated section never requests and no refusal flashes before the gate sentence. The
  header's `h1` is the answer's canonical `symbol`.
- **`PageHeader`** (`src/components/ui/page-header.tsx`): THE page title — `h2`, muted description, `actions` slot
  (filters) and the "API" button (O6). Every page renders it, in its error state too.
- **`DataTable`** (`src/components/ui/data-table.tsx`, grown from `V2ListTable`): `columns`, `rows`, skeleton rows while
  the first page loads, `errorState` (a rendered `ErrorState` / `SecReadinessNotice`) in a full-width row, the empty row
  only when `emptyIsGenuine`, `LoadMoreButton` with "N loaded", `columnClassName`, `rowClassName`, `stickyFirstColumn`.
  CSS cannot stick a header to the window inside a horizontal scroller: the header sticks below the pinned header from
  `lg` up while the table fits its column (wrapper `lg:overflow-x-visible`, measured by `useTableFits`); below `lg`, for a
  table wider than its column and for `stickyFirstColumn` tables (insider trades) the wrapper scrolls sideways and the
  header scrolls with the page — the page itself never scrolls sideways. On it: dividends, splits, market holidays, filings
  (`filing-columns.tsx`), insider trades, IPOs, calendar, calls list, holders, fund holdings, funds. The statement
  tables (`financials-flat-table`, `financials-presentation-table`, `financial-metrics-table`, segments) keep their own
  table with a sticky first column (`STICKY_FIRST_CELL`) and a visible chart button per row (`ChartRowButton`,
  keyboard-reachable); `MetricChartDialog` takes the table's order (newest first) and charts oldest → newest, the series
  named by the metric. `Table` takes `containerClassName` for its scroll wrapper.
- **`LoadMoreButton`** lives in `src/components/ui/load-more-button.tsx` (optional `loadedCount`).
- **Shared UI pieces** (backend follow-up `[FU3017]`, 2026-11-21: one piece per pattern the parallel lanes had copied;
  a page's difference is an option, never a fork — a new search box, request-state switch, auto-loading list, day
  pair or status badge uses these):
  - `src/components/search/search-box.tsx`: `SearchQueryForm` = THE submit-only query box (input + Search; the draft
    stays the caller's state, never the URL; `MIN_SEARCH_QUERY_LENGTH` 2; `busy` disables, `searching` = "Searching…" —
    news keeps "Search" while only a next page loads —, `canSubmit` = a page condition (SEC: a symbol or market-wide),
    `trailing` = after the button (news: clear ×), `children` = more fields inside the same form (the SEC filters:
    Enter submits)); `SearchChip` (an `aria-pressed` toggle chip: types, Match case), `SearchModeChips` (Keyword /
    Exact, bare chips: `/search` wraps them in its labelled group), `SearchCostNote`. On `/search`, news, company
    documents, SEC filing search, "Search this call".
  - `src/components/ui/request-error-state.tsx`: `RequestErrorState` = THE plan gate → problem `codes` → 404
    (`notFound`, only when given; no `title` = the API's words) → 400 (`badRequest`, only when given) → `ErrorState`
    switch. Presets `PeopleState` (STANDARD, "Not found" 404, 400) and `MediaState` (PRO, `MEDIA_CODES`, 404 only with
    a `notFound`); the documents library (STANDARD + `MEDIA_CODES`) and the news list (FREE) pass options inline.
    `SearchError` (`ask-this-call.tsx`) stays its own: 429 and `unavailable` by status, the search plan names.
  - `src/lib/api/use-auto-load-pages.ts`: `shouldLoadNextPage` = THE "load the next page by itself" rule (a next page,
    nothing loading, the last page not failed, under `max`); `shouldFillPage` (a client filter showing nothing, from
    the last change) and `shouldAutoLoad` (`lib/alerts/alert-view.ts`, the event lists) are it. `useAutoLoadPages(query,
    { enabled, max, resetKey })` runs it: no `max` = every page (documents library + events, documents tab, guidance /
    KPI histories, catalog), `max` over every loaded page (`useEventList`), `max` from the last `resetKey` change +
    `enabled` + the returned `capped` (calendar). Its own module: component tests mock `queries.ts`. The News pager
    (`useNewsList`) is no infinite query: it advances its cursor stack under `shouldFillPage`.
  - `src/components/ui/day-range.tsx`: `DayRange` = THE from / to day pair (150 px inputs, `labels` = accessible names,
    `onChange` gets the changed end, cleared = undefined; `lead`, `separator` — "and" on holidays —,
    `separatorClassName` — `text-xs` on the calendar / news rows —, `group` — wraps as one unit: offerings, insider —,
    `titled` — insider). On offerings, the earnings calendar, IPOs, market holidays, `/search`, filings, dividends,
    news, insider trades (filed + traded), the SEC search filters. Not on it: the announcements' labelled `DayInput`s
    and point-in-time's single day.
  - `src/components/ui/status-badge.tsx`: `StatusBadge` = THE badge with its meaning in a tooltip (`label`, `tone`,
    `tooltip`, `reason` appended to the accessible name, `prefix` "Status" / "Delivery"); `AlertStatusBadge` (meaning +
    reason), `DestinationStatusBadge` (reason INSTEAD of the meaning), `DeliveryStatusBadge` choose the words.
  - Tests: `src/lib/api/use-auto-load-pages.test.tsx`, `src/routes/-tests/day-range.test.tsx`; the pages' own tests
    cover the search boxes, states and badges.
- **List state**: a pure list view takes `ListState<TPage>` (`src/lib/api/list-state.ts`: error, pages, "Load more"),
  built from an infinite query by `listState(query)` — never spelled out by hand. The v2 SEC lists (the filing page's
  tabs, the holder lists and 13F changes) render through ONE frame, `src/components/sec/sec-list-frame.tsx`
  `SecListFrame` (readiness notice, coverage, `V2MetaLine` with `counting` / `pinned_at`, an optional note, `DataTable`
  with export, a failed next page).
- **Formatters** (`src/lib/format.ts`, tested): `formatDay` ("Oct 29, 2026"; a date-only string is its calendar day),
  `formatInstant` ("Oct 29, 2026, 4:30 PM EDT", viewer's zone with label; re-exported by `lib/earnings/format.ts`),
  `formatMoneyCompact` ("$3.95T", K / M / B / T), `formatMoney` (exact; a dividend keeps 4 decimals), `formatShares`,
  `formatNumber`. No raw ISO date in a cell, no locale-less `toLocaleString()`; `src/lib/date.ts` is gone.
- **Titles**: every route sets `head` (`titleHead` / `tickerHead` in `src/lib/layout.ts`: "AAPL · Dividends — Invinite
  Data"); the router has `defaultErrorComponent` / `defaultPendingComponent` (`src/components/ui/route-states.tsx`).
  `TanStackDevtools` renders only in dev.
- **Toasts**: a hook whose page renders the error does not toast too (dividends, splits, holidays: `errorMessage: null`;
  `useV2EventsInfinite({ toastErrors: false })` on the calendar and the calls list).
- Tests: `src/lib/format.test.ts`, `src/routes/-tests/data-table.test.tsx` (DataTable + PageHeader), the gate cases of
  `ticker-layout.test.tsx`.

### Shell (backend `tasks/data-api-dashboard` O5): navigation, key gate, global pages

- **Key gate** (`src/components/api-key/key-gate.tsx`, root layout): a page renders only once `useMe()` (`GET /v1/me`, 0
  credits) answered; a 401 → `OnboardingCard` (validating key field, "Create one", what the dashboard shows) instead of
  page errors and toasts; any other `/v1/me` failure lets the page render its own errors. `useKeyState()` = checking /
  invalid / ready / unavailable, `useKeyReady()` gates the requests outside the page (search, sidebar). Without any key
  `createApiClient` answers a typed 401 problem (`missing_api_key`) WITHOUT a network call (never `Bearer undefined`).
  The root `QueryCache.onError` asks `/v1/me` again after any 401 (a revoked key → the card). Saving a key validates it
  (`useKeyValidation`: `getMe` with the draft; valid → stored + "Key valid · PRO plan · N credits"; refused → inline
  error, the old key kept); `ApiKeyInput` has a show / hide toggle; the top bar shows the plan badge → `/account`.
  `useMe` is the plan source for PRO badges (O6).
- **`src/start.ts`**: a serialization adapter for `ApiRequestError`. TanStack Start's default error plugin keeps only an
  Error's `message`, so without it every status-aware state (401, 404 "not known", 403 plan gate, 503) arrived as a plain
  error. A new error class that must cross the server-function boundary needs its own adapter there.
- **Navigation table** (`src/lib/navigation.ts`): `MARKET_NAV` (Home, Earnings calendar, Live calls, IPOs, Market
  holidays), `BROWSE_NAV` (Instruments, Funds, Institutions; later tasks add theirs here in the commit of their route),
  `ACCOUNT_NAV`, `HELP_NAV` (status, licensing), `INSTRUMENT_SECTION_GROUPS` (Overview · Earnings · Filings · Financials ·
  Ownership · Corporate actions · News; by `datasets`), `filerContextAnchors`, `BROWSE_CARDS` (landing), `searchPages`
  (the search's Pages group). The sidebar, the landing cards and the search read it; `route-names.test.ts` fails for a
  top-level route without an entry (`NAV_EXCEPTIONS`: `/status`, `/licensing`, `/sec`).
- **Route names vs tickers**: a static top-level route name has more than five letters or a hyphen (`/live-calls`, not
  `/live`); `/funds` and `/sec` predate the rule. `route-names.test.ts` reads `routeTree.gen.ts`, and checks that `/LIVE`
  and `/IPOS` match `/$ticker`. No `caseSensitive` router option.
- **Sidebar** (`src/components/navigation/app-sidebar.tsx`, root layout, every page): Market (Live calls with the live
  count of `useV2LiveEvents`), Browse, Context ("AAPL · Stock", "GLD · ETF (trust)", "<name> · Institution": an
  instrument's sections from the same `useInstrument` answer as the layout; a filer's blocks as anchors from the same
  `/v1/filers/{cik}` + first filings page as `/sec/$cik`, plus "Open <TICKER>"; "<name> · Analyst": a person's blocks
  `PERSON_CONTEXT_ANCHORS` from the same `/v1/people/{person_id}` answer as `/people/$personId`), Help, Account with the plan. Fixed-width
  skeleton rows (the primitive's random width mismatched on hydration). `src/hooks/use-mobile.tsx` is false on the first
  client render (hydration).
- **Global pages** (each a pure `*View` + test): `/calendar` (`/v1/events`, grouped by New York day —
  `groupEventsByNewYorkDay`, `DataTable`'s `groupOf` / `groupHeading`: sticky day headings with counts —, presets Today /
  This week / Next week, `company` / `type` / `status` / `date_kind` / `fiscal_year` / `fiscal_quarter` to the API, session
  + event status client-side: `useAutoLoadPages` with `enabled` / `max: FILL_PAGES_MAX` / `resetKey` loads ≤ 10 pages per filter change by itself, then "Load more"), `/live-calls`
  (cards; none live = the next scheduled calls; the live list has no live-audio flag, so the cards do not claim one),
  `/ipo-calendar` (Upcoming = not trading / withdrawn by listing date ascending, Recent = listed ≤ today newest first;
  stage / SPAC / listing-date filters; listed symbol → `/$ticker`; "Details" = `/v1/ipos/{ipo_id}`), `/market-holidays`
  (Upcoming / Past; status Closed / Early close from the open / close — the answer names no exchange), `/account`
  (`/v1/me` + `/v1/me/usage?days=7|30|90`: plan, limits, credits, families, credits-per-day chart via `chart-parts`, by
  family, by caller), `/instruments` (`/v1/instruments` by cursor: type tabs, structure / exchange / listed / name / sort in
  the URL), `/institutions` (`/v1/filers?phase=manager` by cursor, 1 credit a page). The old
  `/$ticker/earnings-calendar|ipos|market-holidays` and the six financial routes are `beforeLoad` redirects (query kept);
  `/$ticker/financials?view=standardized|as-reported|ratios|growth|cagr|segments` is ONE route whose tabs
  (`components/financials-pages/views.ts`) hide by `datasets`.
- **Search** (`ticker-search.tsx`, ⌘K / Ctrl K, also inside inputs): groups Instruments (`rankInstruments`: exact ticker,
  then a name starting with the text — "apple" → AAPL), Institutions & filers (from 3 characters after a 300 ms pause:
  `phase=manager` then the other filers, `mergeFilers`; 2 billed requests per pause), Pages; pills All / Stocks / ETFs /
  Closed-end funds / ETNs / Institutions / People (`TabStrip`, ←/→; a pill sends only its own requests; All on every open);
  People (O7 group 1) = `useV2PeopleSearch` (`/v1/people?q=`, 5 rows, from 3 characters after the same pause: 1 billed
  request per pause, in All and People);
  combobox + listbox, Enter = highlighted or first hit (waits for an answer in flight); empty = recents.
- **Cross-links**: `HolderCell` (a 13F manager → `/sec/$cik`; a listed fund → `/$ticker`; an unlisted fund "Unlisted" +
  "trust" → its registrant's `/sec/$cik`, series id in the tooltip); fund positions and a manager's portfolio rows →
  `SecurityLink` (ticker as stated → `/$ticker`, else issuer CIK → `/sec/$cik`, else text; no row is pre-checked).
- **Landing** (`/`, behind the gate): Live now, Earnings today / later this week (first 8: an event has no market cap or
  rank), Next IPOs, next market holiday, Browse cards, Recently opened, the SEC filer lookup.
- **Smaller page work**: overview tiles (Next call, Latest filing, website / IR) and coverage badges linking their
  sections; calls list counts "40+" while more pages exist, `Notice` for not covered, no Started / Ended on Upcoming,
  `?fiscalYear=`.
- **Theme**: top-bar `ThemeToggle` (system → light → dark), `THEME_SCRIPT` sets `.dark` before the first paint
  (`<html suppressHydrationWarning>`); the SEC HTML viewer keeps its white page (filed documents are light).
- Shared bits: `TabStrip` (`components/navigation/tab-strip.tsx`, one `aria-selected` tab, ←/→ / Home / End),
  `DebouncedInput` (URL-backed text filters, 300 ms).
- Tests: `key-gate`, `account-page`, `app-sidebar`, `route-names`, `market-pages`, `browse-pages`, `landing-page`,
  `ticker-search`, `overview-and-calls` in `src/routes/-tests/`; `navigation.test.ts`, `calendar-groups.test.ts`,
  `use-auto-load-pages.test.tsx`, `theme.test.ts`, `start-adapter.test.ts`, `client.server.test.ts`. Fixtures:
  `src/lib/account-fixtures.ts`.

### API inspector, export, URL state (backend `tasks/data-api-dashboard` O6)

- **Operations table** `src/lib/api/operations.gen.ts` (generated, committed after `pnpm run check`): `pnpm generate:api`
  = `openapi-typescript` + `node scripts/generate-operations.mjs`. One entry per operation of `openapi.json` (124,
  `operations.test.ts` counts them): method, path template, summary, `credits` (`x-credits`, null for `/health`,
  `/status*`), `tier` (`x-tier`), `cli` (`x-cli` group / action / positional), `docsUrl`
  (`https://data.invinite.com/docs/<method>--<path, / → _>`); `OPERATION_IDS_BY_ROUTE` (`"GET /v1/funds/{fund}"` → id);
  `PLAN_ORDER` = `/v1/me`'s `plan` enum (the access order). Regenerated only by O6, A2's spec adoption and A3.
- **Request descriptors — nothing to register**: `client.server.ts` records every Data API answer of a server function
  call (openapi-fetch middleware → `AsyncLocalStorage`: method, the concrete path + query AS SENT, status,
  `X-Request-Id`, `X-Credits-Charged`; never a request header, so never the key) and the global function middleware
  `src/lib/api/request-middleware.ts` (registered in `src/start.ts`; its server half imports `client.server` lazily, so
  `node:async_hooks` never reaches the browser bundle) sends the list back as the server's send context; its client half
  files it under the returned answer / thrown error (`fileRequests`, a `WeakMap`). The root `QueryClient`'s
  `structuralSharing: shareWithRequests` carries the entry onto the copy React Query keeps (page by page for lists).
  `RequestMeta` (`src/lib/api/request-meta.ts`) = `operationId, method, path, query, body?, credits, requestId, status`;
  `body` is unset for reads (A2 fills it for writes, redacted). So EVERY hook is inspectable without a code change; an
  answer that is not an object (none today) or a `queryFn` that returns a transformed copy is not.
- **Inspector**: `PageHeader` always ends in `ApiButton` (`src/components/api/api-sheet.tsx`; nothing outside a
  `QueryClientProvider`, so pure view tests are unchanged): a side sheet listing `useViewRequests()` = the requests of
  every query with an enabled observer (each page of a list; a hook mounted with `enabled: false`, e.g. a closed catalog tab, is not listed), minus `/v1/me`; per request method + path + query, summary,
  plan badge, base cost + charged, HTTP status, request id (copy), `curlOf` (ALWAYS `$INVINITE_API_KEY`), `cliOf`
  (`invd <group> <action> <positional> --<flag>`, flags = the CLI's `flagName`), the docs link and the answer as a
  `JsonTree` (`json-tree.tsx`: open to depth 2, children mounted only when open and 50 at a time) with copy / download.
  `useViewRequests` ignores the cache's `observerOptionsUpdated` / `observerResultsUpdated` events (each `useQuery`
  render emits them: a render loop). The call page has no `PageHeader`: `ApiButton` ends its tab bar (`call-tabs.tsx`,
  O6-final) and lists the event's, the open tab's and the player's requests (`/audio`, the words transcript, the live
  list / `/live-audio`) — every call-page hook returns its server function's answer object, so no tab registers. The
  live transcript socket is not an HTTP request and is not listed.
- **Export**: `src/lib/export.ts` (`toCsv` RFC 4180 + CRLF, `csvCell` neutralises a TEXT cell starting with `= + - @`
  tab / CR by a leading `'` — numbers stay numbers —, `flattenRow` dotted keys, `exportFileName`
  `<scope>-<dataset>-<yyyy-mm-dd>.<ext>`, `downloadCsv` with a UTF-8 BOM, `downloadJson`; `saveBlob` of
  `src/lib/download.ts`). `DataTable` `exportConfig={{ dataset, scope, columns? }}` renders `ExportMenu`
  (`src/components/api/export-menu.tsx`) above the table: CSV / JSON of the loaded rows (default columns = every API field
  flattened), "N rows loaded", "Load all pages first…" behind a confirm naming the per-page cost (`loadAllText`),
  stopping at the last page, after a page that added no row (failed / empty) or after `LOAD_ALL_MAX_PAGES` (25). On:
  dividends, splits, insider trades, filings, holders (each source + changes), fund holdings, calls list, market
  holidays, funds, instruments, institutions, and every O7 / alerts list that names it in its section below (people,
  offerings, catalog, data sets, the filing page's tabs, transcript search, news, announcements). The calendar and
  `/ipo-calendar` have none yet (their rows are grouped / split client-side).
- **Hints**: `src/components/ui/credit-hint.tsx` — `creditText(operationId)`, `CreditHint` (tooltip),
  `PlanBadge({ operationId })` (`useMe()` plan vs `x-tier` in `PLAN_ORDER`; nothing while the plan is unknown or
  outside a query client), `usePlanAllows`. `DataTable` / `LoadMoreButton` take `operationId` (the page's cost in the
  "Load more" tooltip). The statement pages' `ViewButtons` take `badges` (detailed / presentation = their own PRO
  operations) and start at `summary` when the plan lacks the presentation operation (no refused request first).
- **Copy buttons** `src/components/ui/copy-button.tsx` (`CopyButton`, `Copyable`): accession numbers (filings,
  `/sec/$cik`), CIKs (`/sec/$cik` header, insider owner CIK), event ids (calls list, call header), CUSIPs (fund holdings, 13F
  portfolio).
- **URL state rule**: every filter, tab, sort and open item is a search param — `validateSearch` with each field
  optional + `.catch(undefined)` (helpers `src/lib/url-state.ts`: `optionalDay`, `optionalText`, `optionalEnum`,
  `optionalAccession`, `optionalFlag`, `optionalInt`; `optionalText` reads a bare numeric value — `?form=144` arrives as a number — as its text), written with `IN_PLACE` (`replace: true, resetScroll: false`), a default written
  as `undefined`. Filings `?form=&sort=asc&filing=<accession>&docs=<accession>` (a `?filing=` outside the loaded pages
  opens its documents panel), insider `?side=&from=&to=`, holders `?tab=&period=`, holdings `?day=`, `/sec/$cik`
  `?form=&period=&docs=`, calls list `?tab=&search=documents&fiscalYear=`, documents `?searchIn=sec&source=<version
  id>&block=<block id>` (the SEC citation panel), Financials `?view=` + `statement, period, layout, reportedOnly, sign,
  category, basis, horizon, segment, chart` + O7's `asOf, filing, fyFrom, fyTo, metric, axis` (`components/financials-pages/financials-search.ts`
  `financialsSearchSchema` / `useFinancialsSearch`; `?chart=` = the charted row's key, through `ChartParamContext` +
  `useChartSelection` of `components/metric-chart/use-chart-selection.ts`, local state without a provider), the call
  page `?tab=&format=&version=&t=&prior=&docSort=` (Call page section), `/search` `?q=&mode=&type=&company=&from=&to=` (O7
  group 5). Not in the
  URL: the News pager's page (a keyset cursor stack), search boxes' typed queries (submit-only). Tests:
  `src/routes/-tests/url-state.test.ts`, `api-inspector.test.tsx`, the call page's in `call-player.test.tsx` (`?t=`
  Play, copy link, header id), `transcript-layout.test.tsx` (format / version from the URL) and
  `no-transcript-notice.test.tsx` (the tab bar's API button), `src/lib/export.test.ts`,
  `src/lib/api/request-meta.test.ts`, `operations.test.ts`.

### People (backend `tasks/data-api-dashboard` O7 group 1)

- **Routes**: `/people` (`routes/people/index.tsx`, `PeopleList`: `GET /v1/people`, 50 a page, by cursor; `?q=` name,
  `?company=` ticker or CIK, `?event=` one call, `?role=`, `?sort=` — absent = the API's `-last_seen` — all URL state
  with `IN_PLACE`; with a company or a call the per-scope `appearances` / `questions` show as "Calls here" /
  "Questions here", `appearance_count` is every call; Export + `listPeople`) and `/people/$personId`
  (`PersonProfileView`, `PersonCallsView`, `RoleHistoryView`; in-page blocks `PERSON_ANCHORS`). `/people` is in
  `BROWSE_NAV`; the sidebar's person context lists the three blocks.
- **A participation names its call only by id** (`/v1/participants?person=`: event id, title, firm, confidence — no
  date, no company), so the person page asks `GET /v1/events/{id}` per loaded call (`useV2EventsById`, `useQueries`
  under `useV2Event`'s key and expansions: the call page opened from the list is cached). 25 calls a page bounds it
  (≤ 26 requests per page of calls). Calls sort newest first once their event is in; a call whose event failed says
  "Not available". Role & firm history (`roleHistory`, `src/lib/people.ts`, tested) = consecutive calls with the same
  title and firm as said on each call; undated calls are left out (the note says so).
- **Links**: `PersonLink` (`src/components/people/person-link.tsx`) — `TurnBlock`'s speaker name (`speaker.personId`:
  transcript turns carry `person_id` through `toTranscriptView` / `toWordTurns`, the Q&A tab's analyst and answers),
  the Participants tab's names (plus "Search people: on this call / on every <SYMBOL> call" → `/people?event=` /
  `?company=`), the `/people` rows. Search hits and live turns carry no `person_id`: no link (never by name).
- **States**: `PeopleState` (`src/components/people/people-state.tsx`, `RequestErrorState`'s people preset): the plan gate (STANDARD), a 404 in the API's
  words (a fund given as `company` answers `not_covered`) or the page's not-found text, a 400's message, else
  `ErrorState`. Fixtures `src/lib/people-fixtures.ts`; tests `src/routes/-tests/people-pages.test.tsx`,
  `src/lib/people.test.ts`, the People cases of `ticker-search.test.tsx` and `transcript-layout.test.tsx`.

### Earnings (backend `tasks/data-api-dashboard` O7 group 5)

- **`/search`** (`routes/search.tsx`, `BROWSE_NAV` "Transcript search"): `/v1/search/transcripts` without `company` /
  `event` = every company (10 credits a search). ONE page of ≤ 8 passages (`has_more` always false): the page says so
  and, at 8, how to narrow (a company, a shorter call window, one type) — no paging. URL `?q=` (the SUBMITTED query,
  written on Search as a history entry; typing stays local), `mode` (Keyword default / Exact), `type`, `company` (ONE
  ticker or CIK: a list is a 400), `from` / `to` (`conference_date.gte|lte`); no `from` and no company = the API's last
  365 days, stated beside the dates (`windowText`). Exact with < 3 code points and no company is never sent
  (`exactTooShort`, the API's `LITERAL_MIN_UNSCOPED_CODE_POINTS`; it answers 400). Hits = `AskResults` with the
  `market` scope (`AskScope`: the hit's title names its symbol, links its call page); Export = CSV / JSON of the hits.
- **KPI history** (`tabs/kpi-history-panel.tsx`): a normalized KPI in the Guidance & KPIs tab's KPI table opens
  `/v1/kpis?company=&metric=&sort=` (`useV2KpiHistoryInfinite`, every page of 200): every mention as said (several per
  call: other periods, the press release beside the call — nothing picked or summed), Newest / Oldest first = `sort`,
  a dot chart of the most common unit (`kpiHistorySeries`, `src/lib/earnings/kpi-history.ts`; other units and
  value-less mentions stay in the table, counted) and the table (call → call page, period, value, said in, filing).
- **Metrics & diff**: "Compare with" (`PriorPicker`, `?prior=`): "Previous call" = no `prior`; the company's earlier
  calls with a transcript are asked only once the picker opens (or a `?prior=` needs its label). The pipeline derives
  ONE pair per call, so another call answers 404 whose `detail` names the derived prior — shown in the API's words
  (`ComparisonView`).
- **Call header**: the start time's source · confidence (a `low` one as an outlined badge, "may still change"),
  `expired_reason` (`EXPIRED_REASON_LABELS`, exhaustive over the contract's enum, tested against `openapi.json`), the
  results filing (8-K / 6-K, accepted) and the periodic report (10-Q / 10-K, period end, filed): the form opens the SEC
  documents panel by accession (`SecSourceDialog`), "EDGAR" the index page.
- **Transcript**: the version select and the stats line carry `corrected_by` (`versionKindText`: "corrected by a
  person" / "corrected by the system (company text)"); a NAMED turn whose `speaker_confidence` is below 0.8 (`LOW_SPEAKER_CONFIDENCE`;
  the pipeline accepts a name from 0.6) gets "Speaker uncertain" with the value in its tooltip
  (`SpeakerConfidenceBadge`; null on the cleaned layer = nothing).
- **Documents tab**: order select (`?docSort=`, `sort` of `/v1/investor-documents`; `DOCUMENT_SORT_VALUES` in
  `src/lib/earnings/documents.ts`, the default `-filing_date` never written); "Show text" = `expand=pages`
  (`DocumentTextView`: page by page with the page title, else `body_text`, else the public pages JSON).
- Tests `src/routes/-tests/earnings-o7.test.tsx`, `src/lib/earnings/kpi-history.test.ts`, the order case of
  `documents-tab.test.tsx`; fixtures `src/lib/earnings/o7-earnings-fixtures.ts` (live shapes of 2026-11-21).

### Alerts (backend `tasks/data-api-dashboard` 2-alerts task 2): write layer, alerts, event feed

- **Spec**: `openapi.json` = Data API 7.1 (`data-sdk-v7.1.0`): `listAlerts` takes `symbol` / `destination_id`. The only
  spec change of the super tasklist besides A3's operations table regeneration.
- **Writes** (the dashboard's first): `src/lib/api/server-functions-alerts.ts` — reads `GET`, writes
  `createServerFn({ method: "POST" })`, zod input, the key from the same store as every read; the requests themselves in
  `alerts-requests.ts` (one function per operation on a given client, so tests run them over a mocked `fetch`: the
  colon verbs `/v1/alerts/{id}:pause|:resume|:test` and `/v1/alerts:batch` are sent as written, `alerts-requests.test.ts`).
  A write answered with 204 returns `AlertWriteDone` (an object: the inspector files its request under it).
- **`useApiMutation(operationId, { invalidates })`** (`src/lib/api/mutations.ts`, table `WRITES` — A3 / A4 append their
  writes): runs the server function with the stored key, refetches the listed query-key prefixes on success
  (`ALERT_QUERY_KEYS` in `queries.ts`), hands the revived `ApiRequestError` to the caller, NEVER toasts (the caller says
  it once), never retries, no optimistic update. **Idempotency**: `useIdempotencyKey` — one `Idempotency-Key` per
  submission of `createAlert` (A3: `createDestination`), the same body keeps its key (double click, retry after a lost
  answer), any API answer or a success ends it. The other writes have no key: their buttons disable while pending.
- **Confirm rule**: every destructive or outward action asks first through `src/components/ui/confirm-action.tsx`
  (`ConfirmAction`: title, the effect in words, the ids / count, the confirm verb, `noun` for A3's destinations):
  delete, every bulk change, "Send test event" (a REAL delivery to the alert's destinations). Pause / resume of one alert
  runs at once. Words: `confirmWords` (`components/alerts/use-alert-actions.tsx`).
- **Secret rule**: the inspector's recorder (`client.server.ts` `onRequest`) keeps a write's JSON body and
  `requestMetaOf` redacts it before it is stored (`redactSecrets`: keys `secret`, `authorization`, `password`, `token`,
  `api_key`, `signing_key`, `private_key`, …, and every value of a `headers` object); the sheet shows a write's ANSWER
  redacted the same way (`writeRequestsOf` in `use-view-requests.ts`: settled mutations, oldest first). A secret the API
  returns once (A3) is shown only in its dialog, never stored in the browser, never logged.
- **No browser request to the API host**: `src/lib/api/no-direct-api-calls.test.ts` — one openapi-fetch client
  (`client.server.ts`), `fetch(` only in the reviewed public-file readers, no XHR / beacon / EventSource, `new WebSocket`
  only in `lib/live/use-live-*.ts` through `liveWsUrl` (`/v1/stream`) and in `lib/live/stream-socket.ts`, whose every
  caller is a `use-live-*` hook passing `liveWsUrl(…)`, the host named only by `env.ts` and the curl text.
- **Field map** (`src/lib/alerts/condition-fields.ts`): `FIELD_SPECS` (every `AlertConditionInput` field: editor kind,
  label, help, enum, bounds; `optionsByType` for `scope` / `kinds` / `interval` / `frequency`), `TYPE_FIELDS` (17 types),
  `CONDITION_FIELDS`, `TRIGGER_FIELDS` (`cooldown_bars` script / indicator, `rearm*` price types). `condition-fields.test.ts`
  parses the schema's descriptions ("Same types as `x`", "price types", "Keyword types", the `$ref` fields) and fails on a
  missing / extra type or field, an enum or a bound. The form model `alert-form.ts` (pure): `toCreateBody`,
  `toUpdateBody` (whole condition / trigger / delivery + the LOADED `version`; an emptied reference = null),
  `fromAlert` (edit, duplicate without the client reference id), `prefilledForm` (`?type=&symbol=`), `fieldErrorsOf` /
  `fieldKeyOf` (a 400's `param` / `errors[]` → `condition.<field>`, `trigger.<field>`, `destination_ids`, …, else `form`).
- **Routes** (`src/routes/alerts/`, Browse entry "Alerts"; tabs `src/lib/alerts/tabs.ts` — A3 / A4 append theirs):
  `route.tsx` (tabs + plan gate: `me.allowed_families` holds "Alerts"), `/alerts` (`?status=&type=&external_user_id=
  &client_reference_id=&symbol=&destination_id=`, all sent to the API; quota line from `meta.quota`; row actions; selection
  → bulk pause / resume / delete via `batchAlerts`, ≤ 500 items a request, per-item results `BatchResultsView`),
  `/alerts/new` (`?type=&symbol=` pre-fill, `?from=<id>` duplicate; "Check" = `validate_only`), `/alerts/$id`
  (summary, actions, the alert's events; `?edit=true` = the form; 409 `conflict` → "changed elsewhere" + Reload),
  `/alerts/events` (`?alert_id=&type=&external_user_id=&event=&live=true`). Views in `src/components/alerts/` (pure:
  `AlertsListView`, `AlertFormView`, `AlertDetailView`, `AlertEventsView`, `SingleEventView`; wiring
  `alert-editor.tsx`, `use-alert-actions.tsx`, `use-event-list.ts`). States: `AlertsState` (plan gate, 404 in the page's
  words, 503 = alerts switched off, 400 message); limits `LimitNotice` (quota-full 403 `plan_required` with the quota
  numbers on request — one `limit=1` list page —, `alert_user_limit_reached`, `alert_user_paused`).
- **Event lists are oldest first** in the API (no sort parameter): `useEventList` loads the next (newer) pages by itself up
  to `EVENT_PAGES_AUTO` (`useAutoLoadPages` with `max`, counted over every loaded page) (10 pages × 200, 1 credit each), shows the loaded events newest first and says how far they reach.
- **Live** (`src/lib/live/use-live-alerts.ts`, frames `parseAlertsFrame` / `alertsSubscribeFrame` in `ws-frames.ts`):
  subscribe `{ channel: "alerts", alert_ids?, external_user_id?, types?, after }` with `after` = the newest loaded (then the
  newest live) event — the API replays ≤ 1,000 missed events, also after a reconnect; new events on top, "New" + a 4-s
  highlight; `replay_truncated` → "Some events were skipped" + reload; an unknown frame of the channel is counted, never
  thrown; `bad_message` is a note; close 4001 / 4003 (the stream is STANDARD, the REST feed is free) / 4029 and
  `channel_unavailable` stop; other closes reconnect 1 s → 30 s × 10; `unavailable` re-subscribes after 10 s.
- Tests: `src/lib/api/{alerts-requests,no-direct-api-calls}.test.ts`, `mutations.test.tsx`, the redaction cases of
  `request-meta.test.ts`, `src/lib/alerts/*.test.ts`, the alerts cases of `ws-frames.test.ts`, `use-live-alerts.test.tsx`,
  `src/routes/-tests/alerts-{list,form,events}.test.tsx`. Fixtures `src/lib/alerts/alerts-fixtures.ts` (tests only; the spec
  has no response examples for alerts — they follow the schemas and its request / id examples).

### Ownership and offerings (backend `tasks/data-api-dashboard` O7 group 6)

- **Insider trades** (`$ticker/insider-trades`): URL `?side=&from=&to=` (filed days) `&tfrom=&tto=` (transaction days;
  a line without a transaction date — the realtime feed's — drops out) `&kind=derivative|non_derivative`
  (`is_derivative`) `&sort=oldest` (`filed_at`; default `-filed_at`, the only two orders) `&trade=<id>`. Every day
  filter is sent as a DAY (`filed_at.gte` / `.lte` are `format: date`: an instant was the 400 of `[FU2994]`; `.lte` is
  inclusive of the UTC day). Columns: no Owner CIK (in the detail), one "Code" column = the code (tooltip in words) +
  a "Deriv." marker, with a legend of the loaded codes under the table (`src/lib/sec/ownership.ts` `INSIDER_CODE_LABELS`).
  "Details" → `InsiderTradeDetailView` in a dialog (`/v1/insider-trades/{id}`, the loaded row shown at once): 10b5-1,
  direct / indirect + nature, derivative terms, before / after, footnotes, source, "Open the filing" (`/$ticker/filings?docs=`).
- **Holders** (`$ticker/holders`): `?instruments=all` (13F incl. options and principal; sent with the overview and the 13F
  tab only); 13F columns Discretion (`SOLE` / `DFND` / `OTR` in words), Voting authority, Filing (EDGAR index page; also
  N-PORT). Changes tab: type chips `?types=new,added` (none = the API's default, every change but unchanged), prior
  quarter `?prior=`, manager CIKs `?filer=` (DebouncedInput, comma list → `filer=`). The tab list wraps at phone width.
- **`/sec/$cik`** (13F manager): the portfolio is a `DataTable` (export, `?instruments=all`, discretion / voting, the
  quarter's 13F filing once above the table); "Position changes" under it, asked on a click (`?changes=true`, chips
  `?ctypes=`), the portfolio's quarter (`?period=`) else the latest due one; `HolderChangesList subject="security"`.
  Private offerings are a `DataTable` (export); an offering opens `/offerings/$offeringId`.
- **`/offerings`** (`BROWSE_NAV` "Offerings"): every Form D offering, `?from=&to=` (latest filing days), `?exemption=`
  (picker of the common codes), `?industry=` (as filed, exact, ≥ 2 characters), `?sold=` (USD presets),
  `?amendment=original|amendment`; one order (`-filed_latest`), no sort control; export. `/offerings/$offeringId`:
  `OfferingDetailView` (amounts incl. remaining, minimum, commissions / finders' fees, investors; issuer + co-issuers →
  `/sec/$cik`; exemptions; related persons; the filings, latest marked). The id = `OFFERING_ID_PATTERN`.
- **Funds**: the overview asks `useFund(ticker, ["coverage"])` (`CoverageCard noun="fund"`), lists the advisers
  (`FundAdvisersView`: role, CRD, LEI, affiliated) and the website (https only); holdings add ISIN and sector / country
  with their basis as a short tag (`BasisValue`); weights: `?dim=sector|country|asset_class` and the weight sum line
  (`weightSumText`: `meta.weight_pct_sum` + `weight_basis`; a leveraged fund is said to be far from 100 %).
- Shared files touched in place (beside appends): the insider hook / server function ([FU2994], assigned), the optional
  fields of `getHolderChanges`, `getV2Offerings` / `useV2OfferingsInfinite` (company optional), `getFund` / `useFund`
  (`expand`), `useFilerHoldingsInfinite` (`instruments`). Tests: `sec-v2-pages`, `sec-filer`, `holdings-page`,
  `fund-overview`, `offerings-pages` (`src/routes/-tests/`), `src/lib/sec/ownership.test.ts`.

### Destinations, deliveries, webhooks (backend `tasks/data-api-dashboard` 2-alerts task 3)

- **API layer**: `src/lib/api/server-functions-destinations.ts` over `destinations-requests.ts` (8 operations; zod bounds
  of `CreateDestinationRequest` / `UpdateDestinationRequest`; `:rotate-secret` / `:test` sent as written,
  `destinations-requests.test.ts`). Reads: `useDestinationsInfinite`, `useDestination`, `useDestinationDeliveriesInfinite`
  (`DESTINATION_QUERY_KEYS`; deliveries poll while a test delivery is watched). Writes in `WRITES`. Model (pure):
  `src/lib/alerts/destinations.ts` (form ↔ bodies, bounds checked against `openapi.json` in `destinations.test.ts`).
- **Secret rules (hard)**: the signing secret exists in two answers only (`DestinationCreated`, `DestinationSecret`).
  `takeSecret` reads it and DELETES it from the answer object in place, so the mutation state / mutation cache / the
  inspector's view of the write never hold it; the string lives only in `SecretOnceDialog`'s caller state and is dropped
  on close (the mutation is `reset()` too). Never in the query cache, `localStorage`, the URL, a toast, a log. Shown once
  with Copy and "You will not see this secret again"; closing uncopied asks first. Every destination a READ returns
  passes `withoutSecrets` on the server (drops any `secret` / `headers` field — the contract has none; the inspector
  shows read answers unredacted). Test: `src/routes/-tests/destinations-secret.test.tsx` (caches, storage, DOM after close).
- **Header values are write-only**: `type="password"`, `autocomplete="new-password"`, password-manager opt-outs; never
  read back (the API returns `header_names` only). PATCH semantics (spec): an omitted `headers` KEEPS the stored ones,
  an object REPLACES all of them, `null` removes them → edit offers Keep (default) / Replace / Remove. After a write
  settles its input forgets the values (`forgetHeaderValues`: the mutation cache keeps names only); the recorder
  redacts them in the request body (`redactSecrets`).
- **Routes**: `/alerts/destinations` (`?new=true` = create dialog; one `Idempotency-Key` per submission; a created one
  opens its page), `/alerts/destinations/$id` (`?edit=true`, `?status=` = delivery filter over the LOADED rows — the
  operation has no status filter —, `?test=<dlv_…>` = the watched test delivery: polled every 2 s for ≤ 30 s, then the
  notice says so), `/alerts/webhooks`. Every action confirms first (`destinationConfirmWords`: test, rotate — 24 h dual
  signature —, disable, re-enable, delete — `ConfirmAction` `details` lists the alerts from `listAlerts?destination_id=`,
  first page: "N" / "N+"). Destination chips of the alert pages link here.
- **Webhook reference**: generated at build time — `scripts/webhooks.mjs` (`webhookEntries`, `webhookEnvelope`; pure,
  types in `webhooks.d.mts`) feeds `WEBHOOKS` / `WEBHOOK_ENVELOPE` in `operations.gen.ts` (`pnpm generate:api`). The spec
  has NO example bodies: the page builds an example shape from each schema (required fields; `exampleBody`) and labels
  it. Signature / retry text = the spec's header and `2XX` descriptions only. `webhooks.test.ts` pins the export to the
  spec; a type removed from the spec leaves the page (`webhook-reference.test.tsx`).
- Views (pure): `DestinationsListView`, `DestinationFormView`, `DestinationDetailView`, `DeliveriesView`
  (+ `TestDeliveryNotice`), `WebhookReferenceView`; wiring `destination-editor.tsx`, `use-destination-actions.tsx`.
  Fixtures `src/lib/alerts/destinations-fixtures.ts` (fake secrets). Tests `src/routes/-tests/destinations-{views,secret}.test.tsx`.

### Alerts (backend `tasks/data-api-dashboard` 2-alerts task 4): end users, scripts, templates, entry points

- **API layer** (own pairs, beside A2's): `alert-users-requests.ts` + `server-functions-alert-users.ts` (the 7 alert-user
  operations and `GET` / `PATCH /v1/me/alert-user-defaults`), `scripts-requests.ts` + `server-functions-scripts.ts` (the 6
  script operations; no update-script operation exists). Inputs carry the spec's bounds (`src/lib/alerts/alert-users.ts`,
  `scripts.ts`: id / name ≤ 200, limits 0–100 000 000 or null, metadata ≤ 50 keys / 8 KB, ≤ 500 batch items, source ≤
  204 800 characters, name ≤ 100, description ≤ 1 000; `alert-users.test.ts` / `scripts.test.ts` read them from
  `openapi.json`). **`external_user_id` is any text and never trimmed**: openapi-fetch puts it into the path with
  `encodeURIComponent` (`team/a:b c` → `team%2Fa%3Ab%20c`, the `:pause` / `:resume` verbs stay verbs) and the router's
  `$externalUserId` is one encoded segment (`alert-users-requests.test.ts`, browser check). The ids `.` and `..` cannot be
  a path segment (every URL parser drops them as dot segments): `pathUserIdSchema` refuses them for the per-user
  operations and the list shows them as text without actions (`isPathSafeUserId`; a bulk upsert still takes them).
  `deleteScript`'s 204 returns
  `AlertWriteDone`. Writes appended to `WRITES`; reads in `queries.ts` under `ALERT_USER_QUERY_KEYS` (`users`, `defaults`)
  and `SCRIPT_QUERY_KEYS` (`scripts`); a user write also refetches the alerts and events (a pause / delete changes them),
  and A2's alert writes refetch the end users (usage counts their alerts). A finished delete (user `deleted`, a script)
  refetches the lists only, never the removed resource. Errors of a problem answer land on their fields through
  `problemFieldErrors` (`alert-form.ts`, shared with the alert form); the dialogs use A2's `FieldShell`.
- **`/alerts/users`** (`?status=&q=`: `q` = the API's id PREFIX, both sent): id + display name (→ its page), status
  (the spec has no pause source: status only), usage against the three EFFECTIVE limits (`UsageBar`, "· default" when
  the limit is the account default; `limitRows` / `limitSource` own | default | none), last fired; row actions Pause /
  Resume / Delete (each `ConfirmAction`: `alertUserConfirmWords` names `usage.active_alerts`), Edit. "Add end user" /
  Edit = `AlertUserEditDialog` (Edit: PATCH of every field it shows, an empty limit = null = the account default; Add:
  only the fields filled in, since the id may exist — `toAlertUserBody(state, { create })`).
  "Bulk upsert" = `AlertUserBatchDialog`: paste JSON (list or `{ items }`) or CSV with a header (`BATCH_CSV_COLUMNS`;
  empty cell = not set, `null` = null) or read a file; `parseAlertUserBatch` checks every item with zod
  (`alertUserBatchItemSchema`) and repeated ids; the preview shows the first 10 problems and how many ≤ 500 requests;
  an unclosed quote is refused; Send only when clean (parsed after typing: `useDeferredValue`); per-item results through A2's `BatchResultsView` (its `BatchItemResult` type takes both batches).
  A delete shows `AlertUserDeleteResult` (`deleteResultText`); a `deleting` end user stays listed with that status.
  "End-user defaults" panel (`alert-user-defaults.tsx`, anchor `#defaults`, linked from `/account`): PATCH of the
  changed fields only (`toDefaultsBody`; null = no limit).
- **`/alerts/users/$externalUserId`**: profile + metadata (`JsonTree`), each limit's own value vs the effective one and
  where it comes from (`limitOriginText`), usage bars, the end user's alerts (`listAlerts?external_user_id=`, the alerts
  list with its row / bulk actions) and events (`listAlertEvents?external_user_id=`, newest first via `useEventList`).
- **Alert form**: the end-user field is `AlertUserPicker` (free text + a `<datalist>` of existing ids by prefix:
  `useAlertUserOptions`, one `listAlertUsers?q=&limit=20` page once typing rests 300 ms; idle while the field is empty). `/alerts/new` also reads
  `?script=&version=` (a `script` alert of that version id) and `?template=` (an `indicator` alert of that template):
  `prefilledForm(type, symbol, { template, version })`, `newAlertDescription`.
- **The form's pickers** (A4 handed over second, so it owns them; `alert-form-pickers.tsx`, data from
  `useAlertFormPickers`): **destinations** = a checklist of the account's destinations (every page; URL / description,
  kind · preset; a disabled one can be picked and says so; at most 10; an id the account does not list stays as a
  removable chip) with "New destination…" = A3's `DestinationEditorDialog` inline (secret shown once, then the new id is
  picked); **script version** (`script` alerts only, so no request otherwise) = a script (`?script=`, else the one whose
  latest version the form holds), then one of its COMPILED versions (a version id not listed is kept and named); the
  picked version's declared inputs become fields that write `condition.inputs` JSON (`withInput`; empty = the default).
  The form state stays text (`destinationIds`, `script_version_id`, `inputs`): `toCreateBody` / `fromAlert` unchanged;
  without picker data `AlertFormView` shows the text fields as before.
- **`/alerts/scripts`** (`?tab=templates`): scripts (name + description, versions of 20, the latest version's status and
  diagnostics, updated) and "Upload script" (`ScriptUploadDialog`: name, description, source as text or file; a source
  above 204 800 characters is refused before anything is sent, `sourceProblem`; a compile error is still an upload; a 429
  = another compile of the account is running). Templates tab = `TemplateListView` (key, version, fidelity with
  `FIDELITY_MEANING`, inputs with defaults and bounds, source; "Use template" → `/alerts/new?type=indicator&template=`).
- **`/alerts/scripts/$id`** (`?version=`): versions newest first; the picked version's status, compiler, SHA-256, id,
  declared inputs (`manifestInputs` reads the free `manifest` through guards: chartlang's `inputs` =
  `{ name: { kind, defaultValue, title?, min?, max?, options? } }`), **"Alert condition ids" = `ScriptVersion.alert_ids`:
  the ids `condition.alert_ids` can name (its `defineAlertCondition` ids and `alert()` call sites), NOT the alerts using
  the version** — the contract has no way to list those (no `listAlerts` filter by script); diagnostics linking
  `#script-L<n>`; the source as one anchored row per line (`ScriptSourceView`, marked lines with a caret under the
  column; the box scrolls sideways, never the page). "Create alert from this version" (an `ok` version only) →
  `/alerts/new?type=script&script=&version=`; "Upload new version" (the button says "20 of 20 versions — limit reached");
  Delete confirmed; a 409 → `ScriptDeleteConflict`: the API's `detail` with every `alt_…` id it names linked
  (`alertIdsInDetail`; the API names ≤ 5 and "and more").
- **Entry points on ticker pages** (`create-alert-button.tsx`, `AlertEntryPoints`): overview (price types + a stock's
  `fundamental_metric`, in the overview's `PageHeader`), calls list + call page (`earnings_call`, `earnings_call_keyword`,
  `earnings_results`, `event_countdown`), news (`news`, `news_keyword`), filings (`filing`, `filing_keyword`), dividends
  (`dividend`): "Create alert" (one type = a link, several = a menu) → `/alerts/new?type=&symbol=`, and "N alerts on X" →
  `/alerts?symbol=X` (N = one `listAlerts?symbol=&limit=100` page, "100+" when `has_more`; `useSymbolAlertCount`, cached
  5 min). `entryTypesFor`: nothing when the instrument's `datasets` lacks `alerts`; a non-stock keeps
  `NON_STOCK_ALERT_TYPES` only (the spec: an ETF takes `dividend`, `event_countdown`, `filing*` and the instrument types,
  and refuses `earnings_call*`, `earnings_results`, `fundamental_metric`, `news*`) — an ETF's news page has none. Hidden
  without a key or the alerts plan (`plansAlerts`, now in `src/lib/alerts/labels.ts`; `route.tsx` re-exports it).
- Tests: `src/lib/api/alert-users-requests.test.ts` (paths incl. the encoded id, methods, verbs, 204 / 409),
  `src/lib/alerts/{alert-users,scripts}.test.ts`, `src/routes/-tests/{alert-users-pages,scripts-pages,alert-entry-points}.test.tsx`.
  Fixtures appended to `src/lib/alerts/alerts-fixtures.ts` (the spec's `smoke-a` / defaults / `createScript` examples,
  `ODD_USER_ID`).

### Reference (O7 group 7: catalog, companies, status)

- **`/catalog`** (`src/routes/catalog.tsx`, `BROWSE_NAV` "Catalog"): tabs Metrics | Sections | Forms | Event types |
  Document kinds | Mapping rules = the six `/v1/catalog/*` operations (free, 1 credit a page; hooks
  `useMetricCatalogInfinite` … `useMappingRulesInfinite`, each `enabled` only while its tab is open). The open tab loads
  all its pages (`useAutoLoadPages`, 200 a page: metrics 2, mapping rules 5) because the API has no text filter: `?q=`
  (`DebouncedInput`) filters the loaded rows (`filterCatalogRows` in `src/lib/reference/catalog.ts`: a `q` equal to a
  row's id keeps exactly that row, else every word must match). API filters in the URL: `?statement=` (metrics, mapping
  rules), `?form=` (sections), `?metric=` (mapping rules → `metric_id`, set by a metric row's "Mapping rules" link, a
  chip clears it); a form row links its sections. A mapping rule's `rule` is free JSON (`SecJson`): `mappingRuleView`
  reads kind, concept (`taxonomy:alias (role)`) or formula, parent and sign defensively. Export per tab.
- **Metric catalog links**: `MetricCatalogLink` (`src/components/reference/metric-catalog-link.tsx`, a book icon,
  click never opens the row chart) beside every financial metric label → `/catalog?q=<metric_id>`; only for ids of the
  catalog's families (`isCatalogMetricId`: `is_ | bs_ | cfs_ | ratio_ | growth_ | cagr_ | seg_`), so an as-reported
  concept gets none. Wired in `financials-flat-table.tsx`, `financials-presentation-table.tsx`,
  `financial-metrics-table.tsx` (`MetricsTableRow.metricId`, set by ratios / growth / CAGR; ratios link from the metric
  column), `segmented-financials-table.tsx`, `segments-detailed.tsx`.
- **`/instruments` Companies tab** (`?view=companies`): `GET /v1/companies` (`useCompaniesInfinite`, `CompaniesList`
  in `src/components/reference/companies-list.tsx`) with the page's search, exchange and sort (`symbol` → `ticker`)
  plus `?sector=` (choices = the sectors the API answered on 2026-11-21, `COMPANY_SECTORS`; the spec has no enum); logo
  + ticker → `/$ticker`, name, exchange, sector, fiscal year end (`MM-DD` → "Sep 30"; served on the rows since 2026-11-22 — it was null everywhere before,
  "—" when null), CIK → `/sec/$cik`. Each tab's list is its own component, so only the open tab's request runs.
- **Status widget** (`src/components/reference/api-status.tsx`): `/account` shows `AccountStatusCards` = the API status
  card (`GET /status`, `useApiStatus`: overall = the worst family, the families as a table with 7 / 30 / 90-day uptime,
  the coverage universe, the docs groups with uptime and p50 / p95 buckets behind a disclosure) and the licensing card
  (`GET /status/licensing`, `useApiLicensing`: the caller's plan's rights with the policy's notes, the resale rule,
  "Draft" while `counsel_signed_off` is false, routes per family the plan reaches by tier order). The sidebar's Help
  block has `ApiStatusDot` beside "API status" (same cached `/status` query, asked once the key answered; colour = the
  overall status, the summary in its label). Both operations need no key and cost nothing. `/status` and `/licensing`
  stay 301 redirects; `/health` has no view (reason in the coverage table).
- **Fiscal periods**: the stock overview has a "Fiscal periods" card (`fiscal-periods-card.tsx`) when the instrument
  has the `fiscal_periods` dataset — `useCompanyFiscalPeriods` (the filings list's request, every page), newest 8 +
  "Show all" (Export = the shown rows), the latest fiscal year end = the newest Q4's period end.
- **Dividends** (`?from=&to=&sort=`): the ex-date range as `ex_date.gte` / `.lte` (a swapped range is ordered), sort
  ex-date / pay date either way, a Type column (`dividend_type` codes in words: CD regular cash, SC special cash, LT /
  ST capital gains; another code as itself). **Market holidays** (`?from=&to=`): a day range inside the Upcoming / Past
  tab (`holidaysRequest`: it narrows the tab, never leaves it).
- Tests: `src/routes/-tests/reference-pages.test.tsx`, `src/lib/reference/catalog.test.ts`; fixtures
  `src/lib/reference/reference-fixtures.ts` (tests only).

### UI Components (`src/components/ui/`)

Base UI components built on `@base-ui/react` primitives with `class-variance-authority` for variants. Uses `cn()` utility from `src/lib/utils.ts` (clsx + tailwind-merge).

### Environment

- `INVINITE_DATA_API_KEY`: Server-side API key (optional, can be set via UI)
- `INVINITE_DATA_API_URL`: API base URL (defaults to https://api.data.invinite.com)

Validated with `@t3-oss/env-core` in `src/lib/env.ts`.

The app origin is NOT an env var: `src/lib/app-url.ts` (`INVINITE_APP_URL` = `https://data.invinite.com`, `dataApiDashboardUrl`, `docsUrl`) is a plain constant because `env.ts` reads `process.env` and is server-only, while its links render in the browser. A Data API account (keys, usage, credits, invoices) lives in the Invinite Data app (`/`, `/keys`, `/usage`, `/billing`; docs at `/docs`) — this explorer's `/account` (O5) only reads `/v1/me` + `/v1/me/usage`; keys, invoices and plan changes link there (the account page, the key fields' "No key yet?" line).

## Code Style

- 4-space indentation, double quotes, semicolons (via @stylistic/eslint-plugin)
- Import sorting via eslint-plugin-perfectionist (recommended-natural)
- React Compiler enabled (`react-compiler/react-compiler: error`)
- Blank lines required before most statements (const, let, if, return, etc.)
- Path alias: `@/*` maps to `./src/*`

## Data contract ownership

SDK generation/packaging/publication and API/MCP reference export belong to
`invinite-data-api`; CLI command/reference export belongs to `invinite-data-cli`.
This example dashboard retains its UI, server-side API consumption and
`generate:api` frontend type projection. Its `openapi.json` is a pinned consumer
artifact: adopt `reference/openapi.json` from a versioned API reference bundle,
then regenerate its local types and run mocked tests. No SDK generator or source
introspection of sibling checkouts belongs here. An ownership-only SDK move does
not require a dashboard spec refresh or runtime deployment.

## Operation coverage

Operation → the page that shows it (backend `tasks/data-api-dashboard` O7, requirement 7): every operation the dashboard
calls, with its page. Created by O7 group 1 from `server-functions.ts` at `ab8a89c` (62 + task 5's `getMe`,
`getMyUsage`, `getIpo` = 65) plus group 1's rows (`listPeople`, `getPerson`; `listParticipants?person=`) and group 4's (`listFactPlaces`; `getFact` and
`listSegmentsDetailed` were called with no view before), group 7's (the six catalogs, `listCompanies`, `statusGet`, `statusLicensing`;
`healthGet` with its reason), group 6's (`getInsiderTrade`, `getOffering`, `listFilerHoldingChanges`); group 5 adds no operation, it widens five rows (`listKpis`,
`searchTranscripts`, `getEventComparison`, `listInvestorDocuments`, `getInvestorDocument`). Every O7
group appended its rows, the alerts tasklist its 36 (30 alert / destination + 6 script operations); an operation
with no view states why here. **Complete (A4-final, 2026-11-21): 125 rows = the 125 operation ids of `openapi.json`, each
exactly once** — the 124 HTTP operations of `operations.gen.ts` plus the WebSocket `streamEvents` (`WS /v1/stream`, one
row naming its channels). `src/lib/api/coverage.test.ts` parses this table against `openapi.json` and fails on a
missing, duplicate or unknown id: a new operation of the spec needs its row (page or reason) here.

| Operation | Request | Page |
|-----------|---------|------|
| `getAsReportedFinancials` | `GET /v1/financials/as-reported` | `/$ticker/financials?view=as-reported` (summary) |
| `getAsReportedFinancialsDetailed` | `GET /v1/financials/as-reported/detailed` | `/$ticker/financials?view=as-reported` (detailed) |
| `getAsReportedFinancialsPresentation` | `GET /v1/financials/as-reported/presentation` | `/$ticker/financials?view=as-reported` (presentation) |
| `getAudio` | `GET /v1/events/{event_id}/audio` | call page · player (on Play) |
| `getCompany` | `GET /v1/companies/{company}` | `/$ticker` (overview); `/$ticker/documents`; `/$ticker/news` |
| `getDocumentFigure` | `GET /v1/document-versions/{version_id}/figures/{block_id}` | SEC documents panel (`/$ticker/filings`, `/sec/$cik`) |
| `getDocumentVersion` | `GET /v1/document-versions/{version_id}` | SEC documents panel (`/$ticker/filings`, `/sec/$cik`); `/filings/$accession` reader (O7 group 3) |
| `getEvent` | `GET /v1/events/{event_id}` | call page; `/people/$personId` (one per loaded call) |
| `getEventComparison` | `GET /v1/events/{event_id}/comparison` | call page · Metrics & diff tab (`prior` picker, O7 group 5) |
| `getEventStats` | `GET /v1/events/{event_id}/stats` | call page · Metrics & diff tab |
| `getFact` | `GET /v1/facts/{fact_id}` | `/$ticker/financials` Standardized · Detailed: a value opens "Explain this number" (O7 group 4) |
| `getFiler` | `GET /v1/filers/{cik}` | `/sec/$cik`; sidebar (filer context) |
| `getFiling` | `GET /v1/filings/{accession}` | SEC documents panel; `/$ticker/filings` (HTML dialog); `/filings/$accession` (header, Documents; Parties & relations = `expand=parties,relations`; O7 group 3); call page header (results filing / periodic report, O7 group 5) |
| `getFund` | `GET /v1/funds/{fund}` | `/$ticker` (fund overview; `expand=coverage`, advisers, website — O7 group 6) |
| `getInsiderTrade` | `GET /v1/insider-trades/{id}` | `/$ticker/insider-trades` (row detail, `?trade=`; O7 group 6) |
| `getInstrument` | `GET /v1/instruments/{symbol}` | `/$ticker` layout + overview; `/$ticker/filings`; `/$ticker/financials`; sidebar |
| `getInvestorDocument` | `GET /v1/investor-documents/{document_id}` | `/$ticker/documents`; call page · Documents tab (`expand=pages`) |
| `getIpo` | `GET /v1/ipos/{ipo_id}` | `/ipo-calendar` (row detail) |
| `getLiveAudio` | `GET /v1/events/{event_id}/live-audio` | call page · player (live) |
| `getMe` | `GET /v1/me` | key gate (every page); `/account`; plan badges; `/$ticker/financials` statement views |
| `getMyUsage` | `GET /v1/me/usage` | `/account` |
| `getNewsItem` | `GET /v1/news/{id}` | `/$ticker/news` (item panel) |
| `getNewsText` | `GET /v1/news/{id}/text` | `/$ticker/news` (item panel) |
| `getOffering` | `GET /v1/offerings/{offering_id}` | `/offerings/$offeringId` (O7 group 6) |
| `getPerson` | `GET /v1/people/{person_id}` | `/people/$personId`; sidebar (person context) |
| `getPressRelease` | `GET /v1/events/{event_id}/press-release` | call page · Press release tab |
| `getPriceAttribution` | `GET /v1/events/{event_id}/price-attribution` | call page · Price moves tab + live player |
| `getProsody` | `GET /v1/events/{event_id}/prosody` | call page · Prosody tab |
| `getSlides` | `GET /v1/events/{event_id}/slides` | call page · Slides tab |
| `getStandardizedFinancials` | `GET /v1/financials/standardized` | `/$ticker/financials?view=standardized` (summary) |
| `getStandardizedFinancialsDetailed` | `GET /v1/financials/standardized/detailed` | `/$ticker/financials?view=standardized` (detailed) |
| `getStandardizedFinancialsPresentation` | `GET /v1/financials/standardized/presentation` | `/$ticker/financials?view=standardized` (presentation) |
| `getTranscript` | `GET /v1/events/{event_id}/transcript` | call page · Transcript tab + player (words) |
| `getTranscriptDiff` | `GET /v1/events/{event_id}/transcript-diff` | call page · Transcript tab (Compare) |
| `getTranscriptText` | `GET /v1/events/{event_id}/transcript-text` | call page · Transcript tab (Sections / Plain text) |
| `listAnnouncements` | `GET /v1/announcements` | `/$ticker/news` (item panel, by news item); `/$ticker/news?view=announcements` (Announcements tab, `?company=`) |
| `listCagr` | `GET /v1/metrics/cagr` | `/$ticker/financials?view=cagr` |
| `listDividends` | `GET /v1/dividends` | `/$ticker/dividends` (O7 group 7: `?from=&to=` → `ex_date.gte` / `.lte`, `?sort=` ex-date / pay date) |
| `listEvents` | `GET /v1/events` | `/`; `/calendar`; `/live-calls`; `/$ticker` (overview); `/$ticker/earnings-calls`; `/$ticker/documents`; sidebar (live count); call page (live session); `/$ticker/news` "Filter by call" (on click); call page · Metrics & diff (`prior` picker, on open; O7 group 5) |
| `listFactPlaces` | `GET /v1/fact-places` | "Explain this number" → Show in filing (`fact=`; O7 group 4); `/filings/$accession` Documents → Fact places (`document_version=`; O7 group 3) |
| `listFilerHoldingChanges` | `GET /v1/filers/{cik}/holding-changes` | `/sec/$cik` (13F portfolio · Position changes, on a click; O7 group 6) |
| `listFilerHoldings` | `GET /v1/filers/{cik}/holdings` | `/sec/$cik` (13F portfolio; `instruments=`) |
| `listFilers` | `GET /v1/filers` | `/institutions`; top-bar search; filer lookup |
| `listFilings` | `GET /v1/filings` | `/$ticker/filings`; `/$ticker` (overview); `/sec/$cik`; sidebar (filer context); `items` / `filed_at` filters on `/$ticker/filings` (O7 group 3) |
| `listFiscalPeriods` | `GET /v1/fiscal-periods` | `/$ticker/filings` (period labels); `/$ticker` (stock overview, "Fiscal periods" card; O7 group 7) |
| `listFundPositions` | `GET /v1/funds/{fund}/holdings` | `/$ticker/holdings`; `/$ticker` (fund overview) |
| `listFundWeights` | `GET /v1/funds/{fund}/weights` | `/$ticker/holdings` (`dimension=`, weight sum) |
| `listFunds` | `GET /v1/funds` | `/funds` |
| `listGrowth` | `GET /v1/metrics/growth` | `/$ticker/financials?view=growth` |
| `listGuidance` | `GET /v1/guidance` | call page · Guidance tab (+ history dialog) |
| `listHolderChanges` | `GET /v1/holder-changes` | `/$ticker/holders?tab=changes` (`type`, `filer`, `prior_period_end`) |
| `listHolders` | `GET /v1/holders` | `/$ticker/holders` (`instruments=` on the overview / 13F) |
| `listInsiderTrades` | `GET /v1/insider-trades` | `/$ticker/insider-trades` (filed / traded days, `is_derivative`, `sort`) |
| `listInstruments` | `GET /v1/instruments` | `/instruments`; top-bar search |
| `listInvestorDocuments` | `GET /v1/investor-documents` | `/$ticker/documents`; call page · Documents tab (`sort`) |
| `listIpos` | `GET /v1/ipos` | `/ipo-calendar`; `/` |
| `listKpis` | `GET /v1/kpis` | call page · Guidance tab (KPIs `event=`; KPI history `company=&metric=&sort=`, O7 group 5) |
| `listMarketHolidays` | `GET /v1/market-holidays` | `/market-holidays` (O7 group 7: `?from=&to=` → `date.gte` / `.lte` inside the tab); `/` |
| `listNews` | `GET /v1/news` | `/$ticker/news` (incl. `?event=` / `?sort=`); `/news-feed` (watchlist as one `company=<comma list>` per page) |
| `listOfferings` | `GET /v1/offerings` | `/sec/$cik` (private offerings, `company=<cik>`); `/offerings` (every issuer, filters; O7 group 6) |
| `listParticipants` | `GET /v1/participants` | call page · Participants tab, Transcript / Q&A (images), Search this call, live transcript (`event=`); `/people/$personId` (`person=`) |
| `listPeople` | `GET /v1/people` | `/people`; top-bar search (People group) |
| `listQa` | `GET /v1/events/{event_id}/qa` | call page · Q&A tab |
| `listRatios` | `GET /v1/metrics/ratios` | `/$ticker/financials?view=ratios` |
| `listSegments` | `GET /v1/segments` | `/$ticker/financials?view=segments` |
| `listSegmentsDetailed` | `GET /v1/segments/detailed` | `/$ticker/financials?view=segments&layout=detailed` (O7 group 4; metric / axis sent) |
| `listSplits` | `GET /v1/splits` | `/$ticker/stock-splits` |
| `listTranscriptVersions` | `GET /v1/events/{event_id}/transcript-versions` | call page · Transcript tab (version select) |
| `searchFilings` | `GET /v1/search/filings` | SEC filing search (`/$ticker/documents`); `/$ticker/filings` "Search text" (stocks and funds); `/filings` "Search every filer" (no `symbol`; O7 group 3) |
| `searchInvestorDocuments` | `GET /v1/search/investor-documents` | `/$ticker/documents` |
| `searchTranscripts` | `GET /v1/search/transcripts` | call page / calls list · Search this call; `/search` (every company, O7 group 5) |
| `searchNews` | `GET /v1/search/news` | `/$ticker/news` search box (company); `/news-feed` search box (watchlist comma list, or no company = every company) |
| `getReviewChain` | `GET /v1/filings/{accession}/review-chain` | `/filings/$accession` Review chain tab (O7 group 3) |
| `listDatasets` | `GET /v1/datasets` | `/sec/datasets` (O7 group 3) |
| `listDocumentSections` | `GET /v1/document-versions/{version_id}/sections` | `/filings/$accession` Documents → Sections (O7 group 3) |
| `listFilingFacts` | `GET /v1/filings/{accession}/facts` | `/filings/$accession` Facts tab (O7 group 3) |
| `listFilingHoldings` | `GET /v1/filings/{accession}/holdings` | `/filings/$accession` Holdings tab, 13F-HR / NPORT-P only (O7 group 3) |
| `listFilingNotes` | `GET /v1/filings/{accession}/notes` | `/filings/$accession` Notes tab (O7 group 3) |
| `streamEvents` | `WS /v1/stream` (one row, four channels) | `events.live`: call page · live player and transcript; `news`: `/$ticker/news`, `/news-feed` "Live"; `filings` (`new_filing`): `/$ticker/filings` "Live", `/filings` (O7 group 3); `alerts` (`alert_event`): `/alerts/events` "Live" (alerts task 2) |
| `listMetricCatalog` | `GET /v1/catalog/metrics` | `/catalog` Metrics (`statement`; every financial metric label links `/catalog?q=<metric_id>`; O7 group 7) |
| `listSectionCatalog` | `GET /v1/catalog/sections` | `/catalog?tab=sections` (`form`; O7 group 7) |
| `listFormCatalog` | `GET /v1/catalog/forms` | `/catalog?tab=forms` (O7 group 7) |
| `listEventTypeCatalog` | `GET /v1/catalog/event-types` | `/catalog?tab=event-types` (O7 group 7) |
| `listDocumentKindCatalog` | `GET /v1/catalog/document-kinds` | `/catalog?tab=document-kinds` (O7 group 7) |
| `listMappingRules` | `GET /v1/catalog/mapping-rules` | `/catalog?tab=mapping-rules` (`statement`, `metric_id` from a metric row; O7 group 7) |
| `listCompanies` | `GET /v1/companies` | `/instruments?view=companies` (Companies tab: `q`, `exchange`, `sector`, `sort`; O7 group 7) |
| `statusGet` | `GET /status` | `/account` (API status card); sidebar Help (status dot beside "API status"); O7 group 7 |
| `statusLicensing` | `GET /status/licensing` | `/account` (licensing card: the plan's rights, routes per family); O7 group 7 |
| `healthGet` | `GET /health` | No view, by design: a liveness probe (`status`, `timestamp`) that says nothing a reader can act on; `/status` (above) carries the product states and uptime the dashboard shows |
| `listAlerts` | `GET /v1/alerts` | `/alerts` (filters incl. 7.1's `symbol` / `destination_id`; quota line); quota on a refused create (`limit=1`) (alerts task 2); `/alerts/users/$externalUserId` (`external_user_id`), the ticker pages' "N alerts on X" (`symbol`, `limit=100`) (alerts task 4) |
| `createAlert` | `POST /v1/alerts` | `/alerts/new` (Create with `Idempotency-Key`; Check = `validate_only`) (alerts task 2) |
| `getAlert` | `GET /v1/alerts/{id}` | `/alerts/$id`; `/alerts/new?from=` (Duplicate) (alerts task 2) |
| `updateAlert` | `PATCH /v1/alerts/{id}` | `/alerts/$id?edit=true` (with `version`) (alerts task 2) |
| `deleteAlert` | `DELETE /v1/alerts/{id}` | `/alerts` row action; `/alerts/$id` (confirmed) (alerts task 2) |
| `pauseAlert` | `POST /v1/alerts/{id}:pause` | `/alerts` row action; `/alerts/$id` (alerts task 2) |
| `resumeAlert` | `POST /v1/alerts/{id}:resume` | `/alerts` row action; `/alerts/$id` (alerts task 2) |
| `testAlert` | `POST /v1/alerts/{id}:test` | `/alerts` row action; `/alerts/$id` "Send test event" (confirmed) (alerts task 2) |
| `batchAlerts` | `POST /v1/alerts:batch` | `/alerts` bulk pause / resume / delete (confirmed; per-item results) (alerts task 2) |
| `listAlertEvents` | `GET /v1/alert-events` | `/alerts/events` (alerts task 2); `/alerts/users/$externalUserId` (`external_user_id`) (alerts task 4) |
| `getAlertEvent` | `GET /v1/alert-events/{id}` | `/alerts/events?event=` (e.g. from "Send test event") (alerts task 2) |
| `listAlertEventsForAlert` | `GET /v1/alerts/{id}/events` | `/alerts/$id` (events) (alerts task 2) |
| `listAlertTemplates` | `GET /v1/alert-templates` | `/alerts/new`, `/alerts/$id?edit=true` (indicator template picker) (alerts task 2); `/alerts/scripts?tab=templates` (alerts task 4) |
| `listDestinations` | `GET /v1/destinations` | `/alerts/destinations` (alerts task 3) |
| `createDestination` | `POST /v1/destinations` | `/alerts/destinations?new=true` (`Idempotency-Key`; secret shown once) (alerts task 3) |
| `getDestination` | `GET /v1/destinations/{id}` | `/alerts/destinations/$id` (alerts task 3) |
| `updateDestination` | `PATCH /v1/destinations/{id}` | `/alerts/destinations/$id?edit=true`; Disable / Re-enable (`status`, confirmed) (alerts task 3) |
| `deleteDestination` | `DELETE /v1/destinations/{id}` | `/alerts/destinations` row action; `/alerts/destinations/$id` (confirmed, names the alerts using it) (alerts task 3) |
| `rotateDestinationSecret` | `POST /v1/destinations/{id}:rotate-secret` | `/alerts/destinations/$id`, list row action (confirmed; secret shown once) (alerts task 3) |
| `testDestination` | `POST /v1/destinations/{id}:test` | `/alerts/destinations/$id?test=` (confirmed; delivery watched ≤ 30 s) (alerts task 3) |
| `listDestinationDeliveries` | `GET /v1/destinations/{id}/deliveries` | `/alerts/destinations/$id` (deliveries; status filter over the loaded rows) (alerts task 3) |
| `listAlertUsers` | `GET /v1/alert-users` | `/alerts/users` (`?status=&q=`); the alert form's end-user suggestions (`q` prefix, `limit=20`) (alerts task 4) |
| `getAlertUser` | `GET /v1/alert-users/{external_user_id}` | `/alerts/users/$externalUserId` (alerts task 4) |
| `updateAlertUser` | `PATCH /v1/alert-users/{external_user_id}` | `/alerts/users` "Add end user" / Edit, `/alerts/users/$externalUserId` Edit (upsert) (alerts task 4) |
| `deleteAlertUser` | `DELETE /v1/alert-users/{external_user_id}` | `/alerts/users` row action, `/alerts/users/$externalUserId` (confirmed; erasure counts shown) (alerts task 4) |
| `batchAlertUsers` | `POST /v1/alert-users:batch` | `/alerts/users` "Bulk upsert" (JSON / CSV paste, ≤ 500 a request, per-item results) (alerts task 4) |
| `pauseAlertUser` | `POST /v1/alert-users/{external_user_id}:pause` | `/alerts/users` row action, `/alerts/users/$externalUserId` (confirmed) (alerts task 4) |
| `resumeAlertUser` | `POST /v1/alert-users/{external_user_id}:resume` | `/alerts/users` row action, `/alerts/users/$externalUserId` (confirmed) (alerts task 4) |
| `getAlertUserDefaults` | `GET /v1/me/alert-user-defaults` | `/alerts/users#defaults` (linked from `/account`); the edit dialog's "account default" hints (alerts task 4) |
| `updateAlertUserDefaults` | `PATCH /v1/me/alert-user-defaults` | `/alerts/users#defaults` "Edit defaults" (changed fields only) (alerts task 4) |
| `listScripts` | `GET /v1/scripts` | `/alerts/scripts` (alerts task 4) |
| `createScript` | `POST /v1/scripts` | `/alerts/scripts` "Upload script" (alerts task 4) |
| `getScript` | `GET /v1/scripts/{id}` | `/alerts/scripts/$id` (alerts task 4) |
| `deleteScript` | `DELETE /v1/scripts/{id}` | `/alerts/scripts/$id` Delete (confirmed; a 409 names the alerts) (alerts task 4) |
| `createScriptVersion` | `POST /v1/scripts/{id}/versions` | `/alerts/scripts/$id` "Upload new version" (alerts task 4) |
| `listScriptVersions` | `GET /v1/scripts/{id}/versions` | `/alerts/scripts/$id` (versions, diagnostics, source) (alerts task 4) |
