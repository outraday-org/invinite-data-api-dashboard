# Ticker header with section tabs

> **Status: TODO**

## Goal

Put an instrument's sections as tabs into the pinned ticker header, so moving between Overview, Calls, Filings,
Financials, … never needs the sidebar; the sidebar's context group (task 4) keeps the same links.

## Prerequisites

Task 4 (the context group is the tabs' twin; both read `instrumentSectionGroups`).

## Current Behavior

- `src/routes/$ticker/route.tsx`: pinned header (`sticky top-(--app-topbar-height)`) with logo, `h1` symbol, name,
  badges (`instrumentBadges`); a `ResizeObserver` writes `--ticker-header-height` on `<html>`; sticky table headers
  and the call player sit below it (`STICKY_TOP_CLASS`).
- Sections are reachable only through the sidebar.

## Desired Behavior

```
[logo] AAPL  Apple Inc.   Stock                                    XNAS · USD
Overview  Calls  Documents  Filings  Financials  Holders  Insider trades  Dividends  Splits  News
────────────────── (active tab: 2 px --brand underline) ───────────────────────────────────────
```

- New `src/routes/$ticker/-components/section-tabs.tsx` `SectionTabs({ datasets, ticker })`: a `nav
  aria-label="Sections of AAPL"` of router `Link`s built from `visibleInstrumentItems(datasets)` — links, not
  `role="tab"` (each is a page with its own URL; `aria-current="page"` on the active one).
- Active = the item whose `section` equals `sectionOf(pathname)` (existing, `src/lib/instruments.ts`: the first
  segment after the symbol, "" = overview — the layout already uses it for the gate); a child route
  (`/AAPL/earnings-calls/<id>`) keeps "Calls" active.
- Short labels in the tab row where the sidebar label is long: add an optional `shortLabel` to `InstrumentSection`
  ("Investor documents" → "Documents").
- Navigation keeps nothing from the previous section's search params (each section has its own schema).
- Overflow: one row, never wraps. When the row is wider than the header it scrolls sideways inside itself
  (`overflow-x-auto`, hidden scrollbar, `scroll-snap`), with a fade on the cut edge(s) and the active tab scrolled
  into view on mount and on change (`scrollIntoView({ inline: "nearest", block: "nearest" })` — not the page).
- Header density: from `lg` logo 36 px, symbol 24 px; below 640 px logo 28 px, symbol 20 px, the name truncates on
  the same line, badges wrap under. A right-aligned meta slot (exchange MIC · currency, from the same instrument
  answer; hidden below `md`) — no new request.
- Once the page is scrolled the header compacts (`data-compact`): the name / badges row collapses so only
  `symbol + tabs` stay pinned (saves ~40 px on phones). The `ResizeObserver` keeps `--ticker-header-height`
  correct in both states; sticky offsets must not jump — use a scroll sentinel, not scroll events, and avoid a
  feedback loop (the compact state must not change the document height in a way that toggles it back: keep the
  expanded header's space with a non-sticky spacer or compact only the sticky copy).
- Hover / focus use the shared focus ring; tabs are 36 px tall (40 px below 640).
- Skeleton: while the instrument loads, the header shows the symbol from the URL and a skeleton tab row of fixed
  widths; unknown symbol / too long segment = today's notice, no tabs.

## Requirements

1. `SectionTabs` + `shortLabel` in `navigation.ts`; render in `route.tsx` inside the pinned header.
2. Gate behaviour unchanged: a section the instrument lacks is not in the tabs; a typed URL to it still shows the
   gate sentence, with no tab active.
3. The alert entry points and page actions stay in the pages' `PageHeader` (task 6), not in the ticker header.
4. Tests: `ticker-layout.test.tsx` — tabs follow `datasets` (AAPL without Holdings, SPY without financials /
   earnings, GLD, an ETN), active tab for a section and for a call page, no tabs for an unknown symbol, links carry
   no search params; `navigation.test.ts` for `shortLabel`.
5. Edge cases: a 4-item instrument (an ETN: Overview, Dividends, Splits, Holders) shows no fade; RTL not
   required; keyboard Tab order = visual order; the tab row is skipped by a "Skip to content" link
   (add one as the first focusable element of the root layout, visible on focus). Its target: `SidebarInset`
   (`sidebar.tsx`) already renders the app's only `<main>` around the outlet — give it `id="content"` and
   `tabIndex={-1}` (pass-through props from `__root.tsx`), no second `<main>`. Task 14 only verifies the landmarks.

## Files to Create / Modify

| File | Action | Purpose |
| --- | --- | --- |
| `src/routes/$ticker/-components/section-tabs.tsx` | Create | tab row |
| `src/routes/$ticker/route.tsx` | Modify | header layout, compact state |
| `src/lib/navigation.ts` (+ test) | Modify | `shortLabel` |
| `src/routes/__root.tsx` | Modify | skip link, `id="content"` on `SidebarInset`'s `<main>` |
| `src/routes/-tests/ticker-layout.test.tsx` | Modify | tabs |

## Acceptance Criteria

- `/AAPL`: all sections reachable from the header at 1440 and 1024 px without overflow; at 768 and 375 px the row
  scrolls inside itself with the active tab visible, and the page does not scroll sideways.
- The sidebar context group and the tabs always list the same sections.
- Scrolling a long table: sticky table header sits directly under the (compact) ticker header, no gap, no overlap,
  no jitter when the header compacts.
- The call page's player still pins below the header.
- `pnpm run check`, `pnpm run test` green.
