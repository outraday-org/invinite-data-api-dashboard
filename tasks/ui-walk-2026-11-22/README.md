# UI walk 2026-11-22: the whole dashboard, driven by an LLM in the built-in browser

An LLM-only end-to-end walk through every page, flow and write of the Invinite Data API dashboard, run in the
**built-in browser of the Claude desktop app** (`mcp__Claude_Browser__*` tools) against the local dev server
(`pnpm run dev`, `http://localhost:3001`) and the **production Data API** with an **ENTERPRISE** key. Nothing is
mocked: every request is real, every alert / destination / end user / script is really created, exercised and deleted.

The walk has two outputs:

1. **Dashboard bugs are fixed during the walk** (code + co-located test + `pnpm run check` + `pnpm run test` +
   re-check in the browser + one commit per fix on the walk branch).
2. **Findings that need an API change are not fixed here.** They are logged and, in the last task, turned into a new
   tasklist in `../backend/tasks/old/X-data-api-ui-walk-findings-2026-11-22/` (where the earlier Data API test findings
   lived: `../backend/tasks/old/X-data-api-live-test-findings/`).

**How to run it:** read [`GUIDE.md`](./GUIDE.md) first (setup, the browser tools, the per-check procedure, the fix
rules, the findings format), then execute the tasks in number order. Log everything in
[`findings.md`](./findings.md).

## Current State

