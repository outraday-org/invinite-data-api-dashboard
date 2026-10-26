## Run

`pnpm run dev` starts the Vite dev server. Open the printed local URL (usually
`http://localhost:3001`).

Live: https://data-api-dashboard.netlify.app/ (Netlify builds `main` on push). Keys, usage and billing
live in the Invinite Data app, https://data.invinite.com (docs: https://data.invinite.com/docs).

## API key

You can provide `INVINITE_DATA_API_KEY` two ways:

- UI: on the home page (`/`), enter the key in the API key field. It is stored
  in `localStorage` (`invinite-data-api-key`) and used for client requests.
- Env var: set `INVINITE_DATA_API_KEY` in your environment (or a `.env` file) before
  starting the dev server. This is used on the server/SSR side.

REST requests always go through the server functions. One exception: the live
transcript of an earnings call in progress opens
`wss://<api>/v1/ws?api_key=<stored key>` straight from the browser (the app runs on
Netlify, which cannot hold a server-side socket, and the key is already in this
browser's `localStorage`). Without a key entered in the UI the live player asks for one.

## API types

`openapi.json` is a copy of the data API's spec (`../invinite-data-api/openapi.json`).
Copy it over and run `pnpm generate:api` to regenerate `src/lib/api/schema.d.ts`.
`pnpm-workspace.yaml` records pnpm 11's `allowBuilds` decisions (esbuild's postinstall
runs, the others are skipped) so `pnpm install` / `pnpm run` do not stop on
`ERR_PNPM_IGNORED_BUILDS`.

## Routes

- `/` — landing page, API key input, and intro cards.
- `/$ticker` — company overview + market data (e.g. `/AAPL`).
- `/$ticker/filings` — SEC filings with filters, HTML/PDF viewers.
- `/$ticker/earnings-calls` — the company's earnings calls (Upcoming / Past, availability per call; a not-covered notice outside the coverage scope) and a company-wide "Ask this call" search.
- `/$ticker/earnings-calls/$eventId?tab=` — one call: header (time, status, materials, call-time observations) and tabs — Transcript (formats, versions, diff), Audio, Slides, Press release, Documents, Guidance & KPIs (SEC filing links, guidance history chart), Q&A, Participants, Metrics & diff (vs the prior call), Prosody, Price moves (minute returns of the call window next to what was being said — temporal coincidence, not cause; derived returns only; while the call is live the minute rows so far, marked "not settled", refreshed every minute) — the event's public broadcast (`video`, YouTube / Vimeo) behind a click-to-load facade above the tabs (nothing is requested from the platform's player before the click; a non-embeddable video is a link; collapsed under "Watch the broadcast" while the call is captured live), the webcast player's slides on the Slides tab synced to the recording (`timeline`; a click plays the call from that slide) — and an "Ask this call" semantic search above the tabs (hits play the recording or scroll the transcript, switching it to the Speakers format when needed; 10 credits per search). Every timestamp plays the recording (the first click loads it; nothing is fetched on page load) and a sticky mini-player above the other tabs controls it; the transcript marks where the Q&A starts (`qa_start_ms`). While the call is live: a live player (Tune in / From the beginning, jump to live, 1–2× behind the edge; hls.js on `GET /v1/earnings-calls/live/stream`, PRO, 5 credits per URL, asked again only before it expires) and the live transcript over the WebSocket channel `earnings-calls.live` with provisional speaker names, held back to the audio position and click-to-seek behind the edge; between the two a per-second price line of the call's stock (`price_tick` frames on the same socket, seeded from the live minute rows, on the transcript clock with the audio position marked; temporal coincidence, not cause; pre-market and after-hours bars are sparse, so missing seconds are gaps).
- `/$ticker/financials-standardized` — standardized financial statements with
  filters.
- `/$ticker/financials-as-reported` — as-reported financial statements.
- `/$ticker/financials-cagr` — CAGR financial statements.
- `/$ticker/financials-growth` — growth financial statements.
- `/$ticker/financials-ratios` — ratio financial statements.
- `/$ticker/segmented-financials` — segmented financials.
- `/$ticker/dividends` — dividends history.
- `/$ticker/stock-splits` — stock split history.
- `/$ticker/insider-trades` — insider trades.
- `/$ticker/institutions` — institutions.
- `/$ticker/earnings-calendar` — market earnings calendar (date window / status / session / event type — one type or "All events" — in the URL) with a "Live now" strip.
- `/$ticker/ipos` — IPOs.
- `/$ticker/market-holidays` — market holidays.
