import type { ColumnDef } from "@tanstack/react-table";

import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";

import type { V2Event, V2ParticipantsResponse, V2Person } from "@/lib/api/types";
import type { PersonCall, RoleStretch } from "@/lib/people";

import { SpeakerAvatar } from "@/components/earnings/speaker-avatar";
import { PeopleState } from "@/components/people/people-state";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useV2EventsById, useV2Person, useV2PersonParticipationsInfinite } from "@/lib/api/queries";
import { eventLabel } from "@/lib/earnings/format";
import { percent } from "@/lib/earnings/labels";
import { formatDay, formatNumber } from "@/lib/format";
import { titleHead } from "@/lib/layout";
import { PERSON_ANCHORS, PERSON_ID_PATTERN, personCalls, personDetail, personRoleLabel, roleHistory } from "@/lib/people";
import { EventLink } from "@/routes/$ticker/earnings-calls/-components/event-link";

export const Route = createFileRoute("/people/$personId")({
    component: PersonPage,
    head: () => titleHead("Person"),
});

const NEW_YORK = "America/New_York";

/** Calls per page of the person's list: each loaded call also asks its event (`GET /v1/events/{id}`, 1 credit). */
export const PERSON_CALLS_PAGE = 25;

function Fact({ children, label }: { children: React.ReactNode; label: string }) {
    return (
        <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd className="tabular-nums">{children}</dd>
        </div>
    );
}

/** The person's profile: role, latest title / firm, calls, first / last seen, an analyst's questions, other spellings (pure). */
export function PersonProfileView({ error, isLoading, person }: { error: unknown; isLoading: boolean; person: null | V2Person }) {
    if (error) return <PeopleState error={error} notFound="No person with this id" title="Failed to load the person" />;

    if (isLoading || !person) return <Skeleton className="h-24 w-full" />;

    const isAnalyst = person.role === "analyst";

    return (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
            <Fact label="Role"><Badge variant="outline">{personRoleLabel(person)}</Badge></Fact>
            <Fact label="Calls">{formatNumber(person.appearance_count)}</Fact>
            <Fact label="First seen">{formatDay(person.first_seen, NEW_YORK)}</Fact>
            <Fact label="Last seen">{formatDay(person.last_seen, NEW_YORK)}</Fact>
            {isAnalyst && <Fact label="Questions asked">{formatNumber(person.questions)}</Fact>}
            {isAnalyst && person.mean_difficulty !== null && (
                <Fact label="Mean question difficulty">
                    <span title="How pointed the scored questions were (0–1), across every covered call: a description, not a rating">
                        {`${person.mean_difficulty.toFixed(2)} · ${formatNumber(person.scored_question_count)} scored`}
                    </span>
                </Fact>
            )}
            {(person.aliases?.length ?? 0) > 0 && (
                <div className="col-span-full flex flex-col gap-0.5">
                    <dt className="text-muted-foreground text-xs">Also written as</dt>
                    <dd>{person.aliases?.join(" · ")}</dd>
                </div>
            )}
        </dl>
    );
}

/** The calls table's columns: when, which company, which call, and the title / firm the person had on it. */
function callColumns(failed: ReadonlySet<string>): Array<ColumnDef<PersonCall>> {
    const pending = (call: PersonCall) => (failed.has(call.participation.event_id)
        ? <span className="text-muted-foreground">Not available</span>
        : <Skeleton className="h-4 w-20" />);

    return [
        {
            cell: ({ row }) => (row.original.event
                ? <span className="tabular-nums">{formatDay(row.original.event.scheduled_at, NEW_YORK)}</span>
                : pending(row.original)),
            header: "Date",
            id: "date",
        },
        {
            cell: ({ row }) => {
                const event = row.original.event;

                if (!event) return pending(row.original);

                return (
                    <span className="flex min-w-0 items-center gap-2">
                        <Link className="underline-offset-4 hover:underline" params={{ ticker: event.symbol }} to="/$ticker">
                            <Badge variant="secondary">{event.symbol}</Badge>
                        </Link>
                        <span className="text-muted-foreground max-w-[220px] truncate">{event.company_name}</span>
                    </span>
                );
            },
            header: "Company",
            id: "company",
        },
        {
            cell: ({ row }) => (row.original.event
                ? <EventLink className="font-medium underline-offset-4 hover:underline" event={row.original.event}>{eventLabel(row.original.event)}</EventLink>
                : pending(row.original)),
            header: "Call",
            id: "call",
        },
        {
            cell: ({ row }) => <div className="max-w-[260px] whitespace-normal">{row.original.participation.title ?? "—"}</div>,
            header: "Title on the call",
            id: "title",
        },
        { cell: ({ row }) => row.original.participation.firm ?? "—", header: "Firm", id: "firm" },
        {
            cell: ({ row }) => <span className="tabular-nums">{percent(row.original.participation.confidence, 0)}</span>,
            header: "Naming confidence",
            id: "confidence",
        },
    ];
}

/** Every call the person spoke on, newest first once its event is known (pure). */
export function PersonCallsView({ calls, error, failedEventIds, hasNextPage, isFetchingNextPage, isLoading, onLoadMore, personName }: {
    calls: Array<PersonCall>;
    error: unknown;
    failedEventIds: ReadonlySet<string>;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    onLoadMore: () => void;
    personName: string;
}) {
    if (error && calls.length === 0) return <PeopleState error={error} notFound="No calls stored for this person" title="Failed to load the calls" />;

    return (
        <div className="flex flex-col gap-2">
            <DataTable
                columns={callColumns(failedEventIds)}
                emptyText="No call of this person is stored yet."
                exportConfig={{ dataset: "calls", scope: personName }}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                onLoadMore={onLoadMore}
                operationId="listParticipants"
                rows={calls}
            />
            {error ? <PeopleState error={error} title="Failed to load more calls" /> : null}
        </div>
    );
}

