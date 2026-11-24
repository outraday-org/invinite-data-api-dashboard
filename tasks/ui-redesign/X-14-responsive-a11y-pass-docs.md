# Responsive and accessibility pass, docs

> **Status: TODO**

## Goal

Walk the finished redesign on every route at every breakpoint in both themes, fix what the page tasks missed,
remove what the redesign left unused, and bring `CLAUDE.md` / `README.md` in line with the new shell.

## Prerequisites

Tasks 1–13.

## Current Behavior

After tasks 1–13 each page was checked by its own task; nobody has looked at the whole app in one pass, and
`CLAUDE.md` still describes the old shell (the "API" button of `PageHeader`, the sidebar's Market / Browse lists,
the 768 px breakpoint, `text-xs/relaxed`).

## Desired Behavior

### 1. The walk

Dev server with the enterprise key, built-in browser. For every route of the list below, at 375, 768, 1024, 1440
and 1920 px, dark and light:

| Check | Pass condition |
| --- | --- |
| Sideways scroll | `document.documentElement.scrollWidth === clientWidth` |
| Hierarchy | one page title, sections distinguishable at a glance, no nested card |
| Filters | labelled; collapsed behind "Filters · n" at 375 |
| Tables | scroll inside their wrapper; first column pinned on phone; header sticky under the pinned bars from `lg` |
| Request panel | toggle present; docked ≥ 1280, sheet below; page requests first; content usable beside it at 1280 exactly |
| Pinned bars | top bar, ticker header (compact), player: no overlap, no gap, no jitter while scrolling |
| Touch | interactive controls ≥ 36 px at 375 / 768 |
| Text | no wrapped time / date in a list row, no truncated value without a `title` |
| States | loading skeleton shaped like the result; error and empty states in the new notice layout |

Routes: `/`, `/calendar`, `/live-calls`, `/ipo-calendar`, `/market-holidays`, `/us-macro/{inflation,gdp,labor,
yield-curve}`, `/instruments` (+ Companies), `/funds`, `/spot-coins` + one coin, `/institutions`, `/people` + one
person, `/news-feed`, `/filings` + one 10-K + one 13F-HR, `/sec/datasets`, `/sec/320193` + one 13F manager,
`/search`, `/catalog` (each tab), `/offerings` + one offering, `/account`, `/alerts` and its five siblings + one
detail of each, `/AAPL` and every section, one call page (recorded), `/SPY`, `/GLD`, one ETN, one closed-end fund,
an unknown symbol, a gated section (`/SPY/financials`), the onboarding card (key removed in a private window —
never print or paste the key).

Width 1280 px gets its own look: sidebar + content + docked panel leave ~650 px for content; if key pages
(financials, filings) are not usable there, raise the docking breakpoint to 1440 px in the store / panel and say
so in the README's breakpoint table.

Log each defect in `tasks/ui-redesign/findings.md` (id, route, width, theme, what, fix commit) and fix it in the
shared piece, not on the page, wherever more than one page shows it.

### 2. Accessibility

- Keyboard: Tab order = visual order on `/`, `/AAPL`, `/AAPL/financials`, the call page, `/alerts/new`; the skip
  link works; the request panel's sheet variants trap and return focus; Escape closes sheets, dialogs, menus;
  the `.` shortcut never fires while typing.
