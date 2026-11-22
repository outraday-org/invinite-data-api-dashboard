# Walk execution guide (read before Task 1)

This guide is for the LLM that executes the walk. It is self-contained: tools, rules, procedure, formats.

## 1. Environment

- **Session**: Claude Code inside the **Claude desktop app** on the owner's machine, so the built-in browser tools are
  named `mcp__Claude_Browser__*` and can reach `localhost`. If only `mcp__remote-devices__Claude_Browser__*` exists
  (a cloud session), `localhost:3001` is NOT reachable: stop and tell the owner to start the session in the desktop
  app. Do not switch to Claude in Chrome without asking.
- **Load the tools once** with ToolSearch `{ query: "mcp__Claude_Browser__", max_results: 64 }`. Also load the
  `anthropic-skills:built-in-browser` skill once if it is not in context.
- **Branch**: `git switch -c ui-walk-2026-11-22` from an up-to-date, clean `main` before anything else. If the branch
  exists (a resumed walk), switch to it and read `findings.md` to see where the walk stopped.
- **Dev server**: `pnpm install` (only if `node_modules` is stale), then `pnpm run dev` with `run_in_background: true`
  (port 3001). Wait until `http://localhost:3001` answers (`curl -sI`), then open it with `preview_start`
  `{ url: "http://localhost:3001" }` and keep the returned `tabId` as the **app tab**.
- **API**: the dev server uses the default `INVINITE_DATA_API_URL` = `https://api.data.invinite.com` (prod). No `.env`
  is needed: the key comes from the browser.

## 2. The key (hard rules)

- The walker **never** types, reads back, prints, logs or describes the API key. The owner enters it.
- In Task 1, when the onboarding card shows: call `tabs_context` (it says whether the pane is displayed), then ask the
  owner in one message to paste their **ENTERPRISE** key into the card's field in the Browser pane and press Save
  (if the pane is hidden: Cmd+Shift+B, or the globe icon). Wait for "done".
- The key lives in the built-in browser's `localStorage` (`invinite-data-api-key`) and persists across sessions.
  Never run `javascript_tool` code that reads `localStorage` values; reading `Object.keys(localStorage)` is fine.
- `get_page_text` / `read_page` of the account page or the key dialog may show a masked key: never copy it anywhere.
- The live socket URL carries `?api_key=`: never copy a network request URL of `wss://…/v1/stream` into a finding.
  Write `wss://api.data.invinite.com/v1/stream?api_key=<redacted>`.
- If the key ever appears in a tool result you are about to quote, replace it with `<redacted>`.

## 3. Reading and acting in the browser

- Read with `get_page_text` (text) and `read_page` (structure, roles, `aria-*`). Use `find` to locate an element.
- Screenshot (`computer` action `screenshot`) only when layout is the point: sticky headers, overflow, charts, the
  player, dark mode, phone width. Describe what you see in the finding; do not paste base64.
- Act with `computer` (click, type, key) or `form_input`. After every action that changes data, wait for the page to
  settle (a spinner / skeleton gone, `find` the expected element) before judging.
- **Console**: after each page, `read_console_messages` with `pattern: "error|Error|Warning: |hydrat"`. A React error,
  an uncaught promise, a hydration mismatch or a key warning is a finding (severity per §6). A Vite HMR line is not.
- **Network**: `read_network_requests` when a page shows something odd: check the server-function call status. Real
  API requests are made by the server (server functions), so in the browser you see `/_serverFn/…` calls; the
  concrete Data API request (path, query, status, request id, credits) is in the page's **API** inspector sheet.
- **Dialogs**: never trigger a native `alert` / `confirm` / `prompt`. The app's confirms are in-page
  (`ConfirmAction`), which is fine. If a native dialog ever appears, that is a finding; ask the owner to dismiss it.
- **Downloads** (export CSV / JSON, transcript PDF, recording): click once, then confirm a download happened via the
  page (no error toast) and `read_console_messages`; you cannot open the file. Do not repeat downloads needlessly.
- **New tabs** (EDGAR links, "Open at source", "Watch on YouTube"): read the link's `href` / `rel` with `read_page`;
  open at most one per kind to confirm it resolves, then close it (`tabs_close`).
- **Clipboard**: copy buttons cannot be verified by reading the clipboard; check the button's "Copied" state.
- **Credits**: ENTERPRISE has large limits, but searches cost (filing search 100 credits / page, transcript search
  10, news search 10). Run each costly search the number of times its check says, not more.

## 4. Per-check procedure

Each task lists checks `T<task>.<n>`. For every check:

1. Do the steps. Note the URL you were on.
2. Compare with the **Expect** line (it is derived from `CLAUDE.md`; when the two disagree, `CLAUDE.md` + the spec
   win and the task text is wrong — log that as a `doc` finding and continue).
3. Pass → tick it in the task file's checklist (`- [x]`) — no other note needed.
4. Fail → log a finding (§5), classify it (§6), then follow §7.
5. Not possible (no data, no live call, a third-party site refused) → `- [~]` with a one-line reason in the task file.

At the end of each task: set its status line to `> **Status: DONE (walked 2026-11-22, N findings)**`, commit the task
file and `findings.md` (`UI walk: task N walked`), and give the owner a 3-line summary.

## 5. Findings format (`findings.md`)

Append one block per finding, ids `F001`, `F002`, … in order of discovery:

