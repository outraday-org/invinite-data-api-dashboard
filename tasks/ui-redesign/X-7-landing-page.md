# Landing page

> **Status: TODO**

## Goal

Make `/` the front door of a public API example: it shows live market data first, says in one glance what the Data
API covers, and teaches the one interaction that matters here — opening the request panel.

## Prerequisites

Tasks 3 and 6.

## Current Behavior

`src/routes/index.tsx` (pure `*View` + `landing-page.test.tsx`): title + one paragraph, cards "Live now", "Earnings
today", "Later this week", "Next IPOs", "Next market holiday", a "Browse" grid of 11 cards (`BROWSE_CARDS`, a copy of
the sidebar), "Recently opened", the SEC filer lookup card. All cards weigh the same; nothing mentions requests (F12);
times wrap ("Nov 24, 2026 · 1:00 PM / Germany Time", F13).

## Desired Behavior

```
Invinite Data API, live                                   ← h1, `text-2xl` (24 px) from sm / `text-xl` phone (task 1 scale)
Every page here is built from Data API requests.
Open [⇄ API] at the top right to see them.                ← one sentence; "API" is a real button that opens the panel

┌ Today ─────────────────────────────────────────────────┐
│ Live now (2)        │ Earnings today      │ This week   │   Section "Today": three columns ≥ 1024,
│ call cards / none   │ 8 rows              │ 8 rows      │   stacked below; rows = symbol · name · period · time
└─────────────────────┴─────────────────────┴─────────────┘
Next IPOs · Next market holiday                              one compact line each, link to their pages

What the API covers                                         Section, the heart of the page
  Earnings calls      transcripts, audio, slides, Q&A …     11 operations   → /live-calls
  Filings             …                                     17 operations   → /filings
  Financials          …
  Ownership · Funds · News · Corporate actions · Macro · Coins · Alerts · Reference
Recently opened                                             chips, only when there are any
Look up an SEC filer                                        the lookup, as a Section (no card in card)
```

- **Coverage list** replaces the "Browse" card grid: one row per data family — name, one line of what it holds,
  the number of operations, the entry page. Rows are links (whole row), in a 2-column list from `lg`, 1 column
  below. Data: a new `API_FAMILIES` table in `src/lib/navigation.ts`
  (`{ id, label, description, to, operationIds | match }`); the operation count is computed from
  `operations.gen.ts` (e.g. by path prefix / a listed id set), never typed by hand. A test asserts every HTTP
  operation of `operations.gen.ts` belongs to exactly one family (so a new operation fails the test until placed),
  mirroring `coverage.test.ts`'s idea. Delete `BROWSE_CARDS` and its `BrowseCard` type (on 2026-11-24 only
  `src/routes/index.tsx` reads them; `searchPages` reads `NAV_PAGES`, not the cards). The WebSocket `streamEvents`
  is not in `operations.gen.ts` (HTTP only), so it is not counted; the "Earnings calls" / "News" / "Filings" /
  "Alerts" rows may say "+ live stream" in their description.
- **Today**: the three lists become one `Section` with columns divided by hairlines, not three cards. Rows: symbol
  (medium), name (truncates), fiscal period, time via `formatInstantShort` on one line. "Live now" keeps the live
  dot; none live = one muted line, not an empty box.
- **Intro**: the sentence's inline "API" button calls the request-panel store's `setOpen(true)`; a first-visit hint
  is not needed (no coach marks).
- **Skeletons** mirror the final layout (rows, not grey boxes the size of a card).
- No new request: the page sends exactly what it sends today (verify in the panel).

## Requirements

1. Rework `LandingView` and its sub-views with `Section`, `PageContainer`, `formatInstantShort`.
2. Add `API_FAMILIES` + its coverage test (`src/lib/navigation.test.ts` or a new `api-families.test.ts`).
3. States: each "Today" column has loading (skeleton rows), error (one-line notice, the others still render),
   empty ("No earnings call today."); IPOs / holiday lines likewise.
4. Phone: h1 `text-xl`; columns stack in the order Live, Today, This week; rows keep symbol + time on the first line and
   the name on a second, muted line; coverage rows show the operation count on the right.
5. Update `landing-page.test.tsx` (coverage rows link their pages, counts come from the operations table, the intro
   button opens the panel, empty / error states).

## Files to Create / Modify

| File | Action | Purpose |
| --- | --- | --- |
| `src/routes/index.tsx` | Modify | new layout |
| `src/lib/navigation.ts` (+ `navigation.test.ts` or new `src/lib/api-families.test.ts`) | Modify | `API_FAMILIES`, remove `BROWSE_CARDS` |
| `src/routes/-tests/landing-page.test.tsx` | Modify | new structure |

## Acceptance Criteria

- At 1440 × 900 the first screen shows the intro, "Today" and the start of "What the API covers".
- The page has no card inside a card and no grid of identical cards.
- Every operation is counted in exactly one family (test).
- 375 / 768 / 1024 / 1440: no sideways scroll, no wrapped time, tap targets ≥ 36 px.
- Requests sent by `/` are unchanged.
- `pnpm run check`, `pnpm run test` green.
