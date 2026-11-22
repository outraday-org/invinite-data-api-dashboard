# Task 9 — Alerts II: create all 17 types, edit / conflict, actions, batch, events, entry points

> **Status: TODO**

## Goal

Create one alert of every condition type through the UI (all delivering to D1 = webhook.site), exercise Check
(`validate_only`), duplicate, edit with a version conflict, pause / resume / test / delete, bulk actions with per-item
results, the event feed (REST + live) and the ticker-page entry points. All alerts stay for Task 10's cleanup except
the ones deleted here.

## Prerequisites

Task 8 (D1, D2 ids in `findings.md`).

## Current Behavior

`src/routes/alerts/{index,new,$id,events}.tsx`, `src/components/alerts/` (`AlertsListView`, `AlertFormView`,
`AlertDetailView`, `AlertEventsView`, `alert-editor.tsx`, `alert-form-pickers.tsx`, `use-alert-actions.tsx`,
`create-alert-button.tsx`), `src/lib/alerts/{condition-fields,alert-form,labels}.ts`, `src/lib/live/use-live-alerts.ts`.
`CLAUDE.md` → "Alerts (task 2)", "Alerts (task 4)" (pickers, entry points).

## Desired Behavior

Every check ticked or logged; 17 `walk-1122-<type>` alerts created (ids in `findings.md`), webhook.site received at
least one test event.

## Requirements

### 1. The form

- [ ] **T9.1** `/alerts/new`: type picker lists 17 types with summaries; changing type swaps the fields to
  `TYPE_FIELDS[type]` (`src/lib/alerts/condition-fields.ts`) with labels / help / enums / bounds; trigger fields
  (cooldown, max fires, expires, active window, rearm for price types, cooldown bars for script / indicator); delivery =
  destinations checklist (D1, D2, owner's own; ≤ 10; a disabled one says so) + "New destination…" (opens A3's dialog
  inline — open and cancel it); end-user field `AlertUserPicker` (free text + suggestions).
- [ ] **T9.2** Check (`validate_only`) on an empty form → field errors land on their fields (`condition.<field>`,
  `destination_ids`, …), not one generic toast. Check on a valid `price` form → "valid" result, nothing created (list
  count unchanged).

### 2. Create one of each type

