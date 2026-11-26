import type { ColumnDef } from "@tanstack/react-table";

import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";
import { z } from "zod";

import type { V2DatasetsResponse, V2SecDataset } from "@/lib/api/types";
import type { BulkFilesSearch, BulkTab } from "@/lib/sec/bulk";

import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { DataTable } from "@/components/ui/data-table";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBulkFilesInfinite, useKeyState, useV2DatasetsInfinite } from "@/lib/api/queries";
import { DASH, formatDay } from "@/lib/format";
import { titleHead, WRAPPING_TABS_LIST_CLASS } from "@/lib/layout";
import { BULK_FILE_DATASETS, BULK_KINDS, BULK_TAB_LABELS, BULK_TABS, bulkFilesQuery, bulkPlanGate, formatsOf } from "@/lib/sec/bulk";
import { DATASET_LABELS } from "@/lib/sec/datasets";
import { isV2GenuineEmpty } from "@/lib/sec/readiness";
import { IN_PLACE, optionalDay, optionalEnum, optionalFlag } from "@/lib/url-state";

import { BulkExportsTab } from "./-components/bulk-exports-tab";
import { BulkFilesView } from "./-components/bulk-files-view";
import { BulkPlanNotice } from "./-components/bulk-plan-notice";

/**
 * `?tab=exports|releases` (absent = Files); the Files filters `?dataset=&kind=&format=&from=&to=&superseded=true`
 * (`from` / `to` = the SEC release day); `?export=<export id>` = the open export's detail (Company exports tab).
 */
export const secBulkSearchSchema = z.object({
    dataset: optionalEnum(BULK_FILE_DATASETS),
    export: z.string().regex(/^bx_[0-9A-HJKMNP-TV-Z]{26}$/).optional().catch(undefined),
    format: optionalEnum(formatsOf(undefined) as readonly ["zip", "csv", "csv_gz", "parquet"]),
    from: optionalDay(),
    kind: optionalEnum(BULK_KINDS),
    superseded: optionalFlag(),
    tab: optionalEnum(BULK_TABS),
    to: optionalDay(),
});

export type SecBulkSearch = z.infer<typeof secBulkSearchSchema>;

export const Route = createFileRoute("/sec/datasets")({
    component: SecBulkDataPage,
    head: () => titleHead("SEC bulk data"),
    validateSearch: secBulkSearchSchema,
});

/** A ticker for the per-company pages: the insider data has no market-wide list. */
const EXAMPLE_TICKER = "AAPL";

const LINK_CLASS = "text-primary hover:underline";

/** The page that shows a data set's rows (with its own filters); an unknown code has none. */
function DatasetPageLink({ dataset }: { dataset: string }) {
    switch (dataset) {
        case "f13":
            return <Link className={LINK_CLASS} to="/institutions">Institutions</Link>;
        case "f345":
            return (
                <Link className={LINK_CLASS} params={{ ticker: EXAMPLE_TICKER }} to="/$ticker/insider-trades">
                    Insider trades (per company, e.g.
                    {EXAMPLE_TICKER}
                    )
                </Link>
            );
        case "formd":
            return <Link className={LINK_CLASS} to="/offerings">Private offerings</Link>;
        case "fsn":
            return <Link className={LINK_CLASS} to="/filings">Filings (a filing&apos;s Facts and Notes tabs)</Link>;
        case "icsc":
        case "ncen":
        case "nport":
        case "rr":
            return <Link className={LINK_CLASS} to="/funds">Funds</Link>;
        default:
            return <span className="text-muted-foreground">{DASH}</span>;
    }
}

const COLUMNS: Array<ColumnDef<V2SecDataset>> = [
    {
        cell: ({ row }) => (
            <div className="flex flex-col">
                <span className="font-medium">{DATASET_LABELS[row.original.dataset] ?? row.original.dataset}</span>
                <span className="text-muted-foreground text-xs">{row.original.dataset}</span>
            </div>
        ),
        header: "Data set",
        id: "dataset",
    },
    { cell: ({ row }) => <span className="tabular-nums">{row.original.release}</span>, header: "Newest release", id: "release" },
    { cell: ({ row }) => <span className="tabular-nums">{row.original.released_at ? formatDay(row.original.released_at) : DASH}</span>, header: "Released", id: "released_at" },
    {
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.forms.join(", ") || "—"}</span>,
        header: "Forms it covers",
        id: "forms",
    },
    { cell: ({ row }) => <DatasetPageLink dataset={row.original.dataset} />, header: "Where to see it", id: "page" },
];