- Landmarks: one `banner` (top bar — give its wrapper `<header>` if it is still a `div`), `navigation` (sidebar,
  ticker tabs — each with an `aria-label`), `main` (`SidebarInset`'s `<main id="content">`, task 5),
  `complementary` (request panel, task 3). Verify; add only what is missing.
- Headings: one `h1` per page (the ticker symbol on instrument pages, "Alerts" on the alerts family, the page title
  elsewhere — task 6's `HeadingLevelProvider` / `level`), sections `h2` / `h3` without skipping. Verify on every
  route of the walk; fix a page that bypasses `PageHeader` / `Section` with its own heading.
- Contrast: text, muted text, badges, chart axes ≥ 4.5:1; focus ring ≥ 3:1 against both the control and the page.
- Reduced motion: the panel and sidebar transitions, skeleton pulse and the live dot respect
  `prefers-reduced-motion`.
- Colour is never the only carrier: method chips, status, live, partial coverage each have text or an icon.

### 3. Cleanup

- Delete what is unused: anything tasks 3 / 7 left (`api-sheet.tsx`, `BROWSE_CARDS`), `Card` imports that linger
  after `Section` replaced them, unused class constants (`WRAPPING_TABS_LIST_CLASS` if no page uses it any more),
  confirm `@fontsource-variable/inter` is gone from `package.json` and the lockfile. `pnpm run lint` reports unused
  imports; for unused exports use `grep -rn "<name>" src` per candidate.
- `grep` gates (each must be empty): `grep -rn "ApiButton" src`; `grep -rl "text-xs/relaxed" src`;
  `grep -rn "mx-auto flex w-full max-w" src`; the typed-plan gate of task 9 widened to `src`
  (`grep -rn "(PRO)" src/components src/routes | grep -v -E ":\s*(//|/\*|\*)"`); `grep -rn "uppercase tracking" src`
  (two files on 2026-11-24: `app-sidebar.tsx`, `call-header.tsx`; tasks 4 / 10 remove them) outside badges that show
  codes.
- `pnpm run build` succeeds; note the CSS / JS size before and after (fonts changed).

### 4. Docs

- `CLAUDE.md`: rewrite "Page shell", "Shell (O5)" (sidebar groups, breakpoints, top bar, key gate unchanged),
  "API inspector" (request panel: store, toggle, groups, placement by width; no `ApiButton`), "Shared UI pieces"
  (add `PageContainer`, `FilterBar`, `FilterField`, `Section`, `StatGrid`, `TokenInput`, `SectionTabs`,
  `formatInstantShort`), the navigation table (`NAV_GROUPS`, `API_FAMILIES`), the tokens / type scale as a short
  "Design tokens" section with the rule "sizes only from the scale, mono only for paths / ids / code". Remove
  statements that are no longer true; do not append a changelog.
- `README.md`: a short "What you see" section with two screenshots (desktop with the panel docked, phone) stored
  under `public/` or `docs/`, and one paragraph on the request panel as the way to learn the API from the app.
- `tasks/ui-redesign/`: rename each finished task file to its `X-` form as the repo does for completed tasks.

## Requirements

1. Run the walk, log and fix; re-check each fix at the width / theme it was found.
2. Add what the walk finds missing in landmarks / heading levels; tests: a root-layout test
   (`src/routes/-tests/root-layout.test.tsx`) for the landmarks and the skip link (the `PageHeader` level cases live
   in `data-table.test.tsx` since task 6).
3. Cleanup + grep gates + build.
4. Docs.
5. `pnpm run check`, `pnpm run test`, `pnpm run build` green at the end.

## Files to Create / Modify

| File | Action | Purpose |
| --- | --- | --- |
| `tasks/ui-redesign/findings.md` | Create | defect log of the walk |
| shared pieces / pages as the findings require | Modify | fixes |
| `src/routes/__root.tsx` | Modify if needed | `banner` landmark |
| `src/routes/-tests/root-layout.test.tsx` | Create | landmarks, skip link |
| `CLAUDE.md`, `README.md` | Modify | new shell documented |
| unused files / exports | Delete | cleanup |

## Acceptance Criteria

- Every route in the list passes every check at all five widths in both themes, or has a logged, fixed finding.
- All grep gates are empty.
- A keyboard-only run through `/AAPL` → Financials → open the request panel → copy a curl → close works.
- `CLAUDE.md` describes the shell as built; no paragraph mentions the per-page "API" button.
- `pnpm run check`, `pnpm run test`, `pnpm run build` green.