For each row: fill the fields, pick **D1** only, `client_reference_id` = `walk-1122-<type>`, name / description
`walk-1122 <type>` if the form has one, then Create (once). Expect the alert page `/alerts/$id` with status `active`
(or the API's stated state) and a summary that matches what was entered. Record each id. A 400 → its field error shown
on the right field (then correct and retry); a 404 `not_covered` → readable notice (choose another company).

| Check | Type | Suggested condition (adapt to the form) |
| --- | --- | --- |
| **T9.3** | `price` | AAPL, stock, operator above, level = current × 2 |
| **T9.4** | `price_move` | AAPL, direction either, pct 8, baseline previous close |
| **T9.5** | `price_reminder` | AAPL, frequency weekly, weekday Mon, time 09:00, timezone America/New_York |
| **T9.6** | `volume_spike` | NVDA, interval 1d, mode multiple, multiple 5, lookback 20 |
| **T9.7** | `indicator` | AAPL, interval 1d, a template from the picker (e.g. RSI cross) with defaults |
| **T9.8** | `halt` | AAPL, statuses halted |
| **T9.9** | `dividend` | AAPL, kinds declared |
| **T9.10** | `earnings_call` | AAPL, events started / transcript ready |
| **T9.11** | `earnings_call_keyword` | NVDA, keywords `walk1122 sovereign AI`, scope any |
| **T9.12** | `earnings_results` | AAPL, report kinds 10-Q, a yoy rule revenue > 50 % |
| **T9.13** | `event_countdown` | AAPL, event next earnings call, days before 1, time 08:00 |
| **T9.14** | `filing` | AAPL, form types 8-K, include amendments off |
| **T9.15** | `filing_keyword` | AAPL, form 10-K, keywords `walk1122 going concern` |
| **T9.16** | `fundamental_metric` | AAPL, a rule on a metric (picker) crossing an unreachable value |
| **T9.17** | `news` | AAPL, kinds earnings |
| **T9.18** | `news_keyword` | MSFT, keywords `walk1122 acquisition` |
| **T9.19** | `script` | **deferred to Task 10** (needs an uploaded script version) — mark `[~] see T10.x` |

- [ ] **T9.20** ETF refusal: a `news` alert on `SPY` → the API's 400 naming the ETF shown on the symbol field; a
  `dividend` alert on `SPY` would be accepted — do not create it.
- [ ] **T9.21** Pre-fill: `/alerts/new?type=filing&symbol=MSFT` opens with type + symbol filled; cancel.

### 3. List `/alerts`

- [ ] **T9.22** 16 new rows (+ start count); quota line from `meta.quota`; filters `?status=&type=&symbol=AAPL
  &destination_id=<D1>&client_reference_id=walk-1122-price` each sent to the API and narrowing; export.
- [ ] **T9.23** Destination chips link `/alerts/destinations/$id`; D1's detail page now lists the alerts using it.

### 4. One alert's page and actions (use `walk-1122-price`)

- [ ] **T9.24** `/alerts/$id`: summary, condition, trigger, delivery, version, events list (empty state). Pause (runs at
  once) → status paused; Resume → active.
- [ ] **T9.25** "Send test event" → confirm (REAL delivery) → success notice linking `/alerts/events?event=`; receiver
  tab shows the alert event POST with signature headers; the event page `SingleEventView` renders it.
- [ ] **T9.26** Edit `?edit=true`: change level, save → version + 1. Conflict: open the same alert in a second tab
  (`preview_start`) in edit, save a change in tab A, then save in tab B → 409 → "changed elsewhere" + Reload, which
  loads the new version; nothing overwritten silently. Close tab B.
- [ ] **T9.27** Edit: empty a reference field (`client_reference_id`) → sent as null; then set it back to
  `walk-1122-price` (Task 10 finds alerts by the marker).
- [ ] **T9.28** Duplicate (`/alerts/new?from=<id>`) → form filled without the client reference id; set
  `walk-1122-dup`, create.
- [ ] **T9.29** Delete the duplicate from its page → confirm → back to the list, row gone. Unknown id
  `/alerts/alt_doesnotexist` → 404 state.

### 5. Bulk

- [ ] **T9.30** Select 3 walk alerts → bulk Pause → confirm (count + ids) → per-item results (`BatchResultsView`);
  bulk Resume → results. Select one already-active + the 3 → bulk Pause again → results show each item's outcome.
  Bulk Delete is exercised in Task 10.

### 6. Events

- [ ] **T9.31** `/alerts/events`: loaded newest first with "how far they reach" line; filters `?alert_id=&type=
  &external_user_id=`; the test event from T9.25 listed; `?event=` opens the single event.
- [ ] **T9.32** Live on (`?live=true`): connected; send another test event from the price alert (confirm) → it arrives
  on top with "New" + 4-s highlight without reload. Live off.

### 7. Entry points on ticker pages

- [ ] **T9.33** `/AAPL`: "N alerts on AAPL" shows the walk count (cached 5 min — reload after a minute if stale; a stale
  count within 5 min is by design); link → `/alerts?symbol=AAPL`. Create alert menu item → `/alerts/new?type=…
  &symbol=AAPL`.
- [ ] **T9.34** Menus on calls list, call page, news, filings, dividends offer exactly the types in `CLAUDE.md`
  (Alerts task 4 "Entry points"); `/SPY` offers only `NON_STOCK_ALERT_TYPES`.

### 8. Deliveries side effects

- [ ] **T9.35** D1 deliveries list now has the alert test events (`succeeded`); D2 has its failing test with retries
  (`consecutive_failures` > 0, maybe `disabled` after enough failures — record what the API did).

## Files to Create / Modify

| File | Action | Purpose |
| --- | --- | --- |
| `tasks/ui-walk-2026-11-22/findings.md` | Modify | Alert ids, findings |
| this task file | Modify | Ticks, status |
| `src/routes/alerts/**`, `src/components/alerts/**`, `src/lib/alerts/**`, `src/lib/live/use-live-alerts.ts`, tests (`alerts-{list,form,events}.test.tsx`, `alert-entry-points.test.tsx`) | Modify | Dashboard fixes only |

## Acceptance Criteria

- 16 alert types created through the UI (script in Task 10), ids recorded; the duplicate deleted.
- Version conflict surfaced as "changed elsewhere" (never a silent overwrite); bulk results per item.
- Test events arrived at webhook.site and live in the feed.
- T9.1–T9.35 ticked / `[~]` / logged with outcome; fixes committed with tests; check + test green.