```markdown
### F007 — Dividends: export CSV header shows raw dotted keys for the type column
- Check: T4.18 · Severity: minor · Class: dashboard
- Where: http://localhost:3001/AAPL/dividends?sort=pay_date
- Steps: open page → Export → CSV
- Expected: column "Type" with words (CLAUDE.md "Dividends: a Type column")
- Actual: header `dividend_type`, cells `CD`
- Evidence: API sheet request id req_01…, console clean
- Outcome: fixed in a1b2c3d (src/routes/$ticker/dividends/-components/…, test dividends-page.test.tsx)
```

`Outcome` is one of: `fixed in <sha>` · `API → backend tasklist (task <n>)` · `by design (<why, source>)` ·
`not reproducible` · `deferred (<why>)`. A finding is never left without an outcome at Task 11.

## 6. Classification

- **Class** `dashboard` (code in this repo is wrong), `api` (the API answer is wrong, missing a field, inconsistent
  with `openapi.json`, slow > 10 s, or 5xx), `data` (the stored data is wrong: e.g. a wrong value, a missing filing —
  goes to the backend tasklist too), `doc` (`CLAUDE.md` / a task text describes something else than the app does
  and the app is right).
- **Severity** `blocker` (a page crashes / a flow cannot complete / a secret or key leaks), `major` (wrong data
  shown, a write does something unexpected, a plan gate shows on ENTERPRISE, a state is missing so the page looks
  empty/broken), `minor` (wrong text, layout off, a tooltip missing, a console warning), `nit` (wording, spacing).
- A **key or secret leak** (key in a URL, toast, console, inspector; a destination secret visible after its dialog
  closed) is always `blocker`: fix it before continuing.

## 7. Fix rules

**dashboard** findings are fixed during the walk, immediately after logging (blockers / majors), or batched at the end
of the task (minors / nits):

1. Find the cause in code (read the page's route file and the shared piece; see README "Code Reuse"). Fix it in the
   shared piece when the bug lives there — never fork a shared component.
2. Add or extend the test in the module's existing suite so the bug would fail it (pure view tests with fixtures,
   `// @vitest-environment jsdom` for components).
3. `pnpm run check` (eslint --fix + tsc) and `pnpm run test` must pass. Fix what they report.
4. Re-check in the browser (HMR reloads the app tab; a server-function change may need a page reload).
5. If the fix changes behaviour that `CLAUDE.md` documents, update that `CLAUDE.md` sentence in the same commit.
6. Commit: `UI walk F007: <what changed>` + the attribution line. One finding per commit (two findings with one
   cause may share it; name both). Do not push.
7. Write the sha into the finding's `Outcome`.

Do **not** fix in the dashboard when the right fix is in the API (class `api` / `data`): no client-side workaround
that hides a wrong answer, no invented field, no client-side filter replacing a missing API filter. Log it and move on.
The exception: the UI crashing or showing a misleading state on a valid-per-spec answer is a dashboard bug even when
the answer is surprising.

If a fix would take more than ~1 hour or touches > 10 files, log it as `deferred` with the reason and continue; Task 11
lists it for the owner.

## 8. Route map (every route must be visited at least once)

Global: `/` · `/calendar` · `/live-calls` · `/ipo-calendar` · `/market-holidays` · `/instruments` (+ `?view=companies`)
· `/funds` · `/institutions` · `/people` · `/people/$personId` · `/offerings` · `/offerings/$offeringId` · `/catalog`
· `/search` · `/news-feed` · `/filings` · `/filings/$accession` · `/sec/datasets` · `/sec/$cik` · `/account` ·
`/status` (301) · `/licensing` (301).
Instrument: `/$ticker` · `/financials?view=standardized|as-reported|ratios|growth|cagr|segments` · `/filings` ·
`/insider-trades` · `/holders` · `/holdings` · `/dividends` · `/stock-splits` · `/news` · `/documents` ·
`/earnings-calls` · `/earnings-calls/$eventId`; redirects `/$ticker/earnings-calendar|ipos|market-holidays` and the
six old financial routes.
Alerts: `/alerts` · `/alerts/new` · `/alerts/$id` · `/alerts/events` · `/alerts/destinations` ·
`/alerts/destinations/$id` · `/alerts/webhooks` · `/alerts/users` · `/alerts/users/$externalUserId` ·
`/alerts/scripts` · `/alerts/scripts/$id`.

Task 11 checks this list against `src/routes/routeTree.gen.ts`; a route added since this guide was written is walked
there.

## 9. Subjects

Pick from what the API has; these are the defaults (Task 1 confirms each exists):

- Stocks: `AAPL` (primary), `NVDA` (earnings call with audio / slides), `MSFT` (second company for comparisons).
- Funds: `SPY` (ETF), `VOO` (class of a multi-class series), `GLD` (exchange-traded trust, no holdings), one closed-end
  fund and one ETN found via `/instruments` type tabs.
- 13F manager: Berkshire Hathaway `/sec/1067983` (or any row of `/institutions`).
- Unknown symbol: `ZZZZQ`. Unknown CIK: `/sec/9999999999`.

## 10. Marker for writes

Every resource the walk creates carries `walk-1122`:
destination description `walk-1122 webhook.site` / `walk-1122 unroutable`; alert `client_reference_id`
`walk-1122-<type>`; end users `walk-1122-a`, `walk-1122-b`, `walk-1122/odd:id x`; scripts `walk-1122 EMA cross`.
Task 1 records the start counts; Task 10 deletes everything with the marker and compares.

## 11. When to stop and ask the owner

- The browser tools fail 2–3 times in a row, the pane is unreachable, or a site approval is pending.
- A write does something outside its check (e.g. a real alert fires to a destination other than webhook.site).
- A blocker you cannot fix within the rules.
- Anything that would touch resources without the `walk-1122` marker (never delete or edit the owner's own alerts,
  destinations, users or scripts).
