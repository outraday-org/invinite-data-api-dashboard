import { describe, expect, it } from "vitest";

import { alertTarget, eventsNewestFirst, eventSummary, isTestEvent, loadedEventsNote, newestEventId, shouldAutoLoad } from "./alert-view";
import { ALERT_DIVIDEND, ALERT_FILING, ALERT_NEWS_KEYWORD, EVENT_OLD, EVENT_STATUS, EVENT_TEST, EVENTS_PAGE_FIXTURE, fixtureAlert, fixtureEvent } from "./alerts-fixtures";

describe("alertTarget", () => {
    it("one symbol, several companies (+N), a CIK, or every company", () => {
        expect(alertTarget(ALERT_FILING)).toBe("AAPL");

        expect(alertTarget(ALERT_NEWS_KEYWORD)).toBe("AAPL, MSFT, NVDA +1");

        expect(alertTarget(fixtureAlert("halt", { condition: { ciks: ["320193"] } }))).toBe("CIK 320193");

        expect(alertTarget(fixtureAlert("dividend", { condition: { kinds: ["declared"] } }))).toBe("Every company");

        expect(alertTarget(ALERT_DIVIDEND)).toBe("KO");
    });
});

describe("events", () => {
    it("newest first, one row per id; a live event the pages also hold is shown once", () => {
        const live = [fixtureEvent("evt_04", { occurred_at: "2026-11-21T14:00:00Z" }), EVENT_TEST];

        expect(eventsNewestFirst([EVENTS_PAGE_FIXTURE], live).map(event => event.id)).toEqual(["evt_04", "evt_03", "evt_02", "evt_01"]);

        expect(newestEventId([EVENTS_PAGE_FIXTURE])).toBe("evt_03");

        expect(newestEventId([])).toBeUndefined();
    });

    it("a line per event: the fire's summary, a status change, the type in words", () => {
        expect(eventSummary(EVENT_OLD)).toBe("AAPL filed an 8-K");

        expect(eventSummary(EVENT_STATUS)).toBe("active → triggered");

        expect(eventSummary(fixtureEvent<"destination.disabled">("evt_x", { payload: { destination: { id: "dst_example", url: "https://example.com/hooks" }, disabled_at: "2026-11-20T15:00:00Z", event_id: "evt_x", reason: "failing" }, type: "destination.disabled" }))).toBe("Destination disabled");

        expect(isTestEvent(EVENT_TEST)).toBe(true);

        expect(isTestEvent(EVENT_OLD)).toBe(false);
    });

    it("an oldest-first list loads its newer pages by itself, at most 10, never after a failed page", () => {
        const state = { hasNextPage: true, isFetching: false, nextPageFailed: false, pageCount: 1 };

        expect(shouldAutoLoad(state)).toBe(true);

        expect(shouldAutoLoad({ ...state, pageCount: 10 })).toBe(false);

        expect(shouldAutoLoad({ ...state, nextPageFailed: true })).toBe(false);

        expect(shouldAutoLoad({ ...state, isFetching: true })).toBe(false);

        expect(shouldAutoLoad({ ...state, hasNextPage: false })).toBe(false);

        expect(loadedEventsNote(3, false)).toBe("All 3 events, newest first.");

        expect(loadedEventsNote(1, false)).toBe("The only event.");

        expect(loadedEventsNote(2000, true)).toContain("more recent ones exist");

        expect(loadedEventsNote(0, false)).toBeNull();
    });
});
