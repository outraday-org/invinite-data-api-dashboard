# Task 10 — Alerts III: end users, defaults, scripts, templates, script alert; then cleanup

> **Status: DONE (walked 2026-11-22, 2 findings)**

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

- [x] **T10.1** (start 0, empty-state text; `?status=active&q=walk-1122-` sent as `/v1/alert-users?limit=100&q=walk-1122-&status=active`, prefix kept the odd id out; "· default" marks seen in T10.10) `/alerts/users`: list (start count), filters `?status=&q=` (prefix, sent), usage bars against effective
  limits ("· default" marks), last fired. Empty-state wording if 0.
- [x] **T10.2** (created with own limit "0 of 5"; edit emptied it → PATCH sent `max_active_alerts: null` → "(no limit)") "Add end user" `walk-1122-a`, display name `Walk A`, active-alert limit 5, metadata `{"walk":"1122"}`
  → created; row shows own limit vs defaults. Edit → empty the limit → saved as null → "· default" shown.
- [x] **T10.3** (an id alone is refused in the add dialog — "Fill in at least one field", the API wants one —, so display name `Walk odd`; link `/alerts/users/walk-1122%2Fodd%3Aid%20x`, page shows the exact id; `POST …/walk-1122%2Fodd%3Aid%20x:pause` / `:resume`) Odd id `walk-1122/odd:id x` (slash, colon, space — do not trim): created; its row links
  `/alerts/users/walk-1122%2Fodd%3Aid%20x`; the page opens and shows the exact id; Pause / Resume on it work (the
  `:pause` verb stays a verb: API sheet path `…/walk-1122%2Fodd%3Aid%20x:pause`).
- [x] **T10.4** (`.` and `..` refused inline: "cannot be put into a URL path …"; none in the list) Ids `.` / `..`: the add dialog refuses them for the per-user operations (inline); if any exist in the
  list they show as text without actions.
- [x] **T10.5** (duplicate → "Item 2: The id walk-1122-b is given twice (item 1)", Send disabled; fixed → "2 end users to create or update" — the request count is named only beyond 500 —, "2 of 2 done", both Created) Bulk upsert, JSON: paste
  `[{"external_user_id":"walk-1122-b","display_name":"Walk B"},{"external_user_id":"walk-1122-b","display_name":"dup"}]`
  → preview reports the repeated id, Send disabled. Fix to two distinct ids (`walk-1122-b`, `walk-1122-c`) → preview
  clean, "1 request" → Send → per-item results.
- [x] **T10.6** (unclosed quote → "A double quote is never closed …"; `walk-1122-c,"Walk C, csv",,null,,` → Updated) Bulk upsert, CSV: header + rows with an empty cell (= not set) and `null` (= null); an unclosed quote is
  refused. Upsert `walk-1122-c` with a new display name → result `updated`.
- [x] **T10.7** (profile, metadata tree `walk: "1122"`, limit origin "Not set, and the account default sets none", usage, alerts / events empty; the embedded list showed the account quota line and "No alert matches these filters.": F117) `/alerts/users/walk-1122-a`: profile + metadata `JsonTree`, each limit own vs effective + origin text,
  usage, the user's alerts (none) and events (none).
- [x] **T10.8** (datalist offered the 4 walk ids after typing `walk`; saved v2; the user page listed walk-1122-news, usage 1) Attach: edit one walk alert (`walk-1122-news`) to end user `walk-1122-a` via the picker (suggestions
  appear after typing `walk` and resting 300 ms) → the user page now lists it and usage counts 1.
- [x] **T10.9** (confirm "Pauses deliveries of the end user's 1 alert …"; the alert showed Paused; Resume → Active) Pause `walk-1122-a` → confirm names its active alerts → the user's alert shows paused-by-user state (as
  the API reports); Resume → confirm.

### 2. End-user defaults

- [x] **T10.10** (start: all No limit; Active alerts 50 → PATCH body `{"max_active_alerts":50}`, list "0 of 50 · default"; restored to empty = No limit right after and verified; the line now reads "Last changed …" instead of "Never set") `/alerts/users#defaults` (also linked from `/account`): record current defaults; "Edit defaults"
  change one limit → PATCH sends the changed field only (API sheet body) → saved; the users list's "· default" values
  follow. **Restore the original value** right after (and verify).

### 3. Templates

