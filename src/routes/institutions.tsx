import type { ColumnDef } from "@tanstack/react-table";

import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";

import type { V2FilerMatch, V2FilersResponse } from "@/lib/api/types";

import { DebouncedInput } from "@/components/navigation/debounced-input";
import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { filerCikParam } from "@/components/sec/security-link";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { FilterSelect } from "@/components/ui/filter-select";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { useV2FilersInfinite } from "@/lib/api/queries";
import { titleHead } from "@/lib/layout";
import { isV2GenuineEmpty } from "@/lib/sec/readiness";
import { IN_PLACE } from "@/lib/url-state";

const institutionsSearchSchema = z.object({
    q: z.string().trim().min(1).max(200).optional().catch(undefined),
    sort: z.enum(["name", "-name"]).optional().catch(undefined),
});

export const Route = createFileRoute("/institutions")({
    component: InstitutionsPage,
    head: () => titleHead("Institutions"),
    validateSearch: institutionsSearchSchema,
});

/** The `/sec/$cik` path parameter of a 10-digit CIK (unpadded). */
const cikParam = (cik: string) => filerCikParam(cik) ?? cik;

const COLUMNS: Array<ColumnDef<V2FilerMatch>> = [
    {
        cell: ({ row }) => (
            <Link
                className="font-medium underline-offset-4 hover:underline"
                params={{ cik: cikParam(row.original.cik) }}
                title="The manager's 13F portfolio and filings"
                to="/sec/$cik"
            >
                {row.original.name}
            </Link>
        ),
        header: "Institution",
        id: "name",
    },
    { cell: ({ row }) => <span className="tabular-nums">{cikParam(row.original.cik)}</span>, header: "CIK", id: "cik" },
    {
        cell: ({ row }) => (row.original.listing
            ? (
                    <Link className="underline-offset-4 hover:underline" params={{ ticker: row.original.listing.ticker }} to="/$ticker">
                        <Badge variant="secondary">{row.original.listing.ticker}</Badge>
                    </Link>
                )
            : <span className="text-muted-foreground">No ticker</span>),
        header: "Listing",
        id: "listing",
    },
    {
        cell: ({ row }) => <div className="max-w-[260px] truncate">{row.original.forms.slice(0, 6).join(", ") || "—"}</div>,
        header: "Forms",
        id: "forms",
    },
];

/** The 13F managers (pure). */
export function InstitutionsList({ error, hasNextPage, isFetchingNextPage, isLoading, onLoadMore, pages }: {
    error: unknown;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    onLoadMore: () => void;
    pages: ReadonlyArray<V2FilersResponse>;
}) {
    if (error && pages.length === 0) return <SecReadinessNotice error={error} title="Failed to load the institutions" />;

    const meta = pages.at(0)?.meta;

    return (
        <div className="flex flex-col gap-2">
            <DataTable
                columns={COLUMNS}
                emptyIsGenuine={isV2GenuineEmpty(meta?.coverage)}
                emptyText="No 13F manager matches this name."
                exportConfig={{ dataset: "institutions", scope: "13f" }}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                onLoadMore={onLoadMore}
                operationId="listFilers"
                rows={pages.flatMap(page => page.data)}
            />
            {error ? <SecReadinessNotice error={error} title="Failed to load more institutions" /> : null}
        </div>
    );
}

/**
 * The 13F institutions (`GET /v1/filers?phase=manager`, 1 credit a page, by cursor): name search and sort in the URL; a
 * row opens the manager's filer page with its 13F portfolio.
 */
function InstitutionsPage() {
    const search = Route.useSearch();

    const navigate = Route.useNavigate();

    const list = useV2FilersInfinite({ limit: 50, phase: "manager", q: search.q, sort: search.sort });

    return (
        <PageContainer>
            <PageHeader
                description="Investment managers that file 13F reports with the SEC. Each opens its filer page with its quarterly 13F portfolio."
                title="Institutions"
            />
            <FilterBar
                activeCount={[search.q, search.sort].filter(value => value !== undefined).length}
                onReset={() => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, q: undefined, sort: undefined }) })}
            >
                <FilterField label="Name" span={2}>
                    {id => (
                        <DebouncedInput
                            aria-label="Search institutions"
                            className="w-full"
                            id={id}
                            onCommit={q => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, q: q || undefined }) })}
                            placeholder="Any name"
                            value={search.q ?? ""}
                        />
                    )}
                </FilterField>
                <FilterField label="Sort">
                    {id => (
                        <FilterSelect
                            aria-label="Sort"
                            className="w-full"
                            id={id}
                            onValueChange={value => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, sort: value === "name" ? undefined : value }) })}
                            options={[{ label: "Name A–Z", value: "name" }, { label: "Name Z–A", value: "-name" }]}
                            value={search.sort ?? "name"}
                        />
                    )}
                </FilterField>
            </FilterBar>
            <InstitutionsList
                error={list.error}
                hasNextPage={list.hasNextPage}
                isFetchingNextPage={list.isFetchingNextPage}
                isLoading={list.isLoading}
                onLoadMore={() => void list.fetchNextPage()}
                pages={list.data?.pages ?? []}
            />
        </PageContainer>
    );
}
