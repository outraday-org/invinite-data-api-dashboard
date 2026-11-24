# Earnings lists, news, documents, people

> **Status: TODO**

## Goal

Bring the calls list, calendar, live calls, transcript search, documents, news and people pages onto the shared
pieces of task 6.

## Prerequisites

Tasks 5 and 6; task 10 (the calls list and the call page share `-components/` under `earnings-calls/`).

## Current Behavior

- Calls list (`src/routes/$ticker/earnings-calls/index.tsx`): tabs Transcripts | Documents, search box with chips,
  Upcoming / Past, table with Started / Ended.
- `/calendar`, `/live-calls`, `/search`, `/$ticker/documents`, `/$ticker/news`, `/news-feed`, `/people`,
  `/people/$personId`: individual filter arrangements; long timezone names wrap times in narrow lists (F13).

## Desired Behavior

### Calls list, calendar, live calls, search

- Calls list: `PageHeader` (alert entry points as actions), the search (Transcripts | Documents as a segmented
  control inside the search section), Upcoming / Past as line tabs with counts, `FilterBar` (fiscal year), table:
  Started / Ended merge into one "Recording" column ("11:06 PM – 11:59 PM", or —) and are absent on Upcoming as today.
- `/calendar`: presets (Today / This week / Next week) as a segmented control beside the `DayRange`; other filters
  in a `FilterBar`; day group headings 14 px semibold with the count, sticky under the top bar.
- `/live-calls`: call cards are real cards (discrete objects) in a responsive grid
  (`grid-cols-1 sm:grid-cols-2 xl:grid-cols-3`).
- `/search`: `PageContainer width="narrow"`; query box large (40 px), filters in a `FilterBar` under it, hits in
  the reading column.
- Times in list rows use `formatInstantShort` (one line, F13).

### Documents, news, people

- `/$ticker/documents`: search section on top, `FilterBar` (text, category, section, kind, year), the tree with
  36 px rows, kind badges as `rounded-sm` tags, actions right-aligned and visible on hover / focus (always on touch).
- `/$ticker/news`, `/news-feed`: tabs News | Announcements as line tabs; `FilterBar` (kind, topic, source, earnings,
  published-by, range, order); live switch in the header actions; table rows two lines (headline, then source ·
  published); the pager centred as today. Item dialog: reading column, attribution block as a quiet `Section`.
- `/people`, `/people/$personId`: `FilterBar`; profile = `StatGrid` + sections for calls and role history.

## Requirements

1. Pages above with `PageHeader`, `FilterBar` (each `onReset` clears its params with `IN_PLACE`), `Section`,
   `DataTable`.
2. No request, URL-state, auto-load (`useAutoLoadPages`, `shouldFillPage`) or export change; the documents text filter
   keeps its 200 ms `?q=` write; news keeps `resetScroll: false` for `?item=`.
3. Tests updated where markup changed: `overview-and-calls.test.tsx` (calls list), `market-pages.test.tsx`
   (calendar, live calls), `calendar-semantics.test.tsx`, `earnings-o7.test.tsx` (`/search`), `documents-page.test.tsx`,
   `document-search.test.tsx`, `news-page.test.tsx`, `news-feed.test.tsx`, `news-search.test.tsx`,
   `announcements.test.tsx`, `people-pages.test.tsx`.
4. Responsive checks at 375 / 768 / 1024 / 1440 for each page, both themes.
5. Edge cases: a company without calls ("Not covered" notice), a calendar day without events, news with every row
   hidden by a page-side filter (the "Load the next page" state), a person whose calls failed to load ("Not available").

## Files to Create / Modify

| File | Action | Purpose |
| --- | --- | --- |
| `src/routes/$ticker/earnings-calls/index.tsx`, `-components/{calendar-filters,live-now-strip}.tsx` | Modify | calls list |
| `src/routes/{calendar,live-calls,search,news-feed}.tsx`, `src/routes/people/**` | Modify | shared pieces |
| `src/routes/$ticker/{documents,news}/**` | Modify | filter bars, tree, table |
| tests named above | Modify | |

## Acceptance Criteria

- Calendar, news and documents filters are labelled and collapse on phone.
- No wrapped time in a list row at 375 px.
- Requests of every page unchanged.
- No sideways page scroll at 375 / 768 / 1024 / 1440.
- `pnpm run check`, `pnpm run test` green.
