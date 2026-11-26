// @vitest-environment jsdom
import type * as React from "react";

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { V2Event } from "@/lib/api/types";

import { ApiRequestError } from "@/lib/api/errors";
import { CALENDAR_EVENT } from "@/lib/earnings/calendar-fixtures";
import { personCalls, roleHistory } from "@/lib/people";
import { EVENT_IDS, PERSON_ANALYST, PERSON_EVENTS, PERSON_EXECUTIVE, PERSON_PARTICIPATIONS, V2_PEOPLE } from "@/lib/people-fixtures";
import { ParticipantsTab } from "@/routes/$ticker/earnings-calls/-components/tabs/participants-tab";
import { historyNote, PersonCallsView, PersonProfileView, RoleHistoryView } from "@/routes/people/$personId";
import { PeopleList, peopleRequest } from "@/routes/people/index";

vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
    Link: ({ children, params = {}, search, to }: { children: React.ReactNode; params?: Record<string, string>; search?: Record<string, string>; to: string }) => {
        const path = Object.entries(params).reduce((value, [key, param]) => value.replace(`$${key}`, param), to);

        const query = new URLSearchParams(search ?? {}).toString();

        return <a href={query ? `${path}?${query}` : path}>{children}</a>;
    },
}));

// The views get their data as props; the Participants tab reads its one hook.
const participants = vi.hoisted(() => ({ data: null as unknown }));

vi.mock("@/lib/api/queries", () => ({
    useV2Participants: () => ({ data: participants.data, error: null, isLoading: false }),
}));

// The evidence's ▷ timestamp reads the call player; none is mounted here.
vi.mock("@/lib/player/player-context", () => ({ usePlayer: () => ({ canSeek: false, engine: { seekMs: vi.fn() } }) }));

afterEach(cleanup);

const list = { error: null, hasNextPage: true, isFetchingNextPage: false, isLoading: false, onLoadMore: () => undefined };

describe("/people (`GET /v1/people`)", () => {
    it("the default list sends no `role` / `include_operators` (Data API 12.0 leaves call operators out); Role → Operators sends `role=operator`", () => {
        const request = peopleRequest({ company: "AAPL" });

        expect(request).toEqual({ company: "AAPL", event: undefined, limit: 50, q: undefined, role: undefined, sort: undefined });

        expect(request).not.toHaveProperty("include_operators");

        expect(peopleRequest({ company: "AAPL", role: "operator" }).role).toBe("operator");
    });

    it("each person links their page; role, latest title, calls; export and Load more", () => {
        render(<PeopleList {...list} pages={[V2_PEOPLE]} search={{}} />);

        expect(screen.getByRole("link", { name: "Richard Kramer" })).toHaveAttribute("href", `/people/${PERSON_ANALYST.person_id}`);

        const row = screen.getByRole("link", { name: "John Ternus" }).closest("tr")!;

        expect(within(row).getByText("Executive")).toBeInTheDocument();

        expect(within(row).getByText("CEO, Apple")).toBeInTheDocument();

        expect(screen.queryByText("Calls here")).toBeNull();

        expect(screen.getByRole("button", { name: /export/i })).toBeInTheDocument();

        expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument();
    });

    it("scoped to a company or a call: the per-scope counts the API answers then", () => {
        render(<PeopleList {...list} pages={[V2_PEOPLE]} search={{ company: "AAPL" }} />);

        expect(screen.getByText("Calls here")).toBeInTheDocument();

        expect(screen.getByText("Questions here")).toBeInTheDocument();
    });

    it("a fund named as the company: the API's 404 in its own words, not an empty table", () => {
        const error = new ApiRequestError(404, { error: "not_covered", message: "SPY is a fund, not a company: GET /v1/funds/SPY" });

        render(<PeopleList {...list} error={error} pages={[]} search={{ company: "SPY" }} />);

        expect(screen.getByText("SPY is a fund, not a company: GET /v1/funds/SPY")).toBeInTheDocument();
    });

    it("the plan gate is a notice", () => {
        const error = new ApiRequestError(403, { error: "plan_required", message: "Upgrade" });

        render(<PeopleList {...list} error={error} pages={[]} search={{}} />);

        expect(screen.getByText("Your plan does not include people")).toBeInTheDocument();
    });
});

