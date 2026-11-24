# Alerts family

> **Status: TODO**

## Goal

Rework the write side of the dashboard — alerts, events, destinations, end users, scripts, webhooks — so that its
forms are short and grouped, its lists use the shared pieces, and every write is visible in the request panel.

## Prerequisites

Tasks 3 (writes are listed in the panel's "Writes" group) and 6 (`HeadingLevelProvider` already wraps
`alerts/route.tsx`).

## Current Behavior

- `/alerts/*`: a tab row (Alerts, Events, Destinations, Users, Scripts, Webhooks) from `src/lib/alerts/tabs.ts`,
  then each page's `PageHeader`; the list's six filters are a row of placeholder-only inputs.
- `/alerts/new`: numbered fieldsets ("1. Type", "2. Condition", …) with full-width textareas for symbols, CIKs and
  form types, each ~70 px tall, help text under every field — several screens for a simple alert (F11).
- Detail pages (`/alerts/$id`, destination, end user, script): summary cards + tables.

## Desired Behavior

### Section navigation

- "Alerts" becomes a page family header like the ticker header: title "Alerts" and the six tabs as line tabs
  (links, `aria-current`); the quota line ("0 of 2,000 alerts · 0 of 500 script / indicator alerts") is the `/alerts`
  list page's `PageHeader meta` (requirement 1),
  one row that scrolls inside itself on phone. Each sub-page then has only its own actions row
  (e.g. "New alert"), not a second big title.

### Lists (alerts, events, destinations, users, scripts)

- `FilterBar` with visible labels (Status, Type, Symbol, Destination, End user, Client reference); `DataTable`
  with toolbar; the selection bar for bulk actions appears as a sticky bar above the table when rows are selected
  ("3 selected · Pause · Resume · Delete"), not as permanently visible disabled buttons.
- Empty state for a first-time account: an invitation, not a table with one grey line — "No alert yet" + what an
  alert does in one sentence + "New alert" button + a link to the webhook reference. With a filter set: "No alert
  matches these filters" + "Reset filters" (the existing `filtered` distinction).
- Events: live switch in the header actions; new rows' 4-s highlight uses `--brand` at low opacity; payload JSON in
  a scroll box (code).

### Alert form (`AlertFormView`)

```
New alert                                             [Check]  [Create alert]     ← actions sticky at the bottom on phone
┌ form (max-w-3xl) ───────────────────────┐  ┌ summary (≥ xl, sticky) ────────────┐
│ What to watch   Type [SEC filing ▾]      │  │ SEC filing on AAPL, MSFT            │
│                 one-line description     │  │ forms 8-K · delivered to 1 webhook  │
│ Condition       Symbols [AAPL ×][MSFT ×] │  │ Request body (JSON, live)           │
│                 Form types [8-K ×] …     │  └─────────────────────────────────────┘
│ ▸ More conditions (CIKs, categories, amendments, stage)                            │
│ When it fires   cooldown / re-arm (only for the types that have them)              │
│ Delivery        destinations checklist · end user · references                    │
└──────────────────────────────────────────┘
```

- Sections are named by what they do, not numbered (the order is not a required sequence: the type can change
  last). Comma-list fields (symbols, CIKs, form types, keywords) become token inputs: a one-line input that turns
  entries into removable chips on comma / space / Enter / paste; the form STATE stays the text the model already
  uses (`alert-form.ts` unchanged: the token input reads and writes the same string), so `toCreateBody`,
  `fromAlert` and their tests do not change.
- Fields in a 2-column grid from `md` (short selects and numbers side by side), help text 12 px muted under the
  field, shown for the focused / invalid field and behind an (i) for the rest — never hidden when it carries a
  bound or a required format.
- Optional fields of a type that are rarely used sit in a "More conditions" disclosure, opened automatically when
  any of them has a value or an error (`fieldErrorsOf` → open + scroll to the first error).