- No browser-level test exists. The dashboard has ~200 vitest suites (`src/**/*.test.ts(x)`), all against mocked
  answers and fixtures (`*-fixtures.ts`); the only real-API checks were ad-hoc (e.g. "checked against the live API
  2026-11-21" notes in `CLAUDE.md`).
- The app covers all 125 operations of the Data API 8.0 spec (`CLAUDE.md` → "Operation coverage"), including the
  first writes (alerts, destinations, alert users, scripts; `src/lib/api/mutations.ts` `WRITES`).
- Plan gates exist everywhere (`PlanBadge`, `RequestErrorState` plan gate, `plansAlerts`). With an ENTERPRISE key
  (`/v1/me` `plan: "enterprise"`, the top of `PLAN_ORDER`) **no gate may ever show**: every plan notice is a finding.
- Data is thin by design (a limited ticker universe, a high 13F floor). An empty list with complete coverage is not a
  finding; an empty list rendered wrongly, a missing coverage notice, or a crash is.

## Target State

- Every route of `src/routes/` (see the route map in `GUIDE.md` §8) was opened, its states looked at (loading, data,
  empty, error / notice), its filters / tabs / URL state exercised, its "API" inspector and export checked.
- Every alerts-family write was done once through the UI with a real effect, then undone: 2 destinations (one
  webhook.site, one unroutable), alerts of all 17 condition types, an edit with a version conflict, pause / resume /
  test / batch, end users (incl. an odd id with `/ : space`), defaults, a script with an error version and a compiled
  version, a script alert, then every created resource deleted and the lists back to the recorded start state.
- `findings.md` lists every finding with an id, its check id, severity, evidence and outcome (fixed in `<sha>` /
  API → backend tasklist / not reproducible / by design).
- The walk branch `ui-walk-2026-11-22` holds one commit per dashboard fix, `pnpm run check` and `pnpm run test` green
  at its tip; `CLAUDE.md` updated where a fix changed documented behaviour.
- `../backend/tasks/old/X-data-api-ui-walk-findings-2026-11-22/` exists when there is at least one API finding.

## Architecture Decisions

| Decision | Rationale |
| --- | --- |
| **Built-in browser, local dev, prod API** | Tests the current `main` with real data; HMR lets a fix be re-checked in seconds. The session must run in the Claude desktop app on this machine (prefix `mcp__Claude_Browser__`): a cloud session's browser cannot reach `localhost` (GUIDE §1). |
| **The owner types the key, never the walker** | The key goes into the onboarding card by the owner's hand; it persists in the built-in browser's profile (`localStorage` `invinite-data-api-key`). The key never appears in the transcript, a findings line, a commit or a screenshot description. The inspector's curl shows `$INVINITE_API_KEY` by design (check it does). |
| **Fix dashboard bugs in place; API bugs → backend tasklist** | Owner decision 2026-11-22. A fix that needs a contract change (a field the API does not send, a wrong status, a missing filter) is not worked around in the UI. |
| **One branch, one commit per fix, no push** | `ui-walk-2026-11-22` from `main`; each commit names its finding id. The owner merges. Keeps every fix reviewable and revertible. |
| **Create → exercise → delete, all with a `walk-1122` marker** | Prod enterprise account. Every created resource carries `walk-1122` in its name / description / `client_reference_id` / external user id, so task 10 can find and delete all of them and prove the start state is back. |
| **webhook.site as the receiver** | Owner decision 2026-11-22. Real deliveries (destination test, alert test event) are checked arriving with their signature headers. The payload is test data only; no secret is ever pasted there. |
| **Destinations before alerts** | An alert needs a destination id to deliver to; the alert form's picker and its "New destination…" dialog are tested against a real list. |
| **Thin data is not a finding** | See Current State. A finding is about how the UI renders what the API answered, or about the API answer itself being wrong / inconsistent with the spec. |
| **Check ids** | Every check in a task has an id (`T3.12`); a finding names it, so the backend tasklist and the commits can point back to the exact step. |

## Dependency Graph

```
GUIDE.md (read first) + findings.md (log)
  |
  v
Task 1  setup, key gate, shell, start-state inventory
  |
  v
Task 2  market + browse pages (global routes)
  |
  v
Task 3  stock instrument pages I (overview, financials, filings, filing detail)
  |
  v
Task 4  stock instrument pages II (ownership, corporate actions, news, documents)
  |
  v
Task 5  earnings: calls list, call page, player, transcript, live
  |
  v
Task 6  funds, ETN, filers, offerings, people
  |
  v
Task 7  cross-cutting: API inspector, export, URL state, phone width, dark mode, keyboard
  |
  v
Task 8  alerts I: destinations, deliveries, webhook reference (webhook.site)
  |
  v
Task 9  alerts II: create all 17 types, edit/conflict, actions, batch, events, entry points
  |
  v
Task 10 alerts III: end users, defaults, scripts, templates, script alert; then CLEANUP
  |
  v
Task 11 close-out: findings review, backend tasklist, CLAUDE.md, final checks
```

## Task Summary

| # | Title | Type | Dependencies | Est. Complexity |
| --- | --- | --- | --- | --- |
| 1 | [Setup, key gate, shell](./X-1-setup-key-gate-shell.md) | Walk | GUIDE | Medium |
| 2 | [Market and browse pages](./X-2-market-and-browse-pages.md) | Walk | 1 | High |
| 3 | [Stock pages I: overview, financials, filings](./X-3-stock-pages-financials-filings.md) | Walk | 1 | High |
| 4 | [Stock pages II: ownership, actions, news, documents](./X-4-stock-pages-ownership-news-documents.md) | Walk | 1 | High |
| 5 | [Earnings calls and the call page](./X-5-earnings-call-page.md) | Walk | 1 | High |
| 6 | [Funds, filers, offerings, people](./X-6-funds-filers-offerings-people.md) | Walk | 1 | Medium |
| 7 | [Cross-cutting: inspector, export, URL, layout](./X-7-cross-cutting.md) | Walk | 2–6 | Medium |
| 8 | [Alerts I: destinations and webhooks](./X-8-alerts-destinations.md) | Walk + writes | 1 | High |
| 9 | [Alerts II: alerts, actions, events](./X-9-alerts-create-and-act.md) | Walk + writes | 8 | High |
| 10 | [Alerts III: end users, scripts, cleanup](./X-10-alerts-users-scripts-cleanup.md) | Walk + writes | 9 | High |
| 11 | [Close-out](./X-11-close-out.md) | Docs | 1–10 | Medium |

## Code Reuse (where a fix goes)

A fix extends the shared piece, never forks it (`CLAUDE.md` → "Shared UI pieces"):

| Symptom | Fix in |
| --- | --- |
| A wrong / missing request-state notice | `src/components/ui/request-error-state.tsx` (`RequestErrorState`, presets `PeopleState`, `MediaState`), `src/components/sec/sec-readiness-notice.tsx`, `src/lib/sec/readiness.ts` |
| A table bug (empty row, load more, sticky header, export) | `src/components/ui/data-table.tsx`, `load-more-button.tsx`, `src/components/api/export-menu.tsx`, `src/lib/export.ts` |
| Date / money / number text | `src/lib/format.ts`, `src/lib/earnings/format.ts` |
| Search box behaviour | `src/components/search/search-box.tsx` (`SearchQueryForm`, `SearchChip`, `SearchModeChips`) |
| Auto-loading pages | `src/lib/api/use-auto-load-pages.ts` |
| Day range inputs | `src/components/ui/day-range.tsx` |
| Status badge text / tooltip | `src/components/ui/status-badge.tsx` |
| Inspector / curl / CLI text | `src/components/api/api-sheet.tsx`, `src/lib/api/request-meta.ts`, `operations.gen.ts` (generated: fix the generator `scripts/generate-operations.mjs`) |
| URL state | `src/lib/url-state.ts` + the route's `validateSearch` |
| Navigation / sidebar / gate sentence | `src/lib/navigation.ts`, `src/lib/instruments.ts`, `src/components/navigation/app-sidebar.tsx` |
| Alert form fields | `src/lib/alerts/condition-fields.ts`, `alert-form.ts`, `src/components/alerts/` |
| Destination secret / headers | `src/lib/alerts/destinations.ts`, `src/components/alerts/` (keep the secret rules of `CLAUDE.md`) |
| Live sockets | `src/lib/live/stream-socket.ts`, `use-live-*.ts`, `ws-frames.ts` |
| Player | `src/lib/player/`, `src/routes/$ticker/earnings-calls/$eventId/-components/player/` |

Tests go next to the existing suite of the touched module (`src/routes/-tests/<page>.test.tsx`, `src/lib/**/x.test.ts`).

## Deferred / Follow-Up Work

- A scripted (Playwright) replay of the walk's happy paths — not requested; this walk is LLM-only.
- A deployed-site smoke pass (Netlify) after the walk branch is merged.
- Live earnings call checks when no call is live during the walk (Task 5 §5 records "not exercised"; re-run on a
  call day).
- API findings: executed from the backend tasklist written in Task 11, not here.
