# Task 8 — Alerts I: destinations, deliveries, webhook reference

> **Status: DONE (walked 2026-11-22, 5 findings)**

## Goal

Create two real destinations through the UI (a webhook.site receiver and an unroutable URL), exercise every
destination action (edit incl. headers keep / replace / remove, test delivery, rotate secret, disable / re-enable),
verify real deliveries arrive at webhook.site with their signature headers, verify the secret rules, and walk the
webhook reference page. The destinations stay for Tasks 9–10 and are deleted in Task 10.

## Prerequisites

Task 1 (start counts recorded). The alerts section is reachable (ENTERPRISE: `me.allowed_families` holds "Alerts" —
a plan gate on `/alerts` is a blocker finding).

## Current Behavior

`src/routes/alerts/destinations/{index,$id}.tsx`, `src/routes/alerts/webhooks.tsx`, `src/components/alerts/`
(`DestinationsListView`, `DestinationFormView`, `DestinationDetailView`, `DeliveriesView`, `SecretOnceDialog`,
`destination-editor.tsx`, `use-destination-actions.tsx`), `src/lib/alerts/destinations.ts`. `CLAUDE.md` →
"Destinations, deliveries, webhooks". Contract: kinds `webhook | batch_webhook`, presets `standard | claude_routine`,
delivery statuses `pending | in_flight | succeeded | failed | dead`, signature headers `webhook-id`,
`webhook-timestamp`, `webhook-signature`.

## Desired Behavior

Every check ticked or logged; two `walk-1122` destinations exist; webhook.site received ≥ 2 deliveries.

## Requirements

### 1. Receiver

- [x] **T8.1** (receiver `https://webhook.site/15b38b45-5955-46f6-9b5b-e0d51cd37736`, tab opened without a prompt) `preview_start` `https://webhook.site` → **receiver tab**. Approve the site if asked (wait for the
  owner). Read the unique URL (`https://webhook.site/<uuid>`) with `get_page_text`; record it in `findings.md` start
  state as "Receiver URL" (it is not a secret). If webhook.site is refused / blocked, stop and ask the owner (GUIDE §11).

### 2. Create

- [x] **T8.2** `/alerts/destinations`: list with the recorded start count; empty state wording if 0.
- [x] **T8.3** (empty → "Enter the https URL of your endpoint."; `http://example.com` → "The URL must start with https://" client-side) "New destination" → `?new=true` dialog. Submit empty → field errors inline (URL required, https only).
  `http://example.com` → refused (https only) client-side or with the API's 400 on the URL field.
- [x] **T8.4** (D1 `dst_01M81YNF4DP3558D13RN0KPJGP`; header value `type=password`, `autocomplete=new-password`; secret shown once, `whsec_` prefix, 50 characters) Create **D1**: kind `webhook`, preset `standard`, URL = receiver URL, description `walk-1122
  webhook.site`, one header `X-Walk: one` (value field is `type="password"`, `autocomplete="new-password"`; check with
  `read_page`), `max_events_per_minute` 30. Submit once.
  Expect: `SecretOnceDialog` with the secret, Copy, "You will not see this secret again". **Do not copy the secret
  into any file or message**; note only that it was shown (and its `whsec_`-style prefix if any).
- [x] **T8.5** (close asks "Close without copying?"; page / DOM / storage keys / URL / API sheet: no full secret, the header value `[redacted]` in the curl body; null fields shown as `[redacted]`: F103) Close the dialog without copying → it asks first; confirm. Then the new destination's page opens.
  Verify the secret is gone: `get_page_text` of the page has no secret, `javascript_tool`
  `Object.keys(localStorage)` / `sessionStorage` keys contain nothing secret-like, the URL has no secret, the API sheet
  (create request body + answer) shows the secret / header value as redacted. Any leak = blocker.
- [x] **T8.6** (the task's `https://walk-1122.invalid/hook` is refused by the API, "url: host name does not resolve" — F106; D2 = `https://example.com/walk-1122-hook` (answers 405), `dst_01M81YTP4DH99DFBR9AD4Z1BT7`; double click → one D2) Double-submit protection: create **D2** (`batch_webhook` if offered, URL `https://walk-1122.invalid/hook`,
  description `walk-1122 unroutable`, `digest_seconds` 60) and click Create twice quickly → ONE destination created
  (list shows one D2; the second click is disabled or reuses the same `Idempotency-Key`). Close its secret dialog.
- [x] **T8.7** (no header column: F105, fixed) List shows D1 and D2 with kind / preset, URL, status `active`, header names (never values).

### 3. Detail page `/alerts/destinations/$id` (D1)

- [x] **T8.8** Summary: id + copy, kind, preset, URL, description, status, secret hint, header names `X-Walk`, limits,
  created / updated; "Alerts using it" (none yet); deliveries list (empty state).
