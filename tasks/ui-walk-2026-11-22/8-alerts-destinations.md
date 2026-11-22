# Task 8 — Alerts I: destinations, deliveries, webhook reference

> **Status: TODO**

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

- [ ] **T8.1** `preview_start` `https://webhook.site` → **receiver tab**. Approve the site if asked (wait for the
  owner). Read the unique URL (`https://webhook.site/<uuid>`) with `get_page_text`; record it in `findings.md` start
  state as "Receiver URL" (it is not a secret). If webhook.site is refused / blocked, stop and ask the owner (GUIDE §11).

### 2. Create

- [ ] **T8.2** `/alerts/destinations`: list with the recorded start count; empty state wording if 0.
- [ ] **T8.3** "New destination" → `?new=true` dialog. Submit empty → field errors inline (URL required, https only).
  `http://example.com` → refused (https only) client-side or with the API's 400 on the URL field.
- [ ] **T8.4** Create **D1**: kind `webhook`, preset `standard`, URL = receiver URL, description `walk-1122
  webhook.site`, one header `X-Walk: one` (value field is `type="password"`, `autocomplete="new-password"`; check with
  `read_page`), `max_events_per_minute` 30. Submit once.
  Expect: `SecretOnceDialog` with the secret, Copy, "You will not see this secret again". **Do not copy the secret
  into any file or message**; note only that it was shown (and its `whsec_`-style prefix if any).
- [ ] **T8.5** Close the dialog without copying → it asks first; confirm. Then the new destination's page opens.
  Verify the secret is gone: `get_page_text` of the page has no secret, `javascript_tool`
  `Object.keys(localStorage)` / `sessionStorage` keys contain nothing secret-like, the URL has no secret, the API sheet
  (create request body + answer) shows the secret / header value as redacted. Any leak = blocker.
- [ ] **T8.6** Double-submit protection: create **D2** (`batch_webhook` if offered, URL `https://walk-1122.invalid/hook`,
  description `walk-1122 unroutable`, `digest_seconds` 60) and click Create twice quickly → ONE destination created
  (list shows one D2; the second click is disabled or reuses the same `Idempotency-Key`). Close its secret dialog.
- [ ] **T8.7** List shows D1 and D2 with kind / preset, URL, status `active`, header names (never values).

### 3. Detail page `/alerts/destinations/$id` (D1)

- [ ] **T8.8** Summary: id + copy, kind, preset, URL, description, status, secret hint, header names `X-Walk`, limits,
  created / updated; "Alerts using it" (none yet); deliveries list (empty state).
- [ ] **T8.9** "Send test delivery" → confirm dialog naming the effect (a REAL delivery) → `?test=<dlv_…>`; the notice
  polls every 2 s ≤ 30 s and shows `succeeded` (or says it stopped watching). In the receiver tab: a POST arrived with
  headers `webhook-id`, `webhook-timestamp`, `webhook-signature` and `X-Walk: one`; body is the test envelope (compare
  with `/alerts/webhooks` envelope fields). Record delivery id only.
- [ ] **T8.10** Deliveries list: the test row (status badge with tooltip, attempts, duration, delivered at);
  `?status=` filter over the loaded rows.

### 4. Edit, headers, rotate, disable

- [ ] **T8.11** `?edit=true`: change description to `walk-1122 webhook.site edited`, headers **Keep** (default) → save;
  header names still `X-Walk`. Send another test (confirm) → receiver shows `X-Walk: one` still.
- [ ] **T8.12** Edit headers **Replace** with `X-Walk: two` → save → test → receiver shows `X-Walk: two` (and no
  `one`). Edit headers **Remove** → save → header names empty → test → no `X-Walk` header at webhook.site. (3 tests
  total in this check is fine.)
- [ ] **T8.13** After each save, re-open edit: the header value fields are empty (never read back).
- [ ] **T8.14** Rotate secret → confirm names the 24 h dual signature → secret dialog once (same leak checks as T8.5,
  briefly) → `previous_secret_expires_at` shown on the page.
- [ ] **T8.15** Disable → confirm → status `disabled` with reason; "Send test delivery" disabled or refused with a
  readable notice. Re-enable → confirm → `active`.
- [ ] **T8.16** D2 detail: send a test (confirm) → delivery `failed` / pending with retries (`next_attempt_at`,
  `last_error` readable); after a few attempts the list shows the retries. `consecutive_failures` grows (reload later in
  Task 9 to see it). Do NOT expect success.
- [ ] **T8.17** List row actions (rotate / test / disable / delete) each open their confirm; cancel each (no effect).

### 5. Webhook reference `/alerts/webhooks`

- [ ] **T8.18** Every webhook type of the spec listed with its example body built from the schema (labelled as an
  example shape), the envelope, signature headers text and retry text from the spec. Compare the test delivery body seen
  at webhook.site with the envelope: a field mismatch is an `api` (or `doc`) finding.

### 6. Edge states

- [ ] **T8.19** Unknown destination id `/alerts/destinations/dst_doesnotexist` → `AlertsState` 404 in the page's words.
- [ ] **T8.20** Validation from the API: create with `max_events_per_minute` above the spec bound (type it) → field
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