describe("/people/$personId", () => {
    it("profile: role, calls, first / last seen (New York day), an analyst's questions and difficulty, other spellings", () => {
        render(<PersonProfileView error={null} isLoading={false} person={PERSON_ANALYST} />);

        expect(screen.getByText("Analyst")).toBeInTheDocument();

        expect(screen.getByText("Feb 26, 2026")).toBeInTheDocument();

        expect(screen.getByText("Nov 4, 2026")).toBeInTheDocument();

        expect(screen.getByText("0.55 · 5 scored")).toBeInTheDocument();

        expect(screen.getByText("Rete")).toBeInTheDocument();
    });

    it("an executive has no question facts", () => {
        render(<PersonProfileView error={null} isLoading={false} person={PERSON_EXECUTIVE} />);

        expect(screen.queryByText("Questions asked")).toBeNull();

        expect(screen.queryByText("Also written as")).toBeNull();
    });

    it("an unknown id: not found", () => {
        render(<PersonProfileView error={new ApiRequestError(404, { error: "not_found", message: "Not found" })} isLoading={false} person={null} />);

        expect(screen.getByText("No person with this id")).toBeInTheDocument();
    });

    it("calls: newest first, each linking its company and its call page; a failed event says so", () => {
        const failed = new Set<string>([EVENT_IDS.unknown]);

        render(<PersonCallsView {...list} calls={personCalls(PERSON_PARTICIPATIONS.data, PERSON_EVENTS)} failedEventIds={failed} hasNextPage={false} personName="Richard Kramer" />);

        const rows = screen.getAllByRole("row").slice(1);

        expect(within(rows[0]).getByRole("link", { name: "CRTO" })).toHaveAttribute("href", "/CRTO");

        expect(within(rows[0]).getByRole("link", { name: "Q3 FY2026" })).toHaveAttribute("href", `/CRTO/earnings-calls/${EVENT_IDS.crto}`);

        expect(within(rows[2]).getByText("Analyst, Rete")).toBeInTheDocument();

        expect(within(rows[3]).getAllByText("Not available").length).toBeGreaterThan(0);
    });

    it("role / firm history: stretches newest first with their dates and counts", () => {
        const stretches = roleHistory(personCalls(PERSON_PARTICIPATIONS.data, PERSON_EVENTS));

        render(<RoleHistoryView hasMore={false} stretches={stretches} undated={1} />);

        expect(screen.getByText("Oct 30, 2026 – Nov 4, 2026")).toBeInTheDocument();

        expect(screen.getByText("2 calls")).toBeInTheDocument();

        expect(screen.getByText(historyNote(false, 1))).toBeInTheDocument();

        expect(historyNote(true, 0)).toBe("The title and firm named on each call, from the loaded calls — load more calls for the older history.");

        expect(historyNote(false, 2)).toContain("2 without a known date are left out");
    });
});

describe("Participants tab", () => {
    const event: V2Event = { ...CALENDAR_EVENT, event_id: EVENT_IDS.aapl, symbol: "AAPL" };

    it("a resolved speaker links the person page; the people search opens scoped to the call and the company", () => {
        participants.data = {
            ...PERSON_PARTICIPATIONS,
            data: [PERSON_PARTICIPATIONS.data[0], { ...PERSON_PARTICIPATIONS.data[0], name: "Unresolved Speaker", person_id: null, speaker_label: "spk03" }],
        };

        const props = { event, eventId: event.event_id } as React.ComponentProps<typeof ParticipantsTab>;

        render(<ParticipantsTab {...props} />);

        expect(screen.getByRole("link", { name: "Richard Kramer" })).toHaveAttribute("href", `/people/${PERSON_ANALYST.person_id}`);

        expect(screen.queryByRole("link", { name: "Unresolved Speaker" })).toBeNull();

        expect(screen.getByRole("link", { name: "on this call" })).toHaveAttribute("href", `/people?event=${EVENT_IDS.aapl}`);

        expect(screen.getByRole("link", { name: "on every AAPL call" })).toHaveAttribute("href", "/people?company=AAPL");
    });
});
