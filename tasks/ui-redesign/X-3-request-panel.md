# Request panel in the top bar

> **Status: TODO**

## Goal

One fixed place for "which Data API requests does this page use": a toggle at the right end of the top bar opens a
redesigned request panel on the right — docked beside the page on desktop, a sheet on smaller screens. The "API"
buttons inside the pages are removed. This is the signature element of the redesign; spend the care here.

## Prerequisites

Task 2 (top-bar slot, `--request-panel-width`).

## Current Behavior

- `src/components/api/api-sheet.tsx`: `ApiButton` (a `Sheet` trigger) rendered by `PageHeader` and by
  `call-tabs.tsx`; `ApiRequestsView` lists every request as an equally heavy bordered card: method badge, path,
  summary, tier, cost, status, request id, curl, CLI, docs link, "Show answer (JSON)".
- `useViewRequests(enabled)` returns the requests of every query with an enabled observer in cache order, so the
  shell's requests (`listEvents?status=live` for the sidebar count, `getInstrument` of the ticker layout) come first
  (F4). A `ViewRequest` is `{ answer, error, key, meta }`: it carries no query key, so nothing can tell today which
  hook asked for it (`key` is `queryHash:page:index`).
- The sidebar's API status dot is NOT a Data API request: `useOverallStatus` (`src/lib/reference/public-status.ts`)
  fetches the public status Worker's `/api/snapshot` without the recorder, so it is never listed; `statusGet`
  (`GET /status`) is asked only by `/account`.
- `DEFAULT_API_BASE_URL` lives in `api-sheet.tsx`, and `src/lib/api/no-direct-api-calls.test.ts` pins that file by
  name as one of the two places allowed to name the API host (`expect(naming).toEqual(["components/api/api-sheet.tsx",
  "lib/env.ts"])`).
- Pages without `PageHeader` in some state have no button at all.

## Desired Behavior

### 1. Store — `src/lib/stores/request-panel-store.ts`

```ts
type RequestPanelState = {
    hasHydrated: boolean;
    open: boolean;
    markHydrated: () => void;
    setOpen: (open: boolean) => void;
    toggle: () => void;
};
```

zustand `persist` (`localStorage` key `invinite-request-panel`, only `open` persisted), same SSR pattern as
`api-key-store.ts`: server and first client render are closed; after hydration the stored value applies. On widths
below 1280 px the stored "open" is ignored on load (a sheet never opens by itself).

### 2. Toggle — `RequestPanelToggle` in the top bar's actions slot

- A button at the far right of the top bar on every page (also on the onboarding card's page): icon (`Braces` or
  `PanelRight`) + "API" from `sm`, plus the count of the page's requests as a small number once known. The count
  must be known while the panel is closed, so the toggle subscribes on its own: a `useViewRequestCount()` beside
  `useViewRequests` (same cache subscription and event filter, `enabled` always true, returns
  `splitRequests(…).page.length` — one number, so a cache event re-renders only the toggle, never the page).
- `aria-pressed`, `aria-controls="request-panel"`, `aria-label="Show the API requests of this page"` / "Hide …".
- Shortcut: `.` toggles (not inside inputs, textareas, selects, contenteditable; not with modifiers). Shown in the
  button's tooltip. ⌘K stays the search.
- Renders nothing outside a `QueryClientProvider` (as `ApiButton` did).

### 3. Panel — `src/components/api/request-panel.tsx`

Placement:

| Width | Presentation |
| --- | --- |
| ≥ 1280 | `aside` fixed right, `top: var(--app-topbar-height)`, full remaining height, width 25 rem (400 px); sets `--request-panel-width` on `<body>` so content steps aside; own vertical scroll (allowed: it is a side panel) |
| 640–1279 | right `Sheet` (max 28 rem) over the page |
| < 640 | bottom `Sheet`, 85 svh, drag handle look, close button |

One body component for all three. Escape closes the sheet variants; the docked one closes by the toggle or its ×.

Content, top to bottom:

