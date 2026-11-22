# Task 10 — Alerts III: end users, defaults, scripts, templates, script alert; then cleanup

> **Status: TODO**

## Goal

Exercise end users (add, edit, odd ids, bulk upsert JSON + CSV, pause / resume / delete), the account's end-user
defaults, scripts (upload with a compile error, a compiled version, the version view, delete conflict), templates and
a `script` alert — then delete every `walk-1122` resource and prove the lists are back to the Task 1 start state.

## Prerequisites

Tasks 8–9 (D1 / D2, the walk alerts).

## Current Behavior

`src/routes/alerts/users/{index,$externalUserId}.tsx`, `src/routes/alerts/scripts/{index,$id}.tsx`,
`src/components/alerts/` (`AlertUserEditDialog`, `AlertUserBatchDialog`, `alert-user-defaults.tsx`,
`ScriptUploadDialog`, `ScriptSourceView`, `TemplateListView`, `ScriptDeleteConflict`), `src/lib/alerts/{alert-users,
scripts}.ts`. `CLAUDE.md` → "Alerts (task 4)".

## Desired Behavior

Every check ticked or logged; at the end no `walk-1122` resource exists and every list count equals the start state.

## Requirements

### 1. End users

- [ ] **T10.1** `/alerts/users`: list (start count), filters `?status=&q=` (prefix, sent), usage bars against effective
  limits ("· default" marks), last fired. Empty-state wording if 0.
- [ ] **T10.2** "Add end user" `walk-1122-a`, display name `Walk A`, active-alert limit 5, metadata `{"walk":"1122"}`
  → created; row shows own limit vs defaults. Edit → empty the limit → saved as null → "· default" shown.
- [ ] **T10.3** Odd id `walk-1122/odd:id x` (slash, colon, space — do not trim): created; its row links
  `/alerts/users/walk-1122%2Fodd%3Aid%20x`; the page opens and shows the exact id; Pause / Resume on it work (the
  `:pause` verb stays a verb: API sheet path `…/walk-1122%2Fodd%3Aid%20x:pause`).
- [ ] **T10.4** Ids `.` / `..`: the add dialog refuses them for the per-user operations (inline); if any exist in the
  list they show as text without actions.
- [ ] **T10.5** Bulk upsert, JSON: paste
  `[{"external_user_id":"walk-1122-b","display_name":"Walk B"},{"external_user_id":"walk-1122-b","display_name":"dup"}]`
  → preview reports the repeated id, Send disabled. Fix to two distinct ids (`walk-1122-b`, `walk-1122-c`) → preview
  clean, "1 request" → Send → per-item results.
- [ ] **T10.6** Bulk upsert, CSV: header + rows with an empty cell (= not set) and `null` (= null); an unclosed quote is
  refused. Upsert `walk-1122-c` with a new display name → result `updated`.
- [ ] **T10.7** `/alerts/users/walk-1122-a`: profile + metadata `JsonTree`, each limit own vs effective + origin text,
  usage, the user's alerts (none) and events (none).
- [ ] **T10.8** Attach: edit one walk alert (`walk-1122-news`) to end user `walk-1122-a` via the picker (suggestions
  appear after typing `walk` and resting 300 ms) → the user page now lists it and usage counts 1.
- [ ] **T10.9** Pause `walk-1122-a` → confirm names its active alerts → the user's alert shows paused-by-user state (as
  the API reports); Resume → confirm.

### 2. End-user defaults

- [ ] **T10.10** `/alerts/users#defaults` (also linked from `/account`): record current defaults; "Edit defaults"
  change one limit → PATCH sends the changed field only (API sheet body) → saved; the users list's "· default" values
  follow. **Restore the original value** right after (and verify).

### 3. Templates

- [ ] **T10.11** `/alerts/scripts?tab=templates`: key, version, fidelity with meaning, inputs with defaults and bounds,
  source; "Use template" → `/alerts/new?type=indicator&template=…` pre-filled; cancel.

### 4. Scripts

