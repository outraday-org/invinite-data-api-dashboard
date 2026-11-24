# Shared page pieces

> **Status: TODO**

## Goal

Rework the pieces every page is made of — page header, filter bar, section, data table, tabs inside a page, state
notices — so that pages stop looking crowded before any page file is touched individually.

## Prerequisites

Tasks 1 and 2; task 3 (it removed the API button from `PageHeader`, which this task reworks — doing this first would
conflict with it).

## Current Behavior

- `PageHeader`: `h2` 16 px + description left, an `actions` flex row right holding filters, toggles, "Create alert"
  — everything a page has, wrapping raggedly (F5).
- Filters are bare controls: `DayRange` without visible labels, `Input` with placeholder-only meaning, selects.
- `DataTable`: export button on its own right-aligned line above the table, "N loaded" in the load-more button.
- Sections are `Card`s, often inside another `Card` (F6).

## Desired Behavior

### 1. `PageHeader` — title, description, primary actions only

```
Dividends                                         [Create alert ▾]
Cash dividends by ex-date, newest first.
```

- `title` 20 px, `description` 14 px muted `max-w-[68ch]`; `actions` = at most the page's primary actions (create,
  alert entry point, live switch). Filters no longer go here.
- New optional `meta` slot under the description (counts, "Newest filing Nov 19, 2026", coverage line).
- Below 640 px actions drop under the description, full width, left-aligned.
- **Heading level** (moved here from task 14 so pages 7–13 are not edited twice): `PageHeader` renders `h1` by
  default and `h2` inside a family header. Read the level from a small context, `HeadingLevelProvider` /
  `usePageHeadingLevel` in `src/components/ui/page-header.tsx`, provided as `2` by `$ticker/route.tsx` (its header's
  `h1` is the symbol) and by `alerts/route.tsx` (task 13 gives it the family `h1`); an explicit `level` prop
  overrides it. No page passes a level today, so no page changes. `Section` titles are then one step below
  (`h2` on global pages, `h3` under a family header) through the same context.

### 2. `FilterBar` — `src/components/ui/filter-bar.tsx`

```tsx
<FilterBar onReset={…} activeCount={2}>
    <FilterField label="Form type"><FilterSelect … /></FilterField>
    <FilterField label="8-K items"><DebouncedInput … /></FilterField>
    <FilterField label="Filed"><DayRange … /></FilterField>
    <FilterBar.Trailing><Button>Search text</Button></FilterBar.Trailing>
</FilterBar>
```

- `FilterField`: a visible 12 px label above its control (`<label>` bound by `htmlFor`, or `role="group"` +
  `aria-labelledby` for `DayRange` / chip groups). Controls align on one baseline grid, `gap-3`.
- Wraps as a CSS grid (`grid-cols-[repeat(auto-fill,minmax(10rem,max-content))]`-like), never as a ragged flex row.
- `activeCount` > 0 shows "Reset filters" (calls `onReset`, which the page implements by clearing its search
  params with `IN_PLACE`).
- Below 640 px: collapsed into one "Filters · 2" disclosure button (`aria-expanded`), open state local; the first
  render on the server is collapsed-on-phone via CSS (`max-sm:hidden` content + the button), not via `useIsMobile`
  (no hydration flash). Fields stack full width when open.
- Move `FilterSelect` from `src/routes/$ticker/earnings-calls/-components/calendar-filters.tsx` to
  `src/components/ui/filter-select.tsx` and re-export it from the old place — ~30 files import it today (financials,
  holders, alerts, news, …), so no import is rewritten in this task.
- `DayRange` keeps its API; add a visible `label` prop used by `FilterField`; date inputs get `lang`-independent
  `aria-label`s as today.

### 3. `Section` — `src/components/ui/section.tsx`

```tsx
<Section title="Fiscal periods" description="…" actions={<ExportMenu … />}>…</Section>
```

- An `h3` 15 px title row with optional description and right-aligned actions, content below, `gap-3`;
  separated from the next section by whitespace (`gap-8` in the page) — no border, no background.
- `Card` remains for discrete objects (a tile, a call card, a destination) and for forms. Rule for pages (tasks
  7–13): no `Card` directly inside a `Card`; a page's top-level blocks are `Section`s.
- `StatGrid` / `Stat` (`src/components/ui/stat.tsx`): label 12 px muted, value 15 px, optional sub-line; grid
  `grid-cols-2 sm:grid-cols-3 xl:grid-cols-4` with hairline dividers instead of one bordered card per value —
  replaces the tile rows of the overview, account, offering detail, coin detail.

### 4. `DataTable`

- A toolbar row above the table: left = count / meta ("40 loaded", coverage line slot), right = `ExportMenu`
  (icon + "Export", 28 px). No separate line for the export button.
- Header row: 12 px medium, muted, sentence case; sort indicators unchanged.
- Row hover fill; row height 36 px; first column `font-medium`; ids in mono with their copy button appearing on
  row hover / focus-within (always visible on touch: `@media (hover: none)`).
