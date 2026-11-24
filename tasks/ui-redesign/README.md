# UI redesign: a calmer dashboard whose requests are always one click away

The dashboard is the public example of how to use the Invinite Data API. Today it shows every operation, but it reads
as crowded, and the one thing that makes it an *API* example — the requests behind a page — sits behind a small
"{ } API" button whose place changes from page to page. This tasklist reworks the shell, the shared pieces and every
page family so that (1) a page breathes, (2) the requests a page sends are found at one fixed place, and (3) every
page works at phone, tablet, laptop and desktop width.

Owner decisions (2026-11-24): docked request panel opened by a toggle in the top bar; the per-page "API" buttons are
removed; instrument sections stay in the sidebar AND become tabs under the ticker header; the app gets its own visual
identity; all pages are in scope; responsiveness at several screen sizes is a requirement of every task.

## Current State

Findings of the walk on 2026-11-24 (local dev, production API, enterprise key, 1440 / 768 / 375 px, dark and light):

| # | Finding | Where |
| --- | --- | --- |
| F1 | Base text is 12 px everywhere (`body` `text-xs/relaxed`), page titles 16 px: almost no hierarchy, everything has the same weight. | `src/styles.css` |
| F2 | Stock shadcn zinc theme + Inter, no brand colour although the brand mark is leaf green (`#218635`). | `src/styles.css` |
| F3 | The sidebar is one flat list of 21 global links; on an instrument page its own sections ("AAPL · Stock") sit below them — content 1207 px in a 691 px viewport, so the instrument's navigation is not visible without scrolling. | `app-sidebar.tsx`, `navigation.ts` |
| F4 | The request inspector is a modal sheet behind a small button inside each `PageHeader` (and the call page's tab bar): another place on every page, it hides the page it explains, and it lists shell requests (`/v1/events?status=live` of the sidebar, the instrument of the ticker layout) before the page's own. (The sidebar's status dot reads the public status Worker without the recorder, so it is never listed; `/status` is listed only on `/account`.) | `api-sheet.tsx`, `page-header.tsx`, `call-tabs.tsx` |
| F5 | Filter rows are unlabelled controls that wrap raggedly (two bare date inputs showing the browser's `tt.mm.jjjj`, "FY from – to", selects, toggles, "Create alert", "API" in one line). | filings, financials, insider trades, calendar, … |
| F6 | Cards inside cards and rows of equally weighted tiles (overview: 8 tiles + 2 cards + a pill row + a table + a text card). | `$ticker/index.tsx`, `/`, `/account` |
| F7 | 27 files (24 routes, `macro-page.tsx`, `route-states.tsx`, `onboarding-card.tsx`) repeat `mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 lg:px-8` by hand (with `gap-6` / `py-8` / `max-w-7xl` variants). | every route |
| F8 | The call header is nine metadata fields with upper-case eyebrow labels; search box, player, tab bar and toolbar stack four bordered boxes before the transcript starts. | call page |
| F9 | Tablet (768 px): the sidebar stays docked and takes a third of the width; tables are cut after the third column. | shell |
| F10 | Phone (375 px): no page scrolls sideways (good), but tiles stack one per row into very long pages and filter rows take a full screen before the data. | overview, financials |
| F11 | The alert form uses full-width textareas for short comma lists; the page is several screens of fields with little grouping. | `/alerts/new` |
| F12 | The landing page repeats the sidebar as "Browse" cards and never says which API families exist or how to see a request. | `/` |
| F13 | Long timezone names ("Germany Time") wrap times onto a second line in narrow lists. | `/`, calls list |

What already works and stays: the document scrolls (no page scroll boxes), URL state, the request recorder
(`client.server.ts` → `request-middleware.ts` → `useViewRequests`), export, the key gate, `DataTable`, the ~200 suites.

## Target State

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ☰  ◆ Invinite Data      [ Search …                 ⌘K ]   ◐  Plan  🔑  [⇄ API 4]│  top bar, 56 px
├──────────────┬──────────────────────────────────────────┬────────────────────┤
│ Market     ▾ │  AAPL  Apple Inc.  Stock                  │ Requests on this   │
│ Securities ▾ │  Overview Calls Documents Filings …  ───  │ page          4 · 4c│
│ SEC        ▸ │                                           │ ─────────────────  │
│ Reference  ▸ │  Dividends                                │ GET /v1/dividends  │
│ Alerts     ▸ │  filters …                                │   ?symbol=AAPL 200 │
│              │  table                                    │ ▸ curl · CLI · JSON│
│ Account      │                                           │ App requests (3) ▸ │
└──────────────┴──────────────────────────────────────────┴────────────────────┘
   232 px, groups collapse      fluid, max 1200 px             400 px, ≥ 1280 px docked
```

- **Tokens**: leaf-green accent, green-tinted neutrals, IBM Plex Sans + IBM Plex Mono, a 13 px data / 14 px prose
  base with a real scale, tabular figures in tables.
- **Shell**: one `PageContainer`; four breakpoints (see below); the request panel as a third column.
- **Request panel**: toggle at the right end of the top bar on every page; docked beside the page from 1280 px,
  a sheet below; page requests first, shell requests folded; state remembered. No "API" button in any page.
- **Navigation**: sidebar groups collapse and remember it; instrument sections are tabs in the pinned ticker header
  and remain in the sidebar as its first group on instrument pages.
- **Pages**: labelled filter bars, sections instead of nested cards, one table style.

### Breakpoints (every task checks all four, both themes)

| Name | Width | Sidebar | Request panel | Check at |
| --- | --- | --- | --- | --- |
| Phone | < 640 | off-canvas | bottom sheet | 375 |
| Tablet | 640–1023 | off-canvas | right sheet (overlay) | 768 |
| Laptop | 1024–1279 | docked | right sheet (overlay) | 1024 |
| Desktop | ≥ 1280 | docked | docked column | 1440, 1920 |

Rules: the page never scrolls sideways (`documentElement.scrollWidth === clientWidth`); a wide table scrolls inside
its own wrapper; touch targets ≥ 36 px below 640; nothing depends on hover alone.

## Architecture Decisions

| Decision | Rationale |
| --- | --- |
| **Requests panel = third layout column, toggled from the top bar** | Owner decision. One fixed place on every page; docked, it does not hide the page it explains. |
| **`ApiButton` removed from `PageHeader` and the call tab bar** | Owner decision: one entry point. `PageHeader` loses its only reason to import the inspector. |
| **Page requests vs app requests** | The panel separates what the page asked from what the shell asks on every page (the sidebar's live count, the ticker layout's instrument, the top-bar search; `/v1/me` stays hidden). Split by an explicit table of shell query keys with per-route exceptions (task 3), not by guessing; `ViewRequest` gains its `queryKey` for that. |
| **Heading levels by context** | `PageHeader` is `h1` on global pages and `h2` under a family header (ticker, alerts) through a provider set by the two layouts (task 6), so no page passes a level by hand. |
| **Panel state in a zustand `persist` store with `hasHydrated`** | Same pattern as `api-key-store.ts`; server and first client render are "closed", so no hydration mismatch. |
| **Instrument sections in both the header tabs and the sidebar** | Owner decision. One source: `instrumentSectionGroups(datasets)` in `src/lib/navigation.ts`. |
| **Sidebar off-canvas below 1024 px** (was 768) | At 768 px a docked 256 px sidebar leaves 512 px for tables (F9). |
| **Identity: leaf green + IBM Plex** | The brand mark's colour as the single accent; Plex has true tabular figures and a matching mono for paths, ids and code — the mono is used only for those. Avoids the zinc/Inter default. |
| **Restyle shared pieces first, pages after** | Most of "crowded" is in 6 shared pieces (tokens, container, header, filter bar, table, card); pages then need local layout work only. |
| **No behaviour change to requests, URL state, export, gates** | A visual task that changes which requests a page sends is a bug. Tests that assert text / roles stay green or are updated in the same task. |
| **No new dependency except the two font packages** | `@fontsource-variable/ibm-plex-sans`, `@fontsource/ibm-plex-mono` (no build script, so no `allowBuilds` entry). |

## Dependency Graph

```
1 tokens + type ──► 2 shell + PageContainer ──► 3 request panel ──► 4 sidebar ──► 5 ticker header tabs
                                                                                      │
                                                                                      ▼
                                                              6 shared page pieces (header, filter bar, table, sections)
                                                                                      │
        ┌─────────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────┤
        ▼             ▼              ▼              ▼              ▼              ▼              ▼
   7 landing   8 overview +    9 financials +  10 call page ─► 11 earnings   12 market,     13 alerts
               ownership +       filings + SEC                   lists, news,   browse,
               actions                                           docs, people   reference
        └─────────────┴──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
                                                │
                                                ▼
                                14 responsive + a11y pass, docs, cleanup
```

Tasks 7–13 depend on 1–6 (11 also on 10: shared `earnings-calls/-components/`) and are executed in number order.

## Task Summary

| # | Title | Type | Dependencies | Est. Complexity |
| --- | --- | --- | --- | --- |
| 1 | [Design tokens and typography](./X-1-design-tokens-typography.md) | Frontend | None | Medium |
| 2 | [Shell, breakpoints, PageContainer](./X-2-shell-breakpoints-page-container.md) | Frontend | 1 | Medium |
| 3 | [Request panel in the top bar](./X-3-request-panel.md) | Frontend + store | 2 | High |
| 4 | [Sidebar: collapsible groups](./X-4-sidebar-groups.md) | Frontend + store | 2, 3 | Medium |
| 5 | [Ticker header with section tabs](./X-5-ticker-header-tabs.md) | Frontend | 4 | Medium |
| 6 | [Shared page pieces](./X-6-shared-page-pieces.md) | Frontend | 1, 2, 3 | High |
| 7 | [Landing page](./X-7-landing-page.md) | Frontend | 3, 6 | Medium |
| 8 | [Instrument overview, ownership, corporate actions](./X-8-instrument-overview-ownership.md) | Frontend | 5, 6 | High |
| 9 | [Financials, filings, SEC pages](./X-9-financials-filings-sec.md) | Frontend | 5, 6 | High |
| 10 | [Call page](./X-10-call-page.md) | Frontend | 5, 6 | High |
| 11 | [Earnings lists, news, documents, people](./X-11-earnings-lists-news-documents-people.md) | Frontend | 5, 6, 10 | Medium |
| 12 | [Market, browse, reference, account](./X-12-market-browse-reference-account.md) | Frontend | 6 | Medium |
| 13 | [Alerts family](./X-13-alerts-family.md) | Frontend | 3, 6 | Medium |
| 14 | [Responsive and accessibility pass, docs](./X-14-responsive-a11y-pass-docs.md) | QA + docs | 1–13 | Medium |

## Code Reuse

| Need | Reuse |
| --- | --- |
| Requests of the current view | `useViewRequests`, `viewRequestsOf`, `writeRequestsOf` (`src/components/api/use-view-requests.ts`) — extended only by `ViewRequest.queryKey` and a `useViewRequestCount` (task 3) |
| Host-naming rule | `src/lib/api/no-direct-api-calls.test.ts` (names the one component file allowed to spell the API host: `api-sheet.tsx` today, `request-panel.tsx` after task 3) |
| Active section | `sectionOf` (`src/lib/instruments.ts`) |
| `main` landmark | `SidebarInset` (`src/components/ui/sidebar.tsx`) already renders the app's only `<main>` |
| Plan names | `tierLabel`, `PlanBadge` (`src/components/ui/credit-hint.tsx`), never a typed "(PRO)" |
| Request row content | `curlOf`, `cliOf`, `operationOf`, `queryString` (`src/lib/api/request-meta.ts`), `JsonTree`, `CopyButton`, `TIER_BADGE_LABELS` |
| Persisted UI state | the `persist` + `hasHydrated` pattern of `src/lib/stores/api-key-store.ts` |
| Sheet / sidebar primitives | `src/components/ui/sheet.tsx`, `sidebar.tsx`, `src/hooks/use-mobile.tsx` |
| Instrument sections | `instrumentSectionGroups`, `visibleInstrumentItems` (`src/lib/navigation.ts`) |
| Tabs | `TabStrip` (`src/components/navigation/tab-strip.tsx`), `ui/tabs.tsx`, `WRAPPING_TABS_LIST_CLASS` |
| Filters | `DayRange`, `DebouncedInput`, `FilterSelect` (`calendar-filters.tsx`), `SearchQueryForm`, `SearchChip` |
| Tables | `DataTable`, `LoadMoreButton`, `ExportMenu`, `STICKY_FIRST_CELL`, `STICKY_TOP_CLASS` |
| States | `Notice`, `ErrorState`, `RequestErrorState`, `SecReadinessNotice`, `Skeleton` |
| Formatting | `src/lib/format.ts` (`formatDay`, `formatInstant`, `formatMoneyCompact`, …) |

## Rules for every task

- `pnpm run check` and `pnpm run test` green at the end; a test whose text / role changed is updated in the same task.
- Look at the result in the browser at 375, 768, 1024, 1440 px, dark and light. The dev server is normally already
  running (owner, 2026-11-24): reuse it and start `pnpm run dev` only if none answers. On this machine port 3001
  may answer for another local service over IPv4 (a plain `curl http://localhost:3001/` returned 404 on
  2026-11-24), so check that the page is the dashboard before trusting a screenshot. Key from the environment.
  Screenshots are the acceptance evidence.
- Sizes only from task 1's scale. A page task (7–13) replaces the `text-xs` it finds on data text (table cells, list
  rows, values) with the scale's role (`text-data`, the body default — usually just deleting the class); `text-xs`
  stays only for the "Small" role (meta lines, table headers, badges).
- Code style of `CLAUDE.md` (4 spaces, double quotes, blank lines, React Compiler clean). Tailwind classes written out.
- Update the matching `CLAUDE.md` paragraph when a documented behaviour changes (task 14 does the final sweep).

## Deferred / Follow-Up Work

- A request history across pages (the panel shows the current view only).
- "Try it" (editing a request's parameters in the panel and re-sending it).
- Card-style row layout for tables on phones (tables keep their own sideways scroll for now).
- A Playwright visual-regression suite for the four breakpoints.
- The dev server's port 3001 collides with another local service on this machine (IPv4); not part of the redesign.