/** The line under the history: where the titles come from and what is not in it yet. */
export function historyNote(hasMore: boolean, undated: number) {
    const more = hasMore ? " — load more calls for the older history" : "";

    const left = undated > 0 ? `; ${formatNumber(undated)} without a known date ${undated === 1 ? "is" : "are"} left out` : "";

    return `The title and firm named on each call, from the loaded calls${more}${left}.`;
}

/** The role / firm history: stretches of the same title and firm, newest first (pure). */
export function RoleHistoryView({ hasMore, stretches, undated }: { hasMore: boolean; stretches: ReadonlyArray<RoleStretch>; undated: number }) {
    if (stretches.length === 0) {
        return <Notice title={undated > 0 ? "Waiting for the calls' dates" : "No role or firm stated on the loaded calls"} />;
    }

    return (
        <div className="flex flex-col gap-2">
            <ol className="flex flex-col gap-2">
                {stretches.map(stretch => (
                    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-l-2 pl-3" key={`${stretch.from}-${stretch.title ?? ""}-${stretch.firm ?? ""}`}>
                        <span className="font-medium">{stretch.title ?? "No title stated"}</span>
                        {stretch.firm && <span className="text-muted-foreground">{stretch.firm}</span>}
                        <span className="text-muted-foreground tabular-nums">
                            {stretch.from === stretch.to
                                ? formatDay(stretch.from, NEW_YORK)
                                : `${formatDay(stretch.from, NEW_YORK)} – ${formatDay(stretch.to, NEW_YORK)}`}
                        </span>
                        <span className="text-muted-foreground tabular-nums">{`${formatNumber(stretch.calls)} ${stretch.calls === 1 ? "call" : "calls"}`}</span>
                    </li>
                ))}
            </ol>
            <p className="text-muted-foreground text-xs">
                {historyNote(hasMore, undated)}
            </p>
        </div>
    );
}

/** The history block: a skeleton while the calls load, nothing to derive when they failed (the calls block says why). */
function PersonHistoryBlock({ calls, failed, hasMore, isLoading }: { calls: ReadonlyArray<PersonCall>; failed: boolean; hasMore: boolean; isLoading: boolean }) {
    if (isLoading) return <Skeleton className="h-16 w-full" />;

    if (failed && calls.length === 0) return <Notice title="No history without the calls" />;

    return <RoleHistoryView hasMore={hasMore} stretches={roleHistory(calls)} undated={calls.filter(call => call.event === null).length} />;
}

/** The loaded participations' events by id, and the ids whose event could not be read. */
function useCallEvents(pages: ReadonlyArray<V2ParticipantsResponse>) {
    const ids = React.useMemo(() => [...new Set(pages.flatMap(page => page.data.map(row => row.event_id)))], [pages]);

    const results = useV2EventsById(ids);

    const events = new Map<string, V2Event>();

    const failed = new Set<string>();

    results.forEach((result, index) => {
        if (result.data) events.set(ids[index], result.data);
        else if (result.error) failed.add(ids[index]);
    });

    return { events, failed };
}

/**
 * One person (`GET /v1/people/{person_id}`) with every call they spoke on (`GET /v1/participants?person=`, one row per
 * call, 25 a page) and the role / firm history those calls state. A participation names its call only by id, so each
 * loaded call also asks its event (`GET /v1/events/{event_id}`, the call page's own query: opening the call is cached).
 * The sidebar's person context links the three blocks (`PERSON_ANCHORS`).
 */
function PersonPage() {
    const { personId: rawId } = Route.useParams();

    const personId = PERSON_ID_PATTERN.test(rawId) ? rawId.toLowerCase() : "";

    const person = useV2Person(personId);

    const participations = useV2PersonParticipationsInfinite({ limit: PERSON_CALLS_PAGE, personId });

    const pages = React.useMemo(() => participations.data?.pages ?? [], [participations.data]);

    const { events, failed } = useCallEvents(pages);

    const calls = personCalls(pages.flatMap(page => page.data), events);

    const name = person.data?.name ?? "Person";

    if (!personId) return <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8"><Notice badge="Not found" title="This is not a person id" /></div>;

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 lg:px-8">
            <section className="flex scroll-mt-20 flex-col gap-4" id={PERSON_ANCHORS.profile}>
                <PageHeader
                    description={person.data ? personDetail(person.data) : null}
                    title={(
                        <span className="flex items-center gap-2">
                            {person.data && <SpeakerAvatar imageUrl={person.data.image_url} name={person.data.name} size="md" speakerRole={person.data.role} />}
                            {name}
                        </span>
                    )}
                />
                <PersonProfileView error={person.error} isLoading={person.isLoading} person={person.data} />
            </section>

            <section className="flex scroll-mt-20 flex-col gap-2" id={PERSON_ANCHORS.calls}>
                <h3 className="text-sm font-semibold">Calls</h3>
                <PersonCallsView
                    calls={calls}
                    error={participations.error}
                    failedEventIds={failed}
                    hasNextPage={participations.hasNextPage}
                    isFetchingNextPage={participations.isFetchingNextPage}
                    isLoading={participations.isLoading}
                    onLoadMore={() => void participations.fetchNextPage()}
                    personName={name}
                />
            </section>

            <section className="flex scroll-mt-20 flex-col gap-2" id={PERSON_ANCHORS.history}>
                <h3 className="text-sm font-semibold">Role & firm history</h3>
                <PersonHistoryBlock calls={calls} failed={Boolean(participations.error)} hasMore={participations.hasNextPage} isLoading={participations.isLoading} />
            </section>
        </div>
    );
}
