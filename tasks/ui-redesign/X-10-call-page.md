# Call page

> **Status: TODO**

## Goal

Calm down the call page — the richest page of the dashboard — without touching its player engine, hooks, requests
or lazy-loading rules: one header with a "Details" disclosure, a boxless player bar, a single-row tab bar and a
reading column for the transcript.

## Prerequisites

Tasks 5 and 6.

## Current Behavior

- Call page (`src/routes/$ticker/earnings-calls/$eventId/`, pieces in `../-components/`): header
  (`call-header.tsx`) with nine fields under upper-case eyebrow labels (call time, session, materials, results
  released, started, ended, results filing, periodic report, event id) + a disclosure; then "Create alert", a
  bordered search box (`AskThisCall`), a bordered player box (`CallPlayer`), the tab bar (10 tabs, wrapping through
  `WRAPPING_TABS_LIST_CLASS`), a toolbar (format switch, version, compare, download, copy), a stats line — five
  stacked boxes before the first sentence of the transcript (F8).
- Transcript turns run the full content width (~190 characters a line at 1440 px).
- `FOLLOW_SCROLL_MARGIN_CLASS` (`src/lib/player/use-follow-scroll.ts`) adds `7rem` for the player below the pinned
  bars.

## Desired Behavior

```
Q4 FY2026 earnings call                       Confirmed · Published        [Create alert ▾]
Nov 2, 2026 · 11:00 PM CET · after close · SEC filing, high confidence
Materials  ▣ transcript ▣ audio ▢ slides ▣ press release ▣ documents
▸ Details   results released, started, ended, results filing (8-K → panel, EDGAR ↗),
            periodic report, event id (copy), call-time observations            ← one disclosure, StatGrid inside

[▶ Play the recording]  ──●────────────  0:00 / 53:12   1×  ⋯        ← player: no box, a pinned bar with a top hairline
[Search this call …                          Search]   10 credits     ← one line; type chips appear once focused / filled
Transcript  Slides  Press release  Documents  Guidance & KPIs  Q&A  Participants  Metrics & diff  Prosody  Price moves
```

- Header: title = `eventLabel` (sentence form), status badges beside it, one meta line (sentence case, no
  eyebrow labels; times through `formatInstantShort`), materials as labelled icons (icon + word from `sm`, icons with
  `aria-label` / tooltip below), everything else in one "Details" disclosure (closed by default, `aria-expanded`;
  the event id copy button stays reachable there). `?t=` and all URL state unchanged.
- Player bar: same engine, same controls; visual only — no surrounding card, sticky as today
  (`STICKY_TOP_CLASS`), compact once pinned. The mock-up puts the player bar above "Search this call" (today:
  search, then player, then tabs); state that order change in the commit message — it is the only reordering.
- Tab bar: one row that scrolls sideways inside itself with edge fades below `xl` (replacing the wrapping list on
  this page — 10 tabs wrap to three rows on a phone); muted (unavailable) tabs keep their meaning; the active tab is
  scrolled into view inside the row (`scrollIntoView({ inline: "nearest", block: "nearest" })`, as `SectionTabs`).
  Holders and the filing page keep `WRAPPING_TABS_LIST_CLASS`.
- Transcript: reading column `max-w-[72ch]` for turns in every format, 14 px / 24 px line; turn header (avatar,
  name, title · firm, ▷ time) on one line; toolbar = one row (format segmented control · version · Compare ·
  Download · Copy) with the stats line as its meta. Q&A, press release, participants, guidance tables: `Section`s
  and `DataTable` toolbar; the price-moves and prosody charts read the new tokens.
- Live state (`LiveCallPlayer`, `LivePlayerSlot`, `LiveTranscript`): same structure; pills restyled; the "Live
  highlights" form in a `Section`.

## Requirements

1. Header (`-components/call-header.tsx`), `CallPlayer` styles (`-components/player/call-player.tsx`,
   `player-controls.tsx`, `seek-bar.tsx`, `live-call-player.tsx`), `call-tabs.tsx` tab list, `TranscriptToolbar`,
   `TurnBlock` typography, the tab bodies under `-components/tabs/` (layout only) — no change to the player engine
   (`src/lib/player/*-engine.ts`), hooks, requests or lazy-loading rules (`/audio` still never on page load).
2. Follow-scroll: `FOLLOW_SCROLL_MARGIN_CLASS` and `followWordDelta` assume the pinned bars' heights — re-check
   following a playing recording after the header / player heights change; adjust the margin constant, not the rule.
3. Tests updated where markup changed: `call-player.test.tsx`, `transcript-layout.test.tsx`, `live-player.test.tsx`,
   `ask-this-call.test.tsx` (search box / chips), `earnings-o7.test.tsx` (call header), `no-transcript-notice.test.tsx`
   (its "wraps onto a second row instead of scrolling the last tabs …" case becomes the single scrolling row),
   `price-attribution-tab.test.tsx`, `documents-tab.test.tsx`, `slide-timeline.test.tsx` only if their markup
   assertions change.
4. Responsive checks: at 375 px — header ≤ one screen with Details closed, player controls reachable with one thumb
   (play ≥ 40 px), tab row scrolls with the active tab in view; at 1440 px with the request panel docked the reading
   column stays 72ch and the player bar does not overlap the panel.
5. Edge cases: a non-earnings event (hidden tabs), a call without recording (no player bar), an untimed transcript,
   an upcoming call (header only + "No transcript yet"), a live call (if none is live, state so in the task notes),
   `?t=` on a recorded call ("Play from m:ss" still shown).

## Files to Create / Modify

| File | Action | Purpose |
| --- | --- | --- |
| `src/routes/$ticker/earnings-calls/-components/{call-header,call-tabs}.tsx` | Modify | header, tab row |
| `src/routes/$ticker/earnings-calls/-components/player/*.tsx` | Modify | player bar styles |
| `src/routes/$ticker/earnings-calls/-components/transcript/*.tsx`, `tabs/*.tsx`, `live/*.tsx`, `live-player-slot.tsx` | Modify | reading column, toolbar, sections |
| `src/routes/$ticker/earnings-calls/$eventId/**` | Modify | page order |
| `src/lib/player/use-follow-scroll.ts` | Modify if needed | `FOLLOW_SCROLL_MARGIN_CLASS` |
| tests named above | Modify | |

## Acceptance Criteria

- At 1440 × 900: the first transcript turn starts within the first screen (Details closed).
- Transcript lines are ≤ 80 characters; playing a recording still highlights and follows the heard word.
- 10 tabs: one row at every width, active tab visible.
- `/audio` is not requested on page load; every other request of the page unchanged (compare in the panel).
- No sideways page scroll at 375 / 768 / 1024 / 1440.
- `pnpm run check`, `pnpm run test` green.
