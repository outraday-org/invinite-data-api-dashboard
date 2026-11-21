import { describe, expect, it } from "vitest";

import { personCalls, personDetail, personRoleLabel, personSubjectLabel, roleHistory } from "./people";
import { EVENT_IDS, PERSON_ANALYST, PERSON_EVENTS, PERSON_EXECUTIVE, PERSON_PARTICIPATIONS } from "./people-fixtures";

describe("people labels", () => {
    it("names the role; the investor-relations host by its kind", () => {
        expect(personRoleLabel(PERSON_ANALYST)).toBe("Analyst");

        expect(personRoleLabel({ kind: "ir_host", role: "executive" })).toBe("Investor relations");

        expect(personSubjectLabel(PERSON_EXECUTIVE)).toBe("John Ternus · Executive");

        expect(personSubjectLabel(null)).toBe("Person");
    });

    it("the detail is the latest title, else the firm, else nothing", () => {
        expect(personDetail(PERSON_ANALYST)).toBe("Analyst, Arete Research");

        expect(personDetail({ current_firm: "JP Morgan", current_title: " ", firm: null })).toBe("JP Morgan");

        expect(personDetail({ current_firm: null, current_title: null, firm: null })).toBeNull();
    });
});

describe("personCalls", () => {
    it("newest first by the event's date; a call whose event is unknown keeps the API order after the dated ones", () => {
        const calls = personCalls(PERSON_PARTICIPATIONS.data, PERSON_EVENTS);

        expect(calls.map(call => call.participation.event_id)).toEqual([EVENT_IDS.crto, EVENT_IDS.aapl, EVENT_IDS.nvda, EVENT_IDS.unknown]);

        expect(calls.at(-1)?.event).toBeNull();
    });

    it("no event known yet: the API order", () => {
        expect(personCalls(PERSON_PARTICIPATIONS.data, new Map()).map(call => call.participation.event_id)).toEqual(PERSON_PARTICIPATIONS.data.map(row => row.event_id));
    });
});

describe("roleHistory", () => {
    it("joins consecutive calls with the same title and firm, newest stretch first, undated calls left out", () => {
        const stretches = roleHistory(personCalls(PERSON_PARTICIPATIONS.data, PERSON_EVENTS));

        expect(stretches).toEqual([
            { calls: 2, firm: "Arete Research", from: "2026-10-30T20:30:00.000Z", title: "Analyst, Arete Research", to: "2026-11-04T13:00:00.000Z" },
            { calls: 1, firm: "Rete", from: "2026-02-26T09:30:00.000Z", title: "Analyst, Rete", to: "2026-02-26T09:30:00.000Z" },
        ]);
    });

    it("compares titles and firms without case or outer spaces", () => {
        const [first, second] = PERSON_PARTICIPATIONS.data;

        const calls = personCalls(
            [first, { ...second, firm: " arete research ", title: "analyst, arete research" }],
            PERSON_EVENTS,
        );

        expect(roleHistory(calls)).toHaveLength(1);
    });
});