/** The Releases tab (pure): the SEC data sets the filings routes serve, newest release each, its date and forms. */
export function SecDatasetsView({ error, isLoading, pages }: { error: unknown; isLoading: boolean; pages: ReadonlyArray<V2DatasetsResponse> }) {
    if (error && pages.length === 0) return <SecReadinessNotice error={error} title="Failed to load the SEC data sets" />;

    const meta = pages.at(0)?.meta;

    return (
        <div className="flex flex-col gap-2">
            <SecReadinessNotice coverage={meta?.coverage} />
            <DataTable
                columns={COLUMNS}
                emptyIsGenuine={isV2GenuineEmpty(meta?.coverage)}
                emptyText="No SEC data set is served."
                isLoading={isLoading}
                operationId="listDatasets"
                rows={pages.flatMap(page => page.data)}
            />
        </div>
    );
}

const PAGE_DESCRIPTION = (
    <>
        The SEC bulk data sets as files: the SEC&apos;s own release files of all eight data sets, parsed period files of
        13F, Forms 3/4/5, Form D and N-PORT (one row per record with issuer identifiers, CSV.gz and Parquet), and company
        exports filtered by companies and a date range. A download link is valid for 15 minutes; bulk data costs 0
        credits and is capped per account (today: 500 downloads and 50 exports per UTC day, 5 exports running at a time).
    </>
);

/** What a tab shows while the key gate still waits for `/v1/me` (nothing is asked yet). */
function GateSkeleton() {
    return <Skeleton className="h-40 w-full" />;
}

/**
 * `/sec/datasets` "SEC bulk data" (Data API 12.2, backend tasks/sec-bulk-downloads task 8; every operation Enterprise,
 * 0 credits): Files (`GET /v1/bulk/files` + downloads), Company exports (create, list, detail, downloads) and Releases
 * (`GET /v1/datasets`, the newest release per data set). A key without the Enterprise plan sees one notice per tab and
 * the page asks nothing; only the open tab asks.
 */
function SecBulkDataPage() {
    const search = Route.useSearch();

    const navigate = Route.useNavigate();

    const onChange = React.useCallback((patch: Partial<SecBulkSearch>) => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, ...patch }) }), [navigate]);

    const tab: BulkTab = search.tab ?? "files";

    const key = useKeyState();

    const filesGate = bulkPlanGate(key, "listBulkFiles");

    const releasesGate = bulkPlanGate(key, "listDatasets");

    const filesSearch: BulkFilesSearch = search;

    const files = useBulkFilesInfinite(bulkFilesQuery(filesSearch), tab === "files" && filesGate === "allowed");

    const datasets = useV2DatasetsInfinite(tab === "releases" && releasesGate === "allowed");

    const onOpenExport = React.useCallback((exportId: string) => onChange({ export: exportId }), [onChange]);

    return (
        <PageContainer>
            <PageHeader description={PAGE_DESCRIPTION} title="SEC bulk data" />

            <Tabs className="gap-4" onValueChange={value => onChange({ tab: value === "files" ? undefined : value as BulkTab })} value={tab}>
                <TabsList aria-label="Bulk data" className={WRAPPING_TABS_LIST_CLASS} variant="line">
                    {BULK_TABS.map(value => <TabsTrigger key={value} value={value}>{BULK_TAB_LABELS[value]}</TabsTrigger>)}
                </TabsList>

                <TabsContent value="files">
                    {filesGate === "refused" && <BulkPlanNotice />}
                    {filesGate === "checking" && <GateSkeleton />}
                    {filesGate === "allowed" && (
                        <BulkFilesView
                            error={files.error}
                            hasNextPage={files.hasNextPage}
                            isFetchingNextPage={files.isFetchingNextPage}
                            isLoading={files.isLoading}
                            onChange={onChange}
                            onLoadMore={() => void files.fetchNextPage()}
                            pages={files.data?.pages ?? []}
                            search={filesSearch}
                        />
                    )}
                </TabsContent>

                <TabsContent value="exports">
                    {filesGate === "refused" && <BulkPlanNotice />}
                    {filesGate === "checking" && <GateSkeleton />}
                    {filesGate === "allowed" && tab === "exports" && (
                        <BulkExportsTab enabled onClose={() => onChange({ export: undefined })} onOpen={onOpenExport} openExportId={search.export} />
                    )}
                </TabsContent>

                <TabsContent value="releases">
                    {releasesGate === "refused" && <BulkPlanNotice title="The SEC data set releases are part of the Enterprise plan" />}
                    {releasesGate === "checking" && <GateSkeleton />}
                    {releasesGate === "allowed" && <SecDatasetsView error={datasets.error} isLoading={datasets.isLoading} pages={datasets.data?.pages ?? []} />}
                </TabsContent>
            </Tabs>
        </PageContainer>
    );
}
