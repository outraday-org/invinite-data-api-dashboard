# Shell, breakpoints, PageContainer

> **Status: TODO**

## Goal

One page frame for every route: a `PageContainer` instead of 30 hand-written wrappers, the four breakpoints of the
README, a top bar with the brand mark and a reserved slot for the request-panel toggle, and a sidebar that is
off-canvas below 1024 px.

## Prerequisites

Task 1.

## Current Behavior

- `src/routes/__root.tsx`: top bar = sidebar trigger · `TickerSearch` · theme toggle · key button. No brand mark.
- 30 route files repeat `mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 lg:px-8` (variants `gap-6`, `py-8`,
  `max-w-7xl` on macro, `max-w-5xl` on `/search`); `$ticker/route.tsx` has its own (`pb-8`, no top padding).
- `src/hooks/use-mobile.tsx`: `MOBILE_BREAKPOINT_PX = 768`; from 768 px the sidebar is docked at 16 rem (F9).
- Content steps aside with `md:peer-data-[state=expanded]:pl-(--sidebar-width)`.

## Desired Behavior

### 1. `PageContainer` (`src/components/ui/page-container.tsx`)

```tsx
export function PageContainer({ children, className, width = "default" }: {
    children: React.ReactNode;
    className?: string;
    width?: "default" | "narrow" | "wide";
}) { … }
```

- `default` = `max-w-[75rem]` (1200 px), `narrow` = `max-w-3xl` (forms, `/search`), `wide` = `max-w-[90rem]` (macro).
- Padding: `px-4 py-5` phone, `sm:px-6 sm:py-6`, `xl:px-8 xl:py-8`; vertical rhythm `gap-6` (sections) — pages keep
  smaller gaps inside a section.
- `data-slot="page-container"`; `min-w-0` so a wide child cannot stretch it.
- Replace every hand-written wrapper listed by `grep -rln "mx-auto flex w-full" src` (27 files on 2026-11-24: 24
  route files incl. `alerts/route.tsx`, `$ticker/route.tsx`, `sec/$cik.tsx`, `people/$personId.tsx`,
  `filings/$accession.tsx`, both of a route that has two; plus `src/components/macro/macro-page.tsx`,
  `src/components/ui/route-states.tsx` and `src/components/api-key/onboarding-card.tsx`). `$ticker/route.tsx` passes
  its own top padding (the pinned header supplies it) and keeps its negative-margin sticky header aligned with the
  container's new padding (`-mx-4 sm:-mx-6 xl:-mx-8`, matching `px-4 sm:px-6 xl:px-8`).

### 2. Breakpoints

- `MOBILE_BREAKPOINT_PX = 1024`; the content offset class becomes `lg:peer-data-[state=expanded]:pl-(--sidebar-width)`.
  Check `src/components/ui/sidebar.tsx` for every `md:` that belongs to the docked state and move it to `lg:`.
- Sidebar width `14.5rem` (232 px) docked, `18rem` off-canvas (`SIDEBAR_WIDTH` / `SIDEBAR_WIDTH_MOBILE` in
  `sidebar.tsx`; the `md:` classes to move are on the wrapper `hidden md:block`, the fixed container `md:flex`, the
  inset variant and the menu-action `md:after:hidden` / `md:opacity-0`).
- `use-mobile` stays false on the first client render (hydration, as today).

### 3. Top bar

```
phone   [☰] [ Search …            ] [⇄]              theme + key + plan move into the sidebar footer / account
tablet  [☰] [◆] [ Search …                ] [◐][Plan][🔑][⇄ API]
desktop [☰] [◆ Invinite Data] [   Search …   ⌘K   ] [◐][Plan][🔑][⇄ API]
```

- Brand: the mark (`/brand/icon.svg`) + "Invinite Data" (text from `sm`, hidden on phone), linking `/`.
- Search stays centred from `lg`, grows to fill between on smaller widths.
- A `TopBarActions` slot at the far right, after the key button: task 3 renders the panel toggle there. In this task
  render nothing in it.
- Below 640 px: `ThemeToggle` and the plan badge leave the top bar (the plan is already beside "Account"). This task
  renders the `ThemeToggle` in the sidebar's existing bottom block (beside "Account", `sm:hidden`) so the toggle is
  never unreachable on a phone; task 4 moves it into the new footer. The key button stays (onboarding needs it).
- Bar: `h-14`, bottom hairline (`border-b`) once the page is scrolled (`data-scrolled` via a scroll listener with
  `requestAnimationFrame`, or a 1 px sentinel + `IntersectionObserver`; no layout shift).
- `--app-topbar-height` stays `56px`.

### 4. Layout variables for the panel (used by task 3)

On `<body>`: `--request-panel-width: 0px` by default. The content wrapper gets
`xl:pr-(--request-panel-width)` so a docked panel pushes content the way the sidebar does. Nothing sets it to
another value yet.

### 5. Wide screens

At ≥ 1920 px the content stays centred in the space between sidebar and (later) panel; tables do not stretch beyond
the container.

## Requirements

1. Create `PageContainer`, replace all wrappers, keep each route's `width` as close to today as the three widths allow.
2. Move the sidebar breakpoint; verify the off-canvas sidebar closes after a navigation on phone and tablet
   (if it does not today, close it in `AppSidebar` on route change via `useSidebar().setOpenMobile(false)`).
3. Rework the top bar markup in `__root.tsx`; keep `SidebarTrigger`'s `aria-label`.
4. The onboarding card (`src/components/api-key/onboarding-card.tsx`, rendered by `KeyGate`) uses
   `PageContainer width="narrow"` instead of its own wrapper.
5. Tests: `src/routes/-tests/page-container.test.tsx` (the three widths, `className` merge); update
   `sidebar.test.tsx` / `app-sidebar.test.tsx` for the breakpoint; `route-names.test.ts` untouched.
6. Edge cases: the SSR render (no `window`) shows the docked layout without a flash on desktop; the route pending /
   error components (`route-states.tsx`) use `PageContainer` too.

## Files to Create / Modify

| File | Action | Purpose |
| --- | --- | --- |
| `src/components/ui/page-container.tsx` | Create | the one page frame |
| `src/routes/__root.tsx` | Modify | top bar, layout variables, actions slot |
| `src/hooks/use-mobile.tsx`, `src/components/ui/sidebar.tsx` | Modify | 1024 px breakpoint, widths |
| 24 route files, `src/components/macro/macro-page.tsx`, `src/components/ui/route-states.tsx`, `src/components/api-key/onboarding-card.tsx` | Modify | use `PageContainer` |
| `src/components/navigation/app-sidebar.tsx` | Modify if needed | close the off-canvas sidebar on navigation |
| `src/components/ui/sidebar.test.tsx`, `src/routes/-tests/app-sidebar.test.tsx` | Modify | breakpoint |
| `src/routes/-tests/page-container.test.tsx` | Create | widths |

## Acceptance Criteria

- `grep -rn "mx-auto flex w-full max-w" src/routes src/components` finds no page wrapper.
- 768 px: sidebar off-canvas, the filings table shows all its columns or scrolls inside its wrapper; 1024 px: sidebar
  docked.
- 375 px: top bar = trigger, search, key, (slot); nothing overflows.
- The brand mark links home on every page.
- No page scrolls sideways at 375 / 768 / 1024 / 1440 / 1920.
- `pnpm run check`, `pnpm run test` green.
