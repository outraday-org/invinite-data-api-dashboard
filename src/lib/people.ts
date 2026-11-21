import type { V2Event, V2Participation, V2PeopleSort, V2Person, V2PersonRole } from "@/lib/api/types";

/**
 * People (backend tasks/data-api-dashboard O7 group 1): who speaks on calls, across calls (`/v1/people`,
 * `/v1/people/{person_id}`, `/v1/participants?person=`). Pure helpers of `/people`, `/people/$personId`, the search's
 * People group and the sidebar's person context.
 */

/** The `role=` filter of `GET /v1/people`, in display order. */
export const PERSON_ROLES = ["executive", "analyst", "operator", "other"] as const satisfies ReadonlyArray<V2PersonRole>;

export const PERSON_ROLE_LABELS: Record<V2PersonRole, string> = {
    analyst: "Analyst",
    executive: "Executive",
    operator: "Operator",
    other: "Other",
};

/** The plural of a role (the filter's options). */
export const PERSON_ROLE_PLURALS: Record<V2PersonRole, string> = {
    analyst: "Analysts",
    executive: "Executives",
    operator: "Operators",
    other: "Others",
};

/** `sort=` of `GET /v1/people` (the API's default is `-last_seen`: the URL omits it). */
export const PEOPLE_SORTS = ["-last_seen", "last_seen", "name", "-name"] as const satisfies ReadonlyArray<V2PeopleSort>;

export const PEOPLE_SORT_LABELS: Record<V2PeopleSort, string> = {
    "-last_seen": "Seen most recently",
    "-name": "Name Z–A",
    "last_seen": "Seen longest ago",
    "name": "Name A–Z",
};

/** The default order of the API (`-last_seen`). */
export const DEFAULT_PEOPLE_SORT: V2PeopleSort = "-last_seen";

/** The role of a person: `kind` names the investor-relations host the four `role`s fold into `executive`. */
export function personRoleLabel(person: Pick<V2Person, "kind" | "role">): string {
    if (person.kind === "ir_host") return "Investor relations";

    return PERSON_ROLE_LABELS[person.role];
}

/** "Richard Kramer · Analyst" (the sidebar's context label); "Person" while unknown. */
export function personSubjectLabel(person: null | Pick<V2Person, "kind" | "name" | "role"> | undefined): string {
    return person ? `${person.name} · ${personRoleLabel(person)}` : "Person";
}

/** The person's latest title, else the latest firm ("Analyst, Arete Research"); null without either. */
export function personDetail(person: Pick<V2Person, "current_firm" | "current_title" | "firm">): null | string {
    return person.current_title?.trim() || person.current_firm?.trim() || person.firm?.trim() || null;
}

/**
 * A call the person spoke on: their participation and its event (`GET /v1/events/{id}`; null while it loads or when it
 * failed — a participation names its event only by id).
 */
export type PersonCall = { event: null | V2Event; participation: V2Participation };

/**
 * The calls newest first by the event's `scheduled_at`; a call whose event is not known yet keeps the API's order
 * after the dated ones.
 */
export function personCalls(participations: ReadonlyArray<V2Participation>, events: ReadonlyMap<string, V2Event>): Array<PersonCall> {
    const calls = participations.map((participation, index) => ({
        call: { event: events.get(participation.event_id) ?? null, participation },
        index,
    }));

    return calls
        .sort((a, b) => {
            const at = a.call.event?.scheduled_at;

            const bt = b.call.event?.scheduled_at;

            if (at && bt) return bt.localeCompare(at) || a.index - b.index;

            if (at) return -1;

            if (bt) return 1;

            return a.index - b.index;
        })
        .map(entry => entry.call);
}

/** One stretch of the role / firm history: the same title and firm on consecutive calls. */
export type RoleStretch = {
    calls: number;
    firm: null | string;
    /** `scheduled_at` of the first and the last call of the stretch. */
    from: string;
    title: null | string;
    to: string;
};

const sameText = (a: null | string, b: null | string) => (a?.trim().toLowerCase() ?? "") === (b?.trim().toLowerCase() ?? "");

/**
 * The role / firm history from the calls whose date is known: consecutive calls with the same title and firm (as said
 * on each call) form one stretch; newest stretch first. Calls without a known event are left out (no date to place
 * them).
 */
export function roleHistory(calls: ReadonlyArray<PersonCall>): Array<RoleStretch> {
    const dated = calls
        .filter((call): call is { event: V2Event; participation: V2Participation } => call.event !== null)
        .sort((a, b) => a.event.scheduled_at.localeCompare(b.event.scheduled_at));

    const stretches: Array<RoleStretch> = [];

    for (const { event, participation } of dated) {
        const last = stretches.at(-1);

        if (last && sameText(last.title, participation.title) && sameText(last.firm, participation.firm)) {
            last.calls += 1;

            last.to = event.scheduled_at;

            continue;
        }

        stretches.push({ calls: 1, firm: participation.firm, from: event.scheduled_at, title: participation.title, to: event.scheduled_at });
    }

    return stretches.reverse();
}

/** The in-page blocks of `/people/$personId` (the sidebar's person context links them). */
export const PERSON_ANCHORS = {
    calls: "calls",
    history: "role-history",
    profile: "profile",
} as const;

/** A person id (a UUID): `/people/$personId` and the sidebar ask nothing for anything else. */
export const PERSON_ID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
