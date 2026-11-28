## Run

`pnpm run dev` starts the Vite dev server. Open the printed local URL (usually
`http://localhost:3001`).

Live: https://data-api-dashboard.netlify.app/ (Netlify builds `main` on push). Keys, usage and billing
live in the Invinite Data app, https://data.invinite.com (docs: https://data.invinite.com/docs).

## What you see

A top bar (search with ⌘K, theme, key and plan, the **API** toggle), a sidebar of collapsible groups (Market,
Securities, Filings, News & search, US macro, Build; on an instrument page its sections come first and also sit as
tabs under the instrument header) and the page. From 1280 px the sidebar is docked on the left and the request panel
docks on the right; below 1024 px the sidebar is off-canvas, below 1280 px the panel is a sheet (from the bottom on a
phone). No page scrolls sideways: a wide table scrolls inside itself.

**The request panel is how to learn the API from the app.** Press **API** in the top bar (or `.`) on any page: it lists
the requests that page sent — method, path and query as sent, status, credits charged, the plan the operation needs —
with a ready `curl` (the key as `$INVINITE_API_KEY`, never the real one), the `invd` CLI command, the answer as a
collapsible JSON tree and a link to the operation's docs. Requests the shell sends on every page (the sidebar's live
count, the instrument header, the search) are folded under "App requests"; writes (alerts) are listed with their
answer, secrets redacted.

## API key

You can provide `INVINITE_DATA_API_KEY` two ways:

- UI: on the home page (`/`), enter the key in the API key field. It is stored
  in `localStorage` (`invinite-data-api-key`) and used for client requests.
- Env var: set `INVINITE_DATA_API_KEY` in your environment (or a `.env` file) before
  starting the dev server. This is used on the server/SSR side.

REST requests always go through the server functions. A key-bearing dashboard RPC uses a same-origin POST body. The server still calls the original API method and path. One exception: the live
transcript of an earnings call in progress opens
`wss://<api>/v1/stream?api_key=<stored key>` (channel `events.live`; live news: `news`) straight from the browser (the app runs on
Netlify, which cannot hold a server-side socket, and the key is already in this
browser's `localStorage`). Without a key entered in the UI the live player asks for one.

## API types

The last published baseline is `data-sdk-v13.2.0`. This branch pins `openapi.json` and `sdk-contract.json` to the
unpublished statement-member reference at API commit `635ff3e19b76524fda4fc53d812aec9d4670051d`, which includes
the 13.2 baseline. Use the published statement-member tag for deployment after its API smoke passes. Copy both
files from the same reference bundle and run `pnpm generate:api` to regenerate the API types and operation metadata.
`pnpm-workspace.yaml` records pnpm 11's `allowBuilds` decisions (esbuild's postinstall
runs, the others are skipped) so `pnpm install` / `pnpm run` do not stop on
`ERR_PNPM_IGNORED_BUILDS`.

## Routes

- `/` — landing page, API key input, and intro cards.
- `/$ticker` — overview of any instrument: a stock's company profile (e.g. `/AAPL`), a fund's profile (`/VOO`: net assets with scope, expense ratio, classes, composition source), an ETN's listing. The sidebar shows only the sections that exist for the instrument (its `datasets` in the API); an unknown symbol is one notice.
- `/funds` — every listed ETF and closed-end fund (type / structure filters, search, net assets).
- `/$ticker/filings` — SEC filings with filters, HTML/PDF viewers.
- `/$ticker/earnings-calls` — the company's earnings calls (Upcoming / Past, availability per call; a not-covered notice outside the coverage scope) and a company-wide keyword search over its transcripts ("Search this call", company scope).
- `/$ticker/earnings-calls/$eventId?tab=` — one call: header (time, status, materials, call-time observations) and tabs — Transcript (formats, versions, diff), Slides, Press release, Documents, Guidance & KPIs (SEC filing links, guidance history chart), Q&A, Participants, Metrics & diff (vs the prior call), Prosody, Price moves (minute returns of the call window next to what was being said — temporal coincidence, not cause; derived returns only; while the call is live the minute rows so far, marked "not settled", refreshed every minute) — the event's public broadcast (`video`, YouTube / Vimeo) behind a click-to-load facade above the tabs (nothing is requested from the platform's player before the click; a non-embeddable video is a link; collapsed under "Watch the broadcast" while the call is captured live), the webcast player's slides on the Slides tab synced to the recording (`timeline`; a click plays the call from that slide) — and a "Search this call" keyword search above the tabs (any word of the query may match; the management answer follows a matched analyst question) (hits play the recording or scroll the transcript, switching it to the Speakers format when needed; 10 credits per search). Every timestamp plays the recording (the first click loads it; nothing is fetched on page load) and a sticky mini-player above the other tabs controls it; the transcript marks where the Q&A starts (`qa_start_ms`). While the call is live: a live player (Tune in / From the beginning, jump to live, 1–2× behind the edge; hls.js on the URL of `GET /v1/events/{event_id}/live-audio`, asked again only before it expires) and the live transcript over the `/v1/stream` channel `events.live` with provisional speaker names, held back to the audio position and click-to-seek behind the edge; between the two a per-second price line of the call's stock (`price_tick` frames on the same socket, seeded from the live minute rows, on the transcript clock with the audio position marked; temporal coincidence, not cause; pre-market and after-hours bars are sparse, so missing seconds are gaps).
- `/$ticker/news?scope=&published=&item=&live=` — the company's news (SEC EDGAR filings and its own newsroom publications; wire services are never a source), newest first, paged by the API's cursor (Previous / Next). Filters: this company / whole market, "Company-published" (the company's own publications by CIK, with publication type and its newsroom categories / tags), source, kind, topic, earnings, date window. An item opens in a panel: the attribution block (publisher, original link, date, the API's statement, © holder, EDGAR form + accession), then the lede and Invinite's summary of the publication (never the publisher's own text or media), or "Headline and link only" without a summary; AI-extracted developments with claim status; the item's branded PDF (view, new tab, download); where it was seen. "Live" (PRO) adds new items over the `/v1/stream` channel `news` at the top.
- `/$ticker/financials?view=standardized|as-reported|ratios|growth|cagr|segments` — financial statements and metrics
  (the old `/$ticker/financials-*` and `/$ticker/segmented-financials` URLs redirect here).
- `/$ticker/dividends` — dividends history.
- `/$ticker/stock-splits` — split history (stocks and funds).
- `/$ticker/insider-trades` — insider trades.
- `/$ticker/holdings` — a fund's composition and weights (issuer file or N-PORT, with its as-of date); not for stocks, ETNs or exchange-traded trusts such as GLD.
- `/$ticker/holders` — who holds a stock or fund: an overview per source (13F, N-PORT, ETF issuer files), each source's full list, 13F changes.
- `/calendar`, `/live-calls`, `/ipo-calendar`, `/market-holidays` — the market pages (the old
  `/$ticker/earnings-calendar`, `/$ticker/ipos` and `/$ticker/market-holidays` redirect to them).

The Market section includes US inflation, GDP and income, labor, and Treasury yields. Browse the Free series catalog at `/catalog?tab=macro`. Family pages link current observations to historical ranges with normal per-request credit billing.