- Summary column: a plain-language sentence built from the form, and the request body the form will send
  (`toCreateBody` output through `redactSecrets`, in a `JsonTree`) — this is an API example, the body is the
  lesson. Below `xl` the summary is a disclosure above the actions.
- Destination editor dialog, end-user edit / batch dialogs, script upload dialog, `SecretOnceDialog`: same field
  grid and typography; the secret rules of `CLAUDE.md` are untouched (no storage, no log, dropped on close).

### Detail pages

- `/alerts/$id`, `/alerts/destinations/$id`, `/alerts/users/$externalUserId`, `/alerts/scripts/$id`: title row
  with status badge and actions (destructive ones in a `⋯` menu, each still through `ConfirmAction`), a `StatGrid`
  summary, sections for events / deliveries / alerts / versions. `UsageBar`s in `--brand` with the limit text
  beside them. Script source: line-numbered code box, as today.
- `/alerts/webhooks`: a two-column reference from `lg` (event types list left as in-page anchors, schema +
  example right), one column below.

## Requirements

1. Family header in `src/routes/alerts/route.tsx` with "Alerts" as the page's `h1` (sub-pages' `PageHeader`s are
   `h2` through task 6's provider); tabs = `ALERTS_TABS` of `src/lib/alerts/tabs.ts` (today rendered by
   `AlertsTabs` in `route.tsx`) restyled as links with `aria-current`. The quota line comes from the alerts list's
   own `listAlerts` answer (`meta.quota`, `quotaText`), so it stays with that list: on `/alerts` it moves from
   `AlertsListView`'s body into the list page's `PageHeader meta`; the family header itself shows only title + tabs
   (no extra request on sibling pages). The mock-up's quota-in-family-header is dropped for that reason.
2. `TokenInput` in `src/components/ui/token-input.tsx` (≥ 4 consumers: symbols, CIKs, form types, keywords):
   accessible (chips are buttons "Remove AAPL", Backspace removes the last, paste splits), value in / out as the
   same separator-joined string; unit tests.
3. Rework `AlertFormView`, `alert-form-pickers.tsx`, `FieldShell`, list views, detail views, dialogs.
4. No change to `alert-form.ts`, `condition-fields.ts`, request functions, mutations, idempotency or confirm rules.
5. Tests updated: `alerts-{list,form,form-pickers,events}.test.tsx`, `destinations-{views,secret}.test.tsx`,
   `alert-users-pages.test.tsx`, `scripts-pages.test.tsx`, `webhook-reference.test.tsx`,
   `alert-entry-points.test.tsx`; new `token-input.test.tsx`.
6. Live check with the enterprise key (real writes, as the 2026-11-22 walk did): create one `filing` alert with a
   marker in its name through the new form, confirm it appears in the list and in the panel's "Writes" with a
   redacted body, then delete it; the list is back to its start state. Do not send a test event to a real
   destination without the owner's go.
7. Responsive: form at 375 px = one column, actions pinned to the bottom, token inputs wrap; lists collapse their
   filters; the bulk bar stays reachable.

## Files to Create / Modify

| File | Action | Purpose |
| --- | --- | --- |
| `src/routes/alerts/**` | Modify | family header, pages |
| `src/components/alerts/**` | Modify | lists, form, pickers, detail views, dialogs |
| `src/components/ui/token-input.tsx` (+ test) | Create | chip input over a text value |
| tests named above | Modify | |

## Acceptance Criteria

- A simple `filing` alert on one symbol is created from a form that fits one screen at 1440 × 900.
- The form shows the request body it will send; a 400's field errors land on their fields, opening the
  disclosure that holds them.
- Lists have labelled filters, an inviting first-time empty state and a contextual bulk bar.
- Secrets: `destinations-secret.test.tsx` green unchanged in intent (cache, storage, DOM after close).
- No sideways page scroll at 375 / 768 / 1024 / 1440.
- `pnpm run check`, `pnpm run test` green.