- [x] **T8.9** (dlv_01M81YWWVFV3JBD39TJQ7ZFJEN succeeded HTTP 200; webhook.site: `webhook-id` = the event id, `webhook-timestamp`, `webhook-signature` `v1,…`, `x-walk: one`, body type / timestamp / data) "Send test delivery" → confirm dialog naming the effect (a REAL delivery) → `?test=<dlv_…>`; the notice
  polls every 2 s ≤ 30 s and shows `succeeded` (or says it stopped watching). In the receiver tab: a POST arrived with
  headers `webhook-id`, `webhook-timestamp`, `webhook-signature` and `X-Walk: one`; body is the test envelope (compare
  with `/alerts/webhooks` envelope fields). Record delivery id only.
- [x] **T8.10** (tooltip "Your endpoint acknowledged it with a 2xx."; `?status=failed` "0 of the 1 loaded deliveries") Deliveries list: the test row (status badge with tooltip, attempts, duration, delivered at);
  `?status=` filter over the loaded rows.

### 4. Edit, headers, rotate, disable

- [x] **T8.11** (PATCH sent only `description`; test → `x-walk: one`) `?edit=true`: change description to `walk-1122 webhook.site edited`, headers **Keep** (default) → save;
  header names still `X-Walk`. Send another test (confirm) → receiver shows `X-Walk: one` still.
- [x] **T8.12** (replace → `x-walk: two`; remove → "None", no `x-walk` header; a second test within a minute → 429 toast "One test per destination and minute") Edit headers **Replace** with `X-Walk: two` → save → test → receiver shows `X-Walk: two` (and no
  `one`). Edit headers **Remove** → save → header names empty → test → no `X-Walk` header at webhook.site. (3 tests
  total in this check is fine.)
- [x] **T8.13** After each save, re-open edit: the header value fields are empty (never read back).
- [x] **T8.14** (confirm names the 24 h dual signature; secret once; "Previous secret · Still signs until Nov 23, 2026, 4:52 PM"; the next delivery carried two `v1,` signatures; CLI line lacked the id: F104) Rotate secret → confirm names the 24 h dual signature → secret dialog once (same leak checks as T8.5,
  briefly) → `previous_secret_expires_at` shown on the page.
- [x] **T8.15** ("Disabled by you (status set to disabled)", Send test disabled; re-enable resets the failure counter) Disable → confirm → status `disabled` with reason; "Send test delivery" disabled or refused with a
  readable notice. Re-enable → confirm → `active`.
- [x] **T8.16** (batch webhook: pending through the 60 s digest — the notice stopped watching after 30 s and said so —, then `failed`, 2 attempts, HTTP 405, next attempt set, failures in a row 2 → 3; `last_error` reads the code `http_status`: F107) D2 detail: send a test (confirm) → delivery `failed` / pending with retries (`next_attempt_at`,
  `last_error` readable); after a few attempts the list shows the retries. `consecutive_failures` grows (reload later in
  Task 9 to see it). Do NOT expect success.
- [x] **T8.17** (test / rotate / disable / delete each confirm; cancelled, nothing changed) List row actions (rotate / test / disable / delete) each open their confirm; cancel each (no effect).

### 5. Webhook reference `/alerts/webhooks`

- [x] **T8.18** (7 types, envelope, headers, 2XX text; the received test body matches `destination.test`) Every webhook type of the spec listed with its example body built from the schema (labelled as an
  example shape), the envelope, signature headers text and retry text from the spec. Compare the test delivery body seen
  at webhook.site with the envelope: a field mismatch is an `api` (or `doc`) finding.

### 6. Edge states

- [x] **T8.19** ("No destination dst_doesnotexist on this account.") Unknown destination id `/alerts/destinations/dst_doesnotexist` → `AlertsState` 404 in the page's words.
- [x] **T8.20** (100001 refused client-side "From 1 to 100,000." under the field; dialog open, nothing created) Validation from the API: create with `max_events_per_minute` above the spec bound (type it) → field
  error on that field (`problemFieldErrors`), dialog stays open, nothing created. Cancel.

## Files to Create / Modify

| File | Action | Purpose |
| --- | --- | --- |
| `tasks/ui-walk-2026-11-22/findings.md` | Modify | Receiver URL, D1 / D2 ids, findings |
| this task file | Modify | Ticks, status |
| `src/routes/alerts/**`, `src/components/alerts/**`, `src/lib/alerts/destinations.ts`, tests (`destinations-{views,secret}.test.tsx`) | Modify | Dashboard fixes only |

## Acceptance Criteria

- D1 (webhook.site) and D2 (unroutable) exist, ids recorded in `findings.md`, both `active`.
- webhook.site received the test deliveries with the three signature headers; header keep / replace / remove behaved.
- No secret or header value persisted anywhere observable (T8.5, T8.14) — stated explicitly in the summary.
- T8.1–T8.20 ticked / `[~]` / logged with outcome; fixes committed with tests; check + test green.
