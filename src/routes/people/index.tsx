import type { ColumnDef } from "@tanstack/react-table";

import { createFileRoute } from "@tanstack/react-router";
import { XIcon } from "lucide-react";
import { z } from "zod";

import type { V2PeopleResponse, V2PeopleSort, V2Person, V2PersonRole } from "@/lib/api/types";

import { SpeakerAvatar } from "@/components/earnings/speaker-avatar";
import { DebouncedInput } from "@/components/navigation/debounced-input";
import { PeopleState } from "@/components/people/people-state";
import { PersonLink } from "@/components/people/person-link";
import { CompanyFilter } from "@/components/search/company-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { FilterSelect } from "@/components/ui/filter-select";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { useV2PeopleInfinite } from "@/lib/api/queries";
import { joinCompanyList, parseCompanyList } from "@/lib/company-list";
import { formatDay, formatNumber } from "@/lib/format";
import { titleHead } from "@/lib/layout";
import {
    DEFAULT_PEOPLE_SORT,
    PEOPLE_SORT_LABELS,
    PEOPLE_SORTS,
    PERSON_ROLE_PLURALS,
    PERSON_ROLES,
    personDetail,
    personRoleLabel,
} from "@/lib/people";
import { IN_PLACE, optionalCompanyList, optionalEnum, optionalText } from "@/lib/url-state";

/** `?q=` (name), `?company=` (ticker or CIK), `?event=` (one call), `?role=`, `?sort=` (absent = `-last_seen`). */
const peopleSearchSchema = z.object({
    company: optionalCompanyList(),
    event: z.uuid().optional().catch(undefined),
    q: optionalText(200),
    role: optionalEnum(PERSON_ROLES),
    sort: optionalEnum(PEOPLE_SORTS),
});

export type PeopleSearch = z.infer<typeof peopleSearchSchema>;

export const Route = createFileRoute("/people/")({
    component: PeoplePage,
    head: () => titleHead("People"),
    validateSearch: peopleSearchSchema,
});

const NEW_YORK = "America/New_York";

/** The table's columns; `scoped` (a company or a call is set) adds the per-scope counts the API answers then. */
export function peopleColumns(scoped: boolean): Array<ColumnDef<V2Person>> {
    const columns: Array<ColumnDef<V2Person>> = [
        {
            cell: ({ row }) => (
                <span className="flex items-center gap-2">
                    <SpeakerAvatar imageUrl={row.original.image_url} name={row.original.name} size="md" speakerRole={row.original.role} />
                    <PersonLink className="font-medium" personId={row.original.person_id}>{row.original.name}</PersonLink>
                </span>
            ),
            header: "Person",
            id: "name",
        },
        { cell: ({ row }) => <Badge variant="outline">{personRoleLabel(row.original)}</Badge>, header: "Role", id: "role" },
        {
            cell: ({ row }) => <div className="max-w-[320px] whitespace-normal">{personDetail(row.original) ?? "—"}</div>,
            header: "Latest title / firm",
            id: "detail",
        },
        {
            cell: ({ row }) => <span className="tabular-nums">{formatNumber(row.original.appearance_count)}</span>,
            header: "Calls",
            id: "appearance_count",
        },
    ];

    if (scoped) {
        columns.push(
            { cell: ({ row }) => <span className="tabular-nums">{formatNumber(row.original.appearances)}</span>, header: "Calls here", id: "appearances" },
            { cell: ({ row }) => <span className="tabular-nums">{formatNumber(row.original.questions)}</span>, header: "Questions here", id: "questions" },
        );
    }

    columns.push({
        cell: ({ row }) => <span className="tabular-nums">{formatDay(row.original.last_seen, NEW_YORK)}</span>,
        header: "Last seen",
        id: "last_seen",
    });

    return columns;
}

/** The people of a search (pure). */
export function PeopleList({ error, hasNextPage, isFetchingNextPage, isLoading, onLoadMore, pages, search }: {
    error: unknown;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    onLoadMore: () => void;
    pages: ReadonlyArray<V2PeopleResponse>;
    search: PeopleSearch;
}) {
    if (error && pages.length === 0) return <PeopleState error={error} title="Failed to load people" />;

    const scoped = Boolean(search.company || search.event);

    return (
        <div className="flex flex-col gap-2">
            <DataTable
                columns={peopleColumns(scoped)}
                emptyText={search.q ? `Nobody named “${search.q}” matches these filters.` : "Nobody matches these filters."}
                exportConfig={{ dataset: "people", scope: search.company ?? (search.event ? "call" : "all") }}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                onLoadMore={onLoadMore}
                operationId="listPeople"
                rows={pages.flatMap(page => page.data)}
            />
            {error ? <PeopleState error={error} title="Failed to load more people" /> : null}
        </div>
    );
}

