import type { V2Event, V2ParticipantsResponse, V2Participation, V2PeopleResponse, V2Person } from "@/lib/api/types";

import { CALENDAR_EVENT } from "@/lib/earnings/calendar-fixtures";

// People fixtures (backend tasks/data-api-dashboard O7 group 1), shaped like the live answers of 2026-11-21.

export const PERSON_ANALYST: V2Person = {
    aliases: ["Rete"],
    appearance_count: 4,
    appearances: 4,
    current_firm: "Arete Research",
    current_title: "Analyst, Arete Research",
    firm: "Arete Research",
    first_seen: "2026-02-26T09:30:00.000Z",
    image_kind: null,
    image_url: null,
    kind: "analyst",
    last_seen: "2026-11-04T13:00:00.000Z",
    mean_difficulty: 0.552,
    name: "Richard Kramer",
    person_id: "f42e6e2a-73a4-446d-908b-e4c57b65167b",
    questions: 6,
    role: "analyst",
    scored_question_count: 5,
};

export const PERSON_EXECUTIVE: V2Person = {
    aliases: [],
    appearance_count: 1,
    appearances: 1,
    current_firm: null,
    current_title: "CEO, Apple",
    firm: null,
    first_seen: "2026-11-02T22:00:00.000Z",
    image_kind: "photo",
    image_url: "https://storage.invinite.com/people/2aabf608a6990a157432f87b1a9d5a2a/john-ternus.webp",
    kind: "executive",
    last_seen: "2026-11-02T22:00:00.000Z",
    mean_difficulty: null,
    name: "John Ternus",
    person_id: "f4176e76-8327-4297-9a74-9d5b43638686",
    questions: 0,
    role: "executive",
    scored_question_count: 0,
};

export const V2_PEOPLE: V2PeopleResponse = {
    data: [PERSON_EXECUTIVE, PERSON_ANALYST],
    has_more: true,
    meta: {},
    next_cursor: "c2",
};

const participation = (eventId: string, title: null | string, firm: null | string): V2Participation => ({
    confidence: 1,
    event_id: eventId,
    evidence: [{ quote: "Our next question comes from Richard Kramer with Arete Research.", start_ms: 1_854_000 }],
    firm,
    image_kind: null,
    image_url: null,
    name: "Richard Kramer",
    person_id: PERSON_ANALYST.person_id,
    resolved_by: "llm",
    role: "analyst",
    speaker_label: "spk12",
    title,
});

export const EVENT_IDS = {
    aapl: "2463cda2-9968-411d-886c-e638d71f34b3",
    crto: "14601f72-42d6-4cf7-82c8-04084c1a5172",
    nvda: "c1598510-d669-47d1-a4fa-fb006517c7ef",
    unknown: "b537470e-2e10-4f46-89e1-16625ac5f099",
} as const;

/** The person's calls in the API's order (no date: the page asks each event). */
export const PERSON_PARTICIPATIONS: V2ParticipantsResponse = {
    data: [
        participation(EVENT_IDS.crto, "Analyst, Arete Research", "Arete Research"),
        participation(EVENT_IDS.aapl, "Analyst, Arete Research", "Arete Research"),
        participation(EVENT_IDS.nvda, "Analyst, Rete", "Rete"),
        participation(EVENT_IDS.unknown, null, "Arete Research"),
    ],
    has_more: false,
    meta: {},
    next_cursor: null,
};

const event = (eventId: string, symbol: string, companyName: string, scheduledAt: string, quarter: number): V2Event => ({
    ...CALENDAR_EVENT,
    company_name: companyName,
    event_id: eventId,
    fiscal_quarter: quarter,
    fiscal_year: 2026,
    scheduled_at: scheduledAt,
    symbol,
});

/** The events of three of the four calls (the fourth is still loading). */
export const PERSON_EVENTS: ReadonlyMap<string, V2Event> = new Map([
    [EVENT_IDS.aapl, event(EVENT_IDS.aapl, "AAPL", "Apple Inc.", "2026-10-30T20:30:00.000Z", 4)],
    [EVENT_IDS.crto, event(EVENT_IDS.crto, "CRTO", "Criteo S.A.", "2026-11-04T13:00:00.000Z", 3)],
    [EVENT_IDS.nvda, event(EVENT_IDS.nvda, "NVDA", "NVIDIA Corp", "2026-02-26T09:30:00.000Z", 4)],
]);
