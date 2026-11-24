# Sidebar: collapsible groups

> **Status: TODO**

## Goal

Turn the flat 21-link sidebar into a short, grouped one: collapsible groups that remember their state, the current
subject's context (instrument / filer / person) as the first group, and a footer with account, theme and status.

## Prerequisites

Task 2 (breakpoint, the phone theme toggle beside "Account"); task 3 for the "App requests" check of requirement 3.

## Current Behavior

- `src/components/navigation/app-sidebar.tsx`: groups Market (9 incl. 4 macro pages), Browse (12), Context, Help (2),
  Account. Context is rendered after Browse — below the fold on an instrument page (F3).
- `src/lib/navigation.ts`: `MARKET_NAV`, `MACRO_NAV`, `BROWSE_NAV`, `HELP_NAV`, `ACCOUNT_NAV`, `NAV_PAGES`,
  `searchPages`; `route-names.test.ts` requires an entry for every top-level route.

## Desired Behavior

### 1. Groups (data in `src/lib/navigation.ts`)

```ts
export type NavGroup = { defaultOpen: boolean; id: string; label: string; pages: ReadonlyArray<NavPage> };

export const NAV_GROUPS: ReadonlyArray<NavGroup> = [
    { defaultOpen: true,  id: "market",     label: "Market",        pages: [Home, Earnings calendar, Live calls, IPOs, Market holidays] },
    { defaultOpen: true,  id: "securities", label: "Securities",    pages: [Instruments, Funds, Spot coins, Institutions, People] },
    { defaultOpen: false, id: "filings",    label: "Filings",       pages: [Filings, Offerings, SEC data sets] },
    { defaultOpen: false, id: "research",   label: "News & search", pages: [News feed, Transcript search] },
    { defaultOpen: false, id: "macro",      label: "US macro",      pages: MACRO_NAV },
    { defaultOpen: false, id: "build",      label: "Build",         pages: [Alerts, Catalog] },
];
```

- `MARKET_NAV` / `BROWSE_NAV` stay exported (`NAV_PAGES`, `searchPages` and tests read them); `NAV_GROUPS`
  references the same `NavPage` objects — no page defined twice. Today `MARKET_NAV` spreads `MACRO_NAV` into its
  end and its five own pages are inline literals, and `BROWSE_NAV`'s entries are inline too (only `COINS_NAV` is a
  constant): lift each page into a named constant (`HOME_NAV`, `CALENDAR_NAV`, …) and build `MARKET_NAV`,
  `BROWSE_NAV` and `NAV_GROUPS` from them, so `MARKET_NAV`'s order and content stay as today (the Market group is
  its first five; US macro is its own group). A test asserts every `NAV_PAGES` entry except `ACCOUNT_NAV` is in
  exactly one group.
- The group that contains the current route is always open, whatever the stored state.

### 2. Collapse state — `src/lib/stores/sidebar-groups-store.ts`

zustand `persist` (`invinite-sidebar-groups`: `Record<groupId, boolean>`), `hasHydrated` pattern; before hydration
each group renders at `defaultOpen` (server = first client render).

### 3. Layout

```
◆ Invinite Data                 (brand row only when the top bar hides its text, i.e. off-canvas)
─────────────
AAPL · Stock                    context group, first, only on a subject's pages
  Overview
  Calls · Investor documents
  Filings · Financials · …
─────────────
Market                      ▾
  Home
  Earnings calendar
  Live calls              ● 2
  …
Securities                  ▾
Filings                     ▸
News & search               ▸
US macro                    ▸
Build                       ▸
─────────────                    footer, pinned to the bottom
API status   ●   Licensing ↗
Account            Enterprise
[theme toggle]                  below 640 px only (it left the top bar in task 2)
```

- Group header = a `button aria-expanded aria-controls` with the label and a chevron; ←/→ collapse / expand when
  focused; content is not rendered while collapsed.
- Items: 32 px rows (36 px below 640), icon 16 px, active item = `--accent` fill + a 2 px `--brand` bar on the left
  + `aria-current="page"`.
- Context group: label = today's subject label (`instrumentSubjectLabel`, `filerSubjectLabel` in
  `navigation.ts`; the person label "<name> · Analyst" is built inline in `PersonContext` today — extract it as
  `personSubjectLabel` next to the other two so all three are tested the same way), not collapsible, with the instrument's logo when the header has one. Its items are the
  same as today (sections by `datasets`; filer and person anchors). The instrument sub-groups ("Earnings",
  "Ownership", …) show as small muted labels only when the group has more than one item.
- The middle part scrolls when it must (it is a side panel); footer and context stay put.
- Live count badge on "Live calls" as today (`useV2LiveEvents`); when the Market group is collapsed and a call is
  live, the group header shows the dot.
- Help links move into the footer as one compact row; `ApiStatusDot` keeps its query.
- Off-canvas (< 1024): same content, closes on navigation.

## Requirements

1. Add `NAV_GROUPS` + test; build the sidebar from it; keep `PageLinks`, `SkeletonRows`, the three context
   components (restyled, reordered).
2. Store + hydration-safe rendering; fixed-width skeleton rows as today (no random widths).
3. The requests the sidebar sends do not change (same hooks, same `enabled` conditions: `useV2LiveEvents(keyReady)`,
   `useInstrument`, `useV2Filer` + `useV2FilingsInfinite` for the filer context, `useV2Person`) — verify in the
   request panel's "App requests" (task 3).
4. Move the `ThemeToggle` task 2 put beside "Account" into the new footer (`sm:hidden` stays).
5. Tests: `app-sidebar.test.tsx` (groups, open group of the current route, context first, collapse persists,
   live dot on a collapsed group), `navigation.test.ts` (every page in one group), `route-names.test.ts` green.
6. Edge cases: no key (key gate shows onboarding — sidebar shows groups without live count or context);
   unknown symbol (no context group); a very long filer name truncates with a `title`.

## Files to Create / Modify

| File | Action | Purpose |
| --- | --- | --- |
| `src/lib/navigation.ts` (+ test) | Modify | `NAV_GROUPS` |
| `src/lib/stores/sidebar-groups-store.ts` (+ test) | Create | collapse state |
| `src/components/navigation/app-sidebar.tsx` | Modify | grouped layout, footer, context first |
| `src/routes/-tests/app-sidebar.test.tsx` | Modify | new structure |

## Acceptance Criteria

- At 1440 × 900 on `/AAPL` every instrument section is visible without scrolling the sidebar.
- With the default state the sidebar shows at most ~14 rows on a global page.
- Collapsing a group survives a reload; the current page's group is never hidden.
- Keyboard: Tab reaches group headers and items in order; Enter / Space toggle a group.
- 375 px: off-canvas sidebar with 36 px rows, closes after choosing a page.
- `pnpm run check`, `pnpm run test` green.
