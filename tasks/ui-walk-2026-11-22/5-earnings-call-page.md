# Task 5 — Earnings: calls list, call page, player, transcript, live

> **Status: TODO**

## Goal

Walk the calls list and one finished earnings call page end to end (header, every tab, the player, transcript
formats / versions / compare / downloads, search this call, `?t=` links, slides timeline, follow mode), one
non-earnings event, and — if a call is live during the walk — the live player and live transcript.

## Prerequisites

Task 1 (live-call status recorded). Subject: the newest `NVDA` earnings call with `has_audio`, `has_transcript`,
`has_slides` (pick from the calls list; any covered company with all flags will do).

## Current Behavior

`src/routes/$ticker/earnings-calls/` (list) and `$eventId/` (page, `-components/call-tabs.tsx`, `player/`,
`transcript/`, `tabs/`, `live/`). `CLAUDE.md` → "Call page", "Live earnings calls", "Earnings (O7 group 5)".

## Desired Behavior

Every check ticked or logged. Audio plays inside the built-in browser: you cannot hear it, so judge playback by the
player's time advancing, `aria-valuetext` of the seek bar and the transcript highlight (screenshots).

## Requirements

### 1. Calls list `/NVDA/earnings-calls`

- [ ] **T5.1** Tabs Upcoming / Past (`?tab=`), counts "40+" while more pages exist, `?fiscalYear=`; rows: label, date
  ("date only" caption when untimed), status badge, availability icons, event id copy button; non-earnings events with
  their type badge (the list asks `type=all`). Upcoming rows show no Started / Ended.
- [ ] **T5.2** "Live now" strip only for this company's live calls (nothing, not even an error line, when none).
- [ ] **T5.3** Search box toggles Transcripts | Documents (`?search=documents`); a Transcripts hit links its call
  (1 search, 10 credits). Export of the list. Alert entries (`earnings_call`, `earnings_call_keyword`,
  `earnings_results`, `event_countdown`).

### 2. Call page header and tabs

- [ ] **T5.4** Header: title, time with source · confidence (low = outlined badge "may still change"), event id + copy,
  results filing / periodic report forms → SEC documents panel, "EDGAR" link; video slot (click-to-load facade: no
  iframe and no request to youtube / vimeo before the click — check `read_network_requests`; after the click the
  iframe uses `youtube-nocookie.com` / `player.vimeo.com`).
- [ ] **T5.5** Tab bar ends with the API button listing the event's, open tab's and player's requests. Only the open
  tab requests (switch tabs, watch the sheet). An old `?tab=audio` falls back to Transcript without a request.
- [ ] **T5.6** Tabs visit: Transcript, Q&A, Guidance & KPIs, Participants, Metrics & diff, Prosody, Press release,
  Slides, Documents, Price moves — each renders data or its empty / notice state (404 not-derived = notice, no toast).

### 3. Player

- [ ] **T5.7** On load, no `/audio` request (API sheet). Bar shows "Play the recording"; Play → requests `/audio`,
  loading, then time advances. Sticky below the header while scrolling; compact when pinned (one speed button, no
  volume slider).
- [ ] **T5.8** Controls: pause, ±15 s, speed 1× / 1.5× / 2× (remembered after reload), mute / level, seek bar
  (←/→ 5 s, Shift 15 s, Home / End via `computer` key presses while the slider has focus; `aria-valuetext` updates),
  Q&A marker + slide markers on the bar, `⋯` menu with file facts + "Copy link at current time" (URL gets `?t=`).
- [ ] **T5.9** Page shortcuts: Space play / pause, J / L ∓15 s — NOT while typing in "Search this call".
- [ ] **T5.10** Download recording → filename `NVDA-<Q?-FY????>-call.<ext>` (or new tab when CORS blocks); no error.
- [ ] **T5.11** Open the copied `?t=<seconds>` URL in a new tab: Transcript opens at that turn, Play reads "Play from
  m:ss", no `/audio` request until Play; Play starts there.

### 4. Transcript tab

- [ ] **T5.12** Toolbar: format switch Speakers / Sections / Cleaned / Text (`?format=`, Speakers never written), version
  select (`?version=`; corrected-by text), Compare (diff), Download menu (View PDF dialog, PDF, Plain text, JSON,
  recording once loaded; filenames `…-transcript-v<n>.<ext>`), Copy; stats line with "Q&A starts at ▷ m:ss".