- [x] **T10.11** (4 templates with fidelity lossy + meaning, inputs, source; Use template → `/alerts/new?template=rsi-cross&type=indicator`, template picked) `/alerts/scripts?tab=templates`: key, version, fidelity with meaning, inputs with defaults and bounds,
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

- [x] **T10.12** (scr_01M821Y86MGC60D5BK539QSB6H; v1 Compile error, diagnostic `9:25` → `#script-L9`, caret under the line; the source box scrolls sideways, the page does not) "Upload script" with name `walk-1122 EMA cross`, the source with `ta.ema` on line 9 changed to
  `ta.emaa` (compile error) → uploaded (a compile error is still an upload); `/alerts/scripts/$id` shows version 1
  status error, diagnostics linking `#script-L9`, the source view with the marked line + caret; the box scrolls
  sideways, never the page.
- [x] **T10.13** (v2 Compiled: compiler 1.16.1, SHA-256, scv_01M8221Q4T9D6085XEMPKERS0Y, inputs fast 9 1–200 / slow 21 2–500, alert ids `script.chart.ts:11:47#0`; `?version=1` / `2` switch) "Upload new version" with the correct source → version 2 compiled (`ok`): compiler, SHA-256, id,
  declared inputs (fast, slow with bounds), "Alert condition ids" (`alert_ids`). `?version=` switches between them.
- [x] **T10.14** (208,000 characters: size line red, Upload → "The source has 208,001 characters; at most 204,800 can be uploaded.", still 1 version, nothing sent; the source box had grown to 1,014,037 px: F116) A source above 204 800 characters is refused before sending (generate it with `javascript_tool` into
  the textarea: `"//x\n".repeat(52000)`); no request in the API sheet. Cancel.
- [x] **T10.15** (form pre-filled, script + version pickers list the script and only its compiled v2; fast 12 → `{"fast": 12}`; AAPL, 1d, D1 → alt_01M82253PRF3VASSBVQ99PHV9Y `walk-1122-script`) "Create alert from this version" (only on the `ok` version) → `/alerts/new?type=script&script=&version=`
  pre-filled; script picker shows the script and its compiled versions; inputs as fields (fast 12) → `condition.inputs`;
  symbol AAPL, interval 1d, D1, `client_reference_id` `walk-1122-script` → created (**T9.19** done here).
- [x] **T10.16** ("In use · The script is used by alert alt_01M82253PRF3VASSBVQ99PHV9Y.", the id linked to its page) Delete the script → confirm → 409 (an alert uses it) → `ScriptDeleteConflict` with the API's detail and
  the `alt_…` id linked to `walk-1122-script`'s page.

### 5. Cleanup (in this order; every delete confirms first)

- [x] **T10.17** (the full list held exactly the 17 walk alerts; select all → "Delete 17 alerts?" with the ids → "17 of 17 done", each Deleted; list empty, quota 0) `/alerts?client_reference_id=` cannot match a prefix: use `?symbol=` + type filters or the full list,
  select every alert whose reference id starts with `walk-1122` (≈ 17) → bulk Delete → confirm (count + ids) →
  per-item results all deleted. Re-list: none left. Never select an alert without the marker.
- [x] **T10.18** (confirm "Deletes the script and its 2 versions" → back on the empty list) Delete the script `walk-1122 EMA cross` (now no alert uses it) → gone from the list.
- [x] **T10.19** (each confirm named the id; "Deleted: 0 alerts, 0 events and 0 deliveries removed"; no `deleting` state seen — gone at once) Delete end users `walk-1122-a`, `walk-1122-b`, `walk-1122-c`, `walk-1122/odd:id x` (row action,
  confirm) → `AlertUserDeleteResult` counts shown; a `deleting` status stays listed until done — reload until gone.
- [x] **T10.20** (each confirm "No alert delivers here." → list empty) Delete D1 and D2 → the confirm lists the alerts using it (none now: "0") → gone.
- [~] **T10.21** (Task 1 recorded no leftovers: 0 alerts / destinations / end users / scripts at the start) Leftovers from an earlier aborted walk recorded in Task 1 → deleted the same way.
- [x] **T10.22** (alerts 0 / destinations 0 / end users 0 / scripts 0; defaults all No limit; recorded in findings.md) Compare with the start state: alerts, destinations, alert users, scripts counts equal; defaults equal
  the recorded values. Write the end counts next to the start counts in `findings.md`. A mismatch you cannot explain →
  stop and tell the owner.
- [x] **T10.23** (tab-5 closed) Close the receiver tab (webhook.site URLs expire on their own; nothing to delete there).

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