Use this source (the spec's `createScript` example):

```ts
import { defineIndicator, input } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "EMA cross",
    apiVersion: 1,
    overlay: true,
    inputs: { fast: input.int(9, { min: 1, max: 200 }), slow: input.int(21, { min: 2, max: 500 }) },
    compute({ bar, ta, alert, inputs }) {
        const fast = ta.ema(bar.close, inputs.fast);
        const slow = ta.ema(bar.close, inputs.slow);
        if (ta.crossover(fast, slow).current) alert("EMA cross up at " + bar.close);
    }
});
```

- [ ] **T10.12** "Upload script" with name `walk-1122 EMA cross`, the source with `ta.ema` on line 9 changed to
  `ta.emaa` (compile error) → uploaded (a compile error is still an upload); `/alerts/scripts/$id` shows version 1
  status error, diagnostics linking `#script-L9`, the source view with the marked line + caret; the box scrolls
  sideways, never the page.
- [ ] **T10.13** "Upload new version" with the correct source → version 2 compiled (`ok`): compiler, SHA-256, id,
  declared inputs (fast, slow with bounds), "Alert condition ids" (`alert_ids`). `?version=` switches between them.
- [ ] **T10.14** A source above 204 800 characters is refused before sending (generate it with `javascript_tool` into
  the textarea: `"//x\n".repeat(52000)`); no request in the API sheet. Cancel.
- [ ] **T10.15** "Create alert from this version" (only on the `ok` version) → `/alerts/new?type=script&script=&version=`
  pre-filled; script picker shows the script and its compiled versions; inputs as fields (fast 12) → `condition.inputs`;
  symbol AAPL, interval 1d, D1, `client_reference_id` `walk-1122-script` → created (**T9.19** done here).
- [ ] **T10.16** Delete the script → confirm → 409 (an alert uses it) → `ScriptDeleteConflict` with the API's detail and
  the `alt_…` id linked to `walk-1122-script`'s page.

### 5. Cleanup (in this order; every delete confirms first)

- [ ] **T10.17** `/alerts?client_reference_id=` cannot match a prefix: use `?symbol=` + type filters or the full list,
  select every alert whose reference id starts with `walk-1122` (≈ 17) → bulk Delete → confirm (count + ids) →
  per-item results all deleted. Re-list: none left. Never select an alert without the marker.
- [ ] **T10.18** Delete the script `walk-1122 EMA cross` (now no alert uses it) → gone from the list.
- [ ] **T10.19** Delete end users `walk-1122-a`, `walk-1122-b`, `walk-1122-c`, `walk-1122/odd:id x` (row action,
  confirm) → `AlertUserDeleteResult` counts shown; a `deleting` status stays listed until done — reload until gone.
- [ ] **T10.20** Delete D1 and D2 → the confirm lists the alerts using it (none now: "0") → gone.
- [ ] **T10.21** Leftovers from an earlier aborted walk recorded in Task 1 → deleted the same way.
- [ ] **T10.22** Compare with the start state: alerts, destinations, alert users, scripts counts equal; defaults equal
  the recorded values. Write the end counts next to the start counts in `findings.md`. A mismatch you cannot explain →
  stop and tell the owner.
- [ ] **T10.23** Close the receiver tab (webhook.site URLs expire on their own; nothing to delete there).

## Files to Create / Modify

| File | Action | Purpose |
| --- | --- | --- |
| `tasks/ui-walk-2026-11-22/findings.md` | Modify | End counts, findings |
| this task file | Modify | Ticks, status |
| `src/routes/alerts/**`, `src/components/alerts/**`, `src/lib/alerts/**`, tests (`alert-users-pages`, `scripts-pages`) | Modify | Dashboard fixes only |

## Acceptance Criteria

- End users (incl. the odd id), defaults (restored), templates, scripts (error + ok version, conflict) and a script
  alert exercised through the UI.
- No `walk-1122` resource remains; end counts = start counts; defaults restored.
- T10.1–T10.23 ticked / `[~]` / logged with outcome; fixes committed with tests; check + test green.