```
Requests on this page                                   [×]
4 requests · 4 credits charged · api.data.invinite.com
───────────────────────────────────────────────────────────
GET  /v1/dividends                                  200  1c
     ?symbol=AAPL&sort=-ex_date&limit=40
     List dividends · Lite                              ▾
  ┌ expanded ──────────────────────────────────────────┐
  │ [curl] [CLI] [Answer]                    Docs ↗     │
  │ curl -sS -H "Authorization: Bearer $INVINITE_…"  ⧉  │
  │ Request id req_01M…  ⧉                              │
  └─────────────────────────────────────────────────────┘
GET  /v1/dividends  (page 2)                         200  1c
───────────────────────────────────────────────────────────
▸ App requests (3)   sidebar, status, instrument header
▸ Writes (1)         only when a mutation settled
```

- **Row (collapsed)**: method chip (GET in `--brand`, POST / PATCH / DELETE in a neutral strong chip; text, not
  colour alone), path in mono with the path on line one and the query string on a muted second line (wraps, never
  scrolls sideways), status (2xx plain, 4xx / 5xx in `--destructive` with the problem code), credits charged
  (`1c`, `--warn` when above the base cost), operation summary + tier badge. The whole row is a
  `button aria-expanded`.
- **Expanded**: segmented control curl | CLI | Answer (one visible at a time; CLI hidden when `cliOf` is null);
  copy button on each; request id with copy; docs link; error text for a failed request; Answer = `JsonTree` with
  copy / download (as today's `AnswerBlock`), its own max height.
- The first page request is expanded by default; others collapsed. Expansion state is local and keyed by
  `request.key`, so a refetch does not collapse it.
- **Summary line**: count, sum of `meta.credits` (charged), base URL (`useApiBaseUrl() ?? DEFAULT_API_BASE_URL`).
  A copy-all action: "Copy all as curl" (the page requests, newline-separated).
- **Groups**: "This page" (default), "App requests" (folded), "Writes". To group by query key, add `queryKey:
  QueryKey` to `ViewRequest` (filled from `query.queryKey` in `viewRequestsOf`; writes get `["write"]`) — additive,
  `api-inspector.test.tsx` covers it. Implement a pure
  `splitRequests(requests, pathname): { page, app, writes }` in `src/components/api/request-groups.ts` with tests,
  over an explicit table (the real shell queries on 2026-11-24):

  | Query key prefix | Asked by | "App" except on |
  | --- | --- | --- |
  | `["v2", "events", "live"]` | sidebar live count (`useV2LiveEvents`) | `/`, `/live-calls`, `/calendar`, `/$ticker/earnings-calls` and the call page (they show the live list / strip themselves) |
  | `["v2", "instrument", <SYMBOL>]` | `$ticker/route.tsx` + the sidebar's instrument context | the overview `/$ticker` (it shows the instrument) |
  | `["v2", "instruments", "search", …]`, `["v2", "people", "search", …]`, the search's coin list, `["v2", "filers", …]` while asked by the search | top-bar search (only while it is open) | `["v2", "filers", …]` on `/` (filer lookup) and `/institutions` |

  The filer (`["v2", "filer", …]` + its first filings page) and person (`["v2", "person", …]`) context requests are
  only ever sent on `/sec/$cik` / `/people/$personId`, which show the same answers: always "This page". `/v1/me` is
  already left out by `viewRequestsOf`. Rule of thumb in a code comment: a request is "app" when the same request
  would be sent on a sibling page of the same shell context; when in doubt it is "This page". A new shell query
  needs a row here (test).
- **Empty**: "This page has not asked the Data API yet." + one line on what will appear.
- **Live sockets** are not HTTP requests: when the page has an open `/v1/stream` socket nothing is listed (as today);
  add one static muted line at the bottom: "Live streams (WebSocket) are not listed here." linking the stream docs.
- The key never appears: `curlOf` keeps `$INVINITE_API_KEY`.
- Motion: the docked panel slides in 160 ms (transform), respecting reduced motion; no entrance animation per row.

### 4. Remove the in-page buttons

- `PageHeader`: delete the `ApiButton` import and render; `actions` wrapper stays.
- `call-tabs.tsx`: delete the `ApiButton` at the end of the tab bar.
- Delete `ApiButton` from `api-sheet.tsx`; keep / move `ApiRequestsView`'s pieces into the new panel and delete
  `api-sheet.tsx`. `DEFAULT_API_BASE_URL` moves to `request-panel.tsx` (still exported) and
  `no-direct-api-calls.test.ts` names `components/api/request-panel.tsx` instead of `api-sheet.tsx` (both
  assertions: the host-naming list and the "no `fetch(`" check).
- The panel body calls `useViewRequests(enabled)` with `enabled = open`; only the toggle's count subscribes while
  closed (above).

## Requirements

1. Store, toggle, panel, grouping as above; wire in `__root.tsx` (toggle in the slot, panel after the content
   wrapper, inside the `QueryClientProvider`).
2. Focus: opening a sheet variant moves focus into it and returns it to the toggle on close; the docked variant
   does not steal focus (it is a complementary landmark: `aside aria-label="API requests of this page"`).
3. Printing: the panel is `print:hidden`.
4. Tests (rewrite `src/routes/-tests/api-inspector.test.tsx`; `webhook-reference.test.tsx` and
   `macro-pages.test.tsx` drop their `vi.mock("@/components/api/api-sheet", …)` — the module is gone;
   `no-transcript-notice.test.tsx` drops its "CallTabs: the API button (O6-final)" block and the "behind the API
   button" wording; `no-direct-api-calls.test.ts` names the new file):
   - `request-groups.test.ts`: page vs app vs writes for `/AAPL/dividends`, `/account`, `/AAPL`, `/alerts`,
     `/live-calls` (live list is the page's), `/` (filers of the lookup are the page's).
   - toggle count: updates while the panel is closed, counts page requests only.
   - panel view: row content, expand, curl uses `$INVINITE_API_KEY`, credits sum, failed request, empty state,
     redacted write body.
   - store: closed on first render, persisted after toggle, ignored below 1280.
   - `PageHeader` renders no API button; `data-table.test.tsx` updated.
5. Edge cases: 0 requests; 50+ requests (a list that loaded many pages — rows of the same operation and path are
   grouped under one row with "N pages" that expands to the pages); a request without `requestId`; an operation
   unknown to `operations.gen.ts` (show the path, no summary); mutation answers redacted (`writeRequestsOf`).

## Files to Create / Modify

| File | Action | Purpose |
| --- | --- | --- |
| `src/lib/stores/request-panel-store.ts` (+ test) | Create | open state |
| `src/components/api/request-panel.tsx`, `request-row.tsx`, `request-groups.ts` (+ test) | Create | panel |
| `src/components/api/request-panel-toggle.tsx` | Create | top-bar toggle with count + `.` shortcut |
| `src/components/api/use-view-requests.ts` | Modify | `queryKey` on `ViewRequest`, `useViewRequestCount` |
| `src/components/api/api-sheet.tsx` | Delete | old sheet (pieces folded into the panel) |
| `src/components/ui/page-header.tsx`, `src/routes/$ticker/earnings-calls/-components/call-tabs.tsx` | Modify | remove buttons |
| `src/routes/__root.tsx` | Modify | toggle + panel |
| `src/lib/api/no-direct-api-calls.test.ts` | Modify | host-naming file renamed |
| `src/routes/-tests/{api-inspector,webhook-reference,macro-pages,no-transcript-notice,data-table}.test.tsx` | Modify | new entry point |

## Acceptance Criteria

- The toggle is at the same place on every route, including `/alerts/*`, the call page and `/account`.
- No "API" button remains inside any page (`grep -rn "ApiButton" src` is empty).
- 1440 px: panel docked, page content narrower but fully usable, no sideways scroll; state survives a reload.
- 1024 / 768 px: right sheet; 375 px: bottom sheet; Escape and × close; focus returns to the toggle.
- `/AAPL/dividends` lists the dividends request first and expanded; shell requests are folded under "App requests".
- "Load more" on a list adds a page to its row group without collapsing an open row.
- The toggle's count changes while the panel is closed (e.g. after "Load more"), and the page does not re-render on
  each cache event (React DevTools profiler or a render-count test).
- `no-direct-api-calls.test.ts` green with the host named only in `request-panel.tsx` and `env.ts`.
- `pnpm run check`, `pnpm run test` green.