const ALL_ROLES = "all";

const ROLE_OPTIONS: Array<{ label: string; value: typeof ALL_ROLES | V2PersonRole }> = [
    { label: "Every role", value: ALL_ROLES },
    ...PERSON_ROLES.map(role => ({ label: PERSON_ROLE_PLURALS[role], value: role })),
];

const SORT_OPTIONS: Array<{ label: string; value: V2PeopleSort }> = PEOPLE_SORTS.map(sort => ({ label: PEOPLE_SORT_LABELS[sort], value: sort }));

/**
 * The request of a search state: the API's default leaves call operators out; `role=operator` (Role → Operators) lists
 * them. Nothing else is sent for them (no `include_operators`).
 */
export function peopleRequest(search: PeopleSearch) {
    return { company: search.company, event: search.event, limit: 50, q: search.q, role: search.role, sort: search.sort };
}

/**
 * People who speak on calls (`GET /v1/people`, 1 credit a page, by cursor): executives and analysts; call operators only
 * under Role → Operators (Data API 12.0 leaves them out unless `role=operator`). Name,
 * company, role and sort are filters (all in the URL); `?event=` (from a call's Participants tab) scopes the list to one
 * call. A row opens the person's page.
 */
function PeoplePage() {
    const search = Route.useSearch();

    const navigate = Route.useNavigate();

    const onChange = (patch: Partial<PeopleSearch>) => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, ...patch }) });

    const list = useV2PeopleInfinite(peopleRequest(search));

    return (
        <PageContainer>
            <PageHeader
                description="Executives and analysts who speak on earnings calls, recognised across calls. Call operators are listed only under Role → Operators. Each opens the person's page with every call they spoke on."
                title="People"
            />
            <FilterBar
                activeCount={[search.q, search.company, search.role, search.sort, search.event].filter(value => value !== undefined).length}
                onReset={() => onChange({ company: undefined, event: undefined, q: undefined, role: undefined, sort: undefined })}
            >
                <FilterField label="Name">
                    {id => (
                        <DebouncedInput
                            aria-label="Search people by name"
                            className="w-full"
                            id={id}
                            onCommit={q => onChange({ q: q || undefined })}
                            placeholder="Any name"
                            value={search.q ?? ""}
                        />
                    )}
                </FilterField>
                <FilterField label="Companies" span={2}>
                    {id => <CompanyFilter id={id} onChange={companies => onChange({ company: joinCompanyList(companies) })} value={parseCompanyList(search.company)} />}
                </FilterField>
                <FilterField label="Role">
                    {id => (
                        <FilterSelect
                            aria-label="Role"
                            className="w-full"
                            id={id}
                            onValueChange={role => onChange({ role: role === ALL_ROLES ? undefined : role })}
                            options={ROLE_OPTIONS}
                            value={search.role ?? ALL_ROLES}
                        />
                    )}
                </FilterField>
                <FilterField label="Sort">
                    {id => (
                        <FilterSelect
                            aria-label="Sort"
                            className="w-full"
                            id={id}
                            onValueChange={sort => onChange({ sort: sort === DEFAULT_PEOPLE_SORT ? undefined : sort })}
                            options={SORT_OPTIONS}
                            value={search.sort ?? DEFAULT_PEOPLE_SORT}
                        />
                    )}
                </FilterField>
            </FilterBar>
            {search.event && (
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">People of one call</Badge>
                    <Button onClick={() => onChange({ event: undefined })} size="sm" variant="ghost">
                        <XIcon />
                        Every call
                    </Button>
                </div>
            )}
            <PeopleList
                error={list.error}
                hasNextPage={list.hasNextPage}
                isFetchingNextPage={list.isFetchingNextPage}
                isLoading={list.isLoading}
                onLoadMore={() => void list.fetchNextPage()}
                pages={list.data?.pages ?? []}
                search={search}
            />
        </PageContainer>
    );
}
