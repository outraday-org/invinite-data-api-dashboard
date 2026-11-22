# Task 11 — Close-out: findings review, backend tasklist, docs, final checks

> **Status: TODO**

## Goal

Finish the walk: every finding has an outcome, routes not yet visited are walked, the walk branch is green, the
API / data findings become a new backend tasklist, `CLAUDE.md` matches the fixed app, and the owner gets a report.

## Prerequisites

Tasks 1–10.

## Requirements

### 1. Coverage

- [ ] **T11.1** Compare GUIDE §8's route map with `src/routes/routeTree.gen.ts`; every route visited at least once
  (grep the task files' URLs). Walk any missed route with the standard per-page checks (PageHeader, API button, states,
  console) and log as `T11.1`.
- [ ] **T11.2** Every check in tasks 1–10 is `[x]`, `[~]` (with reason) or linked to a finding.

### 2. Findings

- [ ] **T11.3** Every finding has an `Outcome` (GUIDE §5). Re-verify each `fixed in <sha>` in the browser once more on
  the branch tip (a later fix can regress an earlier one).
- [ ] **T11.4** `deferred` dashboard findings: list them in the report with the reason and a size estimate.
- [ ] **T11.5** Fill the summary table in `findings.md` (counts by class × severity × outcome).

### 3. Backend tasklist for API / data findings

Only when at least one finding has class `api` or `data`.

- [ ] **T11.6** Create `../backend/tasks/data-api-ui-walk-findings-2026-11-22/` following the backend task format
  (model: `../backend/tasks/old/X-data-api-live-test-findings/README.md`): README (overview naming this walk and its
  findings file, Current State per finding with the observed request — method, path, query, status, request id; never
  the key —, Target State, decisions, dependency graph, summary table) and one numbered task file per coherent fix
  (group findings with one cause; split by service: `../invinite-data-api` route / contract vs backend data / jobs).
  Each task names the finding ids, the dashboard page that shows the effect, and what the dashboard does after the fix
  (e.g. "the Companies tab then shows fiscal year end; no dashboard change").
- [ ] **T11.7** A finding that also needs a dashboard change once the API is fixed is marked in the backend task as
  "dashboard follow-up" with the file to touch; do not implement it now.
- [ ] **T11.8** Write the backend folder's path into every API / data finding's `Outcome`. Do not commit in the backend
  repo unless the owner asks; tell the owner the folder exists.

### 4. Docs

- [ ] **T11.9** `CLAUDE.md`: every fix that changed documented behaviour updated its sentence in its own commit
  (check the commits); add nothing about the walk itself beyond, if the owner wants it, one line under "Commands" or a
  pointer to this task folder. `doc` findings: fix the `CLAUDE.md` text now (one commit).

### 5. Final checks

- [ ] **T11.10** `pnpm run check` and `pnpm run test` green on the branch tip; `pnpm run build` succeeds.
- [ ] **T11.11** `git log main..ui-walk-2026-11-22 --oneline`: one commit per fix + the task-file commits; no
  unrelated changes; no secret / key in any diff (`git diff main --stat` + grep the diff for `Bearer `, `whsec`,
  `api_key=`, `sk_`).
- [ ] **T11.12** Credits used = start credits − `/account` credits now; write into the report.
- [ ] **T11.13** Stop the dev server (the background task); leave the browser profile as is (the key stays stored —
  the owner's choice to remove it).
- [ ] **T11.14** Rename this folder's task files to the `X-` prefix only if the owner confirms the walk is accepted
  (the `X-` prefix marks completed tasks); otherwise leave them.

### 6. Report to the owner

- [ ] **T11.15** A short report in the conversation: checks run / passed / skipped, findings by class and severity,
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
