# Task 11 — Close-out: findings review, backend tasklist, docs, final checks

> **Status: DONE (walked 2026-11-22, 1 finding: F118)**

## Goal

Finish the walk: every finding has an outcome, routes not yet visited are walked, the walk branch is green, the
API / data findings become a new backend tasklist, `CLAUDE.md` matches the fixed app, and the owner gets a report.

## Prerequisites

Tasks 1–10.

## Requirements

### 1. Coverage

- [x] **T11.1** (every route of `routeTree.gen.ts` is in GUIDE §8 and was visited; the five old financial routes besides `financials-ratios` were checked here: each answers 301 to `/AAPL/financials?view=…` with the query kept) Compare GUIDE §8's route map with `src/routes/routeTree.gen.ts`; every route visited at least once
  (grep the task files' URLs). Walk any missed route with the standard per-page checks (PageHeader, API button, states,
  console) and log as `T11.1`.
- [x] **T11.2** (tasks 1–10: every check `[x]` or `[~]` with its reason in the task's notes; 20 `[~]`, all for no live data / no live call / a costly or unreachable state) Every check in tasks 1–10 is `[x]`, `[~]` (with reason) or linked to a finding.

### 2. Findings

- [x] **T11.3** (every finding has an outcome; re-check results in `findings.md` → Summary; regression: none; new F118 found and fixed) Every finding has an `Outcome` (GUIDE §5). Re-verify each `fixed in <sha>` in the browser once more on
  the branch tip (a later fix can regress an earlier one).
- [x] **T11.4** (one deferred: F113, ~1–2 h once the owner sets the rule) `deferred` dashboard findings: list them in the report with the reason and a size estimate.
- [x] **T11.5** Fill the summary table in `findings.md` (counts by class × severity × outcome).

### 3. Backend tasklist for API / data findings

Only when at least one finding has class `api` or `data`.

- [x] **T11.6** (`../backend/tasks/data-api-ui-walk-findings-2026-11-22/`: README + 13 tasks, owner decisions D1–D14) Create `../backend/tasks/data-api-ui-walk-findings-2026-11-22/` following the backend task format
  (model: `../backend/tasks/old/X-data-api-live-test-findings/README.md`): README (overview naming this walk and its
  findings file, Current State per finding with the observed request — method, path, query, status, request id; never
  the key —, Target State, decisions, dependency graph, summary table) and one numbered task file per coherent fix
  (group findings with one cause; split by service: `../invinite-data-api` route / contract vs backend data / jobs).
  Each task names the finding ids, the dashboard page that shows the effect, and what the dashboard does after the fix
  (e.g. "the Companies tab then shows fiscal year end; no dashboard change").
- [x] **T11.7** (dashboard follow-ups named in backend tasks 1, 5, 7, 9) A finding that also needs a dashboard change once the API is fixed is marked in the backend task as
  "dashboard follow-up" with the file to touch; do not implement it now.
- [x] **T11.8** (44 outcomes point to the folder; not committed in the backend repo) Write the backend folder's path into every API / data finding's `Outcome`. Do not commit in the backend
  repo unless the owner asks; tell the owner the folder exists.

### 4. Docs

- [x] **T11.9** (20 fix commits updated their CLAUDE.md sentence; `doc` findings: F018 fixed in 4552bb6, F106 / F115 by design with the task text annotated — no CLAUDE.md change; no line about the walk added — the owner may want one) `CLAUDE.md`: every fix that changed documented behaviour updated its sentence in its own commit
  (check the commits); add nothing about the walk itself beyond, if the owner wants it, one line under "Commands" or a
  pointer to this task folder. `doc` findings: fix the `CLAUDE.md` text now (one commit).

### 5. Final checks

- [x] **T11.10** (check, 135 test files / 1212 tests, build: all green) `pnpm run check` and `pnpm run test` green on the branch tip; `pnpm run build` succeeds.
- [x] **T11.11** (one commit per fix + task commits; the diff's `whsec` hit is the fake `whsec_1` of `request-meta.test.ts`, the other hits are task-file text; no key) `git log main..ui-walk-2026-11-22 --oneline`: one commit per fix + the task-file commits; no
  unrelated changes; no secret / key in any diff (`git diff main --stat` + grep the diff for `Bearer `, `whsec`,
  `api_key=`, `sk_`).
- [x] **T11.12** (3,999,939 → 3,995,334: 4,605 credits) Credits used = start credits − `/account` credits now; write into the report.
- [~] **T11.13** (left running: the lead stops the dev server after the quality pass) Stop the dev server (the background task); leave the browser profile as is (the key stays stored —
  the owner's choice to remove it).
- [~] **T11.14** (not renamed: the owner has not accepted the walk yet) Rename this folder's task files to the `X-` prefix only if the owner confirms the walk is accepted
  (the `X-` prefix marks completed tasks); otherwise leave them.

### 6. Report to the owner

- [x] **T11.15** (report returned to the lead) A short report in the conversation: checks run / passed / skipped, findings by class and severity,
  fixed (with the commit list), deferred, API tasklist path and its tasks, credits used, the start-vs-end state of the
  alerts account, anything the owner must decide (e.g. merge the branch, run the backend tasklist, re-run Task 5 §8 on
  a live-call day).

## Files to Create / Modify

| File | Action | Purpose |
| --- | --- | --- |
| `tasks/ui-walk-2026-11-22/findings.md` | Modify | Outcomes, summary |
| `tasks/ui-walk-2026-11-22/*.md` | Modify | Final ticks, statuses |
| `../backend/tasks/data-api-ui-walk-findings-2026-11-22/README.md` + `1-…md` … | Create | API / data findings tasklist |
| `CLAUDE.md` | Modify | Doc findings, behaviour changed by fixes |

## Acceptance Criteria

- Every route visited, every check resolved, every finding with an outcome.
- Branch green (check, test, build), one commit per fix, no secret in any diff.
- Backend tasklist exists when API / data findings exist, each finding referenced.
- Owner report delivered.