- Sideways scroll stays inside the wrapper, with a fade on the cut edge and `stickyFirstColumn` available as today;
  below 640 px the first column is sticky by default when the table has more than 4 columns.
- Empty and error rows: 14 px, centred vertically in a 120 px block; the empty line keeps the `emptyIsGenuine` rule.
- `LoadMoreButton`: centred under the table, "Load more" + the credit hint tooltip; `loadedCount` moves to the
  toolbar.
- Statement tables (`financials-flat-table`, `financials-presentation-table`, `financial-metrics-table`, segments)
  get the same header / row styles through shared class constants in `src/lib/layout.ts`
  (`TABLE_HEAD_CLASS`, `TABLE_ROW_CLASS`) — they keep their own markup.

### 5. In-page tabs and notices

- `ui/tabs.tsx` line variant: 36 px, active = `--brand` underline, same look as the ticker `SectionTabs` but one
  step smaller (14 px → 13 px); pill variant (`TabStrip`, view switches) = a quiet segmented control.
- `Notice`, `ErrorState`, `RequestErrorState`, `SecReadinessNotice`: one layout — icon, 14 px title, 13 px text,
  optional action; `max-w-[60ch]`; no heavy border (left accent bar: neutral, `--warn` for partial, `--destructive`
  for errors).
- `format.ts`: add `formatInstantShort` (zone as the short name, e.g. "1:00 PM CET"; falls back to the offset) for
  narrow lists (F13); `formatInstant` unchanged.

## Requirements

1. Build `FilterBar`, `FilterField`, `Section`, `StatGrid` / `Stat`; rework `PageHeader`, `DataTable`,
   `LoadMoreButton`, `ExportMenu` trigger, `tabs.tsx`, `TabStrip`, `Notice`, `ErrorState`.
2. In this task migrate only two reference pages end to end to prove the pieces: `/$ticker/dividends`
   (`src/routes/$ticker/dividends/index.tsx`, simple) and `/$ticker/filings` (`src/routes/$ticker/filings/index.tsx`
   + `-components/`, many filters, live switch, search). Each `onReset` clears its filter params with `IN_PLACE`
   (`url-state.test.ts` keeps failing on a same-page navigation without it). Other pages keep compiling (the `actions` prop still
   accepts anything) and are migrated in tasks 7–13.
3. No request, URL-state or export behaviour changes.
4. Tests (component tests start with `// @vitest-environment jsdom`, in `src/routes/-tests/`):
   `filter-bar.test.tsx` (labels bound, reset, phone disclosure, active count), `section.test.tsx`,
   `stat.test.tsx`, `data-table.test.tsx` (toolbar, count, export place, empty / error rows; `PageHeader` `h1` by
   default, `h2` under the provider, `level` override), `src/lib/format.test.ts` (`formatInstantShort`, incl. a zone
   without a short name → offset), `filings-page.test.tsx` and the dividends cases (`reference-pages.test.tsx`,
   `alert-entry-points.test.tsx`) updated.
5. Edge cases: a `FilterBar` with one field (no disclosure on phone, shown inline); 0 active filters (no reset);
   a table with no export (`exportConfig` unset: toolbar shows the count only, or nothing when there is none);
   loading (skeleton rows keep the toolbar's height: no layout jump).

## Files to Create / Modify

| File | Action | Purpose |
| --- | --- | --- |
| `src/components/ui/{filter-bar,filter-select,section,stat}.tsx` | Create | new pieces |
| `src/components/ui/{page-header,data-table,load-more-button,tabs,notice,error-state,day-range}.tsx` | Modify | rework, heading-level context |
| `src/routes/$ticker/earnings-calls/-components/calendar-filters.tsx` | Modify | re-export `FilterSelect` |
| `src/components/sec/sec-readiness-notice.tsx` | Modify | notice layout |
| `src/routes/$ticker/route.tsx`, `src/routes/alerts/route.tsx` | Modify | `HeadingLevelProvider value={2}` |
| `src/components/api/export-menu.tsx`, `src/components/navigation/tab-strip.tsx`, `src/lib/layout.ts`, `src/lib/format.ts` | Modify | styles, constants, short instant |
| `src/routes/$ticker/dividends/index.tsx`, `src/routes/$ticker/filings/**` | Modify | reference migrations |
| tests named above | Create / Modify | |

## Acceptance Criteria

- `/AAPL/filings` at 1440 px: title + actions on one line, one labelled filter bar, table toolbar with count and
  export; at 375 px: "Filters · n" disclosure, the table directly after it, first column sticky.
- Every filter control has a visible label and an accessible name.
- `/AAPL/dividends` has one `h1` (the symbol) and its `PageHeader` title is an `h2`; a global page's `PageHeader`
  title is its `h1`.
- No nested `Card` on the two migrated pages.
- All other pages still render and pass their tests.
- `pnpm run check`, `pnpm run test` green.
