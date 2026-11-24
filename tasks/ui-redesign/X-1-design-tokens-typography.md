# Design tokens and typography

> **Status: TODO**

## Goal

Give the dashboard its own visual base: a leaf-green accent on green-tinted neutrals, IBM Plex Sans / Mono, and a real
type scale with a 13 px data base — all in `src/styles.css` and the `ui/` primitives, so every page changes at once.

## Prerequisites

None.

## Current Behavior

- `src/styles.css`: stock shadcn zinc tokens (hue 286), `--primary` near-black, Inter Variable, `body` at
  `text-xs/relaxed` (12 px). `--radius: 0.625rem` on everything.
- Page titles are `text-base` (16 px), card titles and table text 12 px: three sizes in total.
- No mono family is declared (`font-mono` = the browser's default).

## Desired Behavior

### 1. Colour tokens (light / dark), same variable names as today

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--background` | `#FBFCFA` | `#0F1312` | page |
| `--card`, `--popover`, `--sidebar` | `#FFFFFF` / `#F5F7F4` (sidebar) | `#161B19` / `#121716` | raised surfaces |
| `--foreground` | `#141A18` | `#ECF0ED` | text |
| `--muted` / `--secondary` / `--accent` | `#EEF1ED` | `#1F2623` | quiet fills, hover |
| `--muted-foreground` | `#5A6661` | `#9AA69F` | secondary text (≥ 4.5:1 on background) |
| `--border`, `--input` | `#DFE4DE` | `#28302C` | hairlines |
| `--primary` | `#1C7430` | `#4DB866` | primary buttons, active nav, links' focus |
| `--primary-foreground` | `#FFFFFF` | `#0B120E` | text on primary |
| `--ring` | `#1C7430` at 45 % | `#4DB866` at 50 % | focus ring |
| `--destructive` | keep | keep | errors |
| new `--brand` | `#218635` | `#4DB866` | the mark, the active tab underline, the GET chip |
| new `--warn` | `#9A5B00` | `#E0A23A` | credits charged, partial coverage |

Write them as `oklch()` like the file does (convert; keep the hex in a comment). Register `--color-brand` and
`--color-warn` in `@theme inline`. Replace `HIGHLIGHT_GREEN`'s literal in `src/hooks/use-html-document-processing.ts`
only if it can read `var(--brand)` — it is injected into an iframe `srcDoc`, so it most likely must stay a literal;
then leave it and say so in a comment. The `--series-*` chart slots stay.

Check every pair with a contrast tool: body text ≥ 4.5:1, muted text ≥ 4.5:1, borders visible in both themes.

### 2. Fonts

- Add `@fontsource-variable/ibm-plex-sans` and `@fontsource/ibm-plex-mono` (weights 400, 500); remove
  `@fontsource-variable/inter` from `package.json` and the import. Neither has a build script (confirm
  `pnpm install` does not stop with `ERR_PNPM_IGNORED_BUILDS`).
- `@theme inline`: `--font-sans: 'IBM Plex Sans Variable', ui-sans-serif, system-ui, sans-serif;`
  `--font-mono: 'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace;`
- Mono is for request paths, ids, accession numbers and code only — not for labels or numbers in tables.
- `table { font-variant-numeric: tabular-nums; }` in the base layer (verify the font exposes `tnum`; if a figure
  column still jitters, say so in the task notes and fall back to `font-feature-settings: "tnum"`).

### 3. Type scale (rem; the only sizes pages may use)

| Role | Size / line | Weight | Tailwind |
| --- | --- | --- | --- |
| Page title (`h1` of a global page, `h2` of `PageHeader`) | 20 / 28 | 600 | `text-xl` |
| Instrument symbol | 24 / 32 | 650 | `text-2xl` |
| Section title | 15 / 22 | 600 | new `text-[0.9375rem]` via a `.text-section` utility |
| Prose, descriptions, form labels | 14 / 22 | 400 | `text-sm` |
| Data (tables, lists, badges' neighbours) — the `body` default | 13 / 20 | 400 | new utility `text-data` (`0.8125rem`) |
| Small (meta lines, table header, badges) | 12 / 16 | 500 | `text-xs` |

`body` becomes `text-data` (define `--text-data: 0.8125rem; --text-data--line-height: 1.25rem;` in `@theme`).
Descriptions get `max-w-[68ch]`.

### 4. Shape and density

- `--radius: 0.5rem`; controls (`Button`, `Input`, `Select`) use `rounded-md`, cards `rounded-lg`, badges
  `rounded-full` only for status badges, `rounded-sm` for type tags.
- `Card` (`src/components/ui/card.tsx`): no shadow, 1 px border, padding `p-4` (phone) / `p-5` (≥ 640). Add a
  `variant="plain"` (no border, no padding) for sections that only need the `CardHeader` / `CardTitle` typography —
  task 6 replaces nested cards with it.
- `Button` sizes: default height 32 px, `sm` 28 px; below 640 px every interactive control is at least 36 px tall
  (`max-sm:min-h-9` on `Button`, `Input`, `SelectTrigger`, tab triggers).
- `Table` (`src/components/ui/table.tsx`): row height 36 px, header `text-xs font-medium text-muted-foreground`
  sentence case, cell padding `px-3`, numeric cells right-aligned by the pages as today.
- `Badge`: `text-xs`, height 20 px.
- Remove the global `:hover { opacity: 0.85 }` rule's effect on table rows and tabs if it fights the new hover fills
  (keep `cursor: default` as is — it is a deliberate choice of this app).

### 5. Focus and motion

- One visible focus style: `outline: 2px solid var(--ring); outline-offset: 2px` on `:focus-visible` for links,
  buttons, inputs, tabs, table row buttons.
- `@media (prefers-reduced-motion: reduce)`: animations and transitions off (`tw-animate-css` classes included).

## Requirements

1. Change tokens, fonts and scale in `src/styles.css` as above.
2. Adjust `card.tsx`, `button.tsx`, `input.tsx`, `select.tsx`, `badge.tsx`, `table.tsx`, `tabs.tsx`, `skeleton.tsx`
   to the scale and density; no API change except `Card`'s new `variant`.
3. `text-xs/relaxed` is hard-coded in 14 primitives today, so changing `body` alone changes almost nothing:
   `tabs`, `alert-dialog`, `input-group`, `card`, `sheet`, `field`, `label`, `combobox`, `dialog`, `button`,
   `select`, `textarea`, `dropdown-menu`, `input` (`grep -rl "text-xs/relaxed" src/components/ui`). Replace each with
   the role from the scale (controls and menu items `text-data`, labels `text-sm` / `text-xs font-medium` as the
   role says, descriptions `text-sm`); the grep over `src/components/ui` must be empty afterwards.
4. Do not touch page files in this task, except the 3 places outside `src/components/ui` that pin `text-xs/relaxed`
   (`grep -rn "text-xs/relaxed" src | grep -v components/ui`): remove them where they only restate the old base.
   Pages also set `text-xs` directly on data text (~250 places); those stay for now and are reviewed by the page
   tasks 7–13 (see the README rules).
5. Theme script (`src/lib/theme.ts`) and `ThemeToggle` unchanged.
6. Edge cases: SEC HTML viewer and PDF viewer keep their white page; charts (`chart-parts.tsx`) already read
   `var(--border)` / `var(--muted-foreground)` (`AXIS_TICK`, `GRID_STROKE`): verify only, and raise `AXIS_TICK`'s
   `fontSize` 11 → 12 (the "Small" role); the sonner toaster (`sonner.tsx`) already reads `--popover` / `--border`:
   verify in both themes.

## Files to Create / Modify

| File | Action | Purpose |
| --- | --- | --- |
| `package.json`, `pnpm-lock.yaml` | Modify | swap font packages |
| `src/styles.css` | Modify | tokens, fonts, scale, focus, reduced motion |
| `src/components/ui/{card,button,input,select,badge,table,tabs,skeleton}.tsx` | Modify | density, radius, sizes |
| `src/components/ui/{alert-dialog,input-group,sheet,field,label,combobox,dialog,textarea,dropdown-menu}.tsx` | Modify | drop the pinned `text-xs/relaxed` |
| `src/components/charts/chart-parts.tsx` | Modify | axis tick size |
| `src/hooks/use-html-document-processing.ts` | Modify (comment only, most likely) | why `HIGHLIGHT_GREEN` stays a literal |
| `src/components/ui/tabs.test.tsx`, `sidebar.test.tsx` | Modify if needed | class assertions |

## Acceptance Criteria

- Light and dark both render with the green accent and Plex; no zinc-purple grey is left (`grep "285\\.\\|286\\." src/styles.css` is empty).
- Body text computes to 13 px, descriptions 14 px, page titles 20 px.
- `grep -rl "text-xs/relaxed" src/components/ui` is empty; a `Button`, `Input` and `SelectTrigger` compute to 13 px.
- Figures in a table column line up digit under digit.
- Keyboard focus is visible on every control of `/`, `/AAPL`, `/alerts/new`.
- Contrast: text and muted text ≥ 4.5:1 in both themes (values noted in the PR / commit message).
- No page scrolls sideways at 375 px after the size change (`/`, `/AAPL`, `/AAPL/financials`, `/AAPL/filings`).
- `pnpm run check`, `pnpm run test` green.