- [ ] **T5.13** Speakers: avatars / initials, name → `/people/$personId` when `person_id` set, title · firm, ▷ m:ss seek
  buttons, "Speaker uncertain" badge below 0.8 confidence; Q&A divider. While playing: heard turn background, spoken
  word marked, later text faded; paused = nothing faded. Word click seeks to that word.
- [ ] **T5.14** Follow: on while playing scrolls the document to the heard turn; a mouse wheel turns it off; Follow
  button turns it back on. "Jump to transcript" does not turn it off.
- [ ] **T5.15** Cleaned: turn-level highlight only (no invented word timings); Sections / Text: no turns, open at top.
- [ ] **T5.16** One words request: Speakers of the current version and the player share ONE `/transcript?include=words`
  (API sheet).

### 5. Other tabs in depth

- [ ] **T5.17** Q&A: question / follow-up / answer `TurnBlock`s with badges, co-speakers; score badges (Difficulty,
  Evasiveness, Non-answer, Tone) open evidence quotes, casting order, `scored_by`.
- [ ] **T5.18** Guidance & KPIs: "needs review" filter; history dialog (scoped to the item's period kind + basis);
  KPI history panel (Newest / Oldest, dot chart of the commonest unit, table with call links).
- [ ] **T5.19** Participants: names with avatars and person links, "Search people: on this call / on every NVDA call".
- [ ] **T5.20** Metrics & diff: "Compare with" picker requests earlier calls only when opened; another call → the API's
  404 detail naming the derived prior, shown in its words; `?prior=` in the URL.
- [ ] **T5.21** Slides: timeline above the deck (with a recording): prev / next seek, "At the playhead" marker while
  playing, Follow keeps it in view; click on a slide seeks (first click loads the recording).
- [ ] **T5.22** Price moves: lead sentence (coincidence, not cause), anchor facts, top minute moves with utterances,
  cumulative chart, bucket table with seek buttons; no price / volume values anywhere.
- [ ] **T5.23** Documents tab: kind chips, `?docSort=`, "Filings" section for `sec_filing` links, Show text.
- [ ] **T5.24** Press release: body paragraphs; link to its archival news item (`/NVDA/news?item=`).

### 6. Search this call

- [ ] **T5.25** `data center` → results header "N results for “data center”" (button with `aria-expanded`), hits with
  `TurnHeader`, marked spans; "Play from here" seeks + jumps the transcript and collapses the results; × clears.
  A chip re-runs the submitted query. (2 searches.)

### 7. Non-earnings event and edge cases

- [ ] **T5.26** Open an investor day / conference event (calls list, type badge): flagged-off tabs are hidden (not
  muted); header says "Recorded from the company's public webcast." when it has audio / transcript.
- [ ] **T5.27** A call with `has_transcript: false` (an upcoming one): "No transcript yet" + why; no player bar without
  `has_audio`. Invalid event id `/NVDA/earnings-calls/not-an-id` → NotFound.

### 8. Live call (only if one is live during the walk; else `[~]` all with "no live call")

- [ ] **T5.28** Live call page: notices, "Tune in" / "From the beginning"; after Tune in: `LIVE` / `LIVE · synced` pill,
  `−MM:SS` behind-live button after a seek back, no speed control; `⋯` Playback Synced / As live as possible.
- [ ] **T5.29** Live transcript: provisional names with "live" badge and source tooltip, italic partial tail, follow;
  "Watch for keywords" adds marks and highlight rows; price chart with return ↔ price toggle; Diagnostics collapsed.
  Note `/live-audio` request count (billed) in the API sheet: once per view.

## Files to Create / Modify

| File | Action | Purpose |
| --- | --- | --- |
| `tasks/ui-walk-2026-11-22/findings.md` | Modify | Findings |
| this task file | Modify | Ticks, status |
| `src/routes/$ticker/earnings-calls/**`, `src/lib/player/**`, `src/lib/earnings/**`, `src/lib/live/**`, tests | Modify | Dashboard fixes only |

## Acceptance Criteria

- Calls list + one full call page + one non-earnings event visited; live section done or `[~]` with the reason.
- T5.1–T5.29 ticked / `[~]` / logged with outcome; fixes committed with tests; check + test green.
