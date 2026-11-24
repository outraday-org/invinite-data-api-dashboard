import type { ColumnDef } from "@tanstack/react-table";

import { createFileRoute } from "@tanstack/react-router";

import type { V2DatasetsResponse, V2SecDataset } from "@/lib/api/types";

import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { DataTable } from "@/components/ui/data-table";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { useV2DatasetsInfinite } from "@/lib/api/queries";
import { DASH, formatDay } from "@/lib/format";
import { titleHead } from "@/lib/layout";
import { isV2GenuineEmpty } from "@/lib/sec/readiness";

export const Route = createFileRoute("/sec/datasets")({
    component: SecDatasetsPage,
    head: () => titleHead("SEC data sets"),
});

/** What each SEC bulk data set is (the API names it by its SEC code). */
export const DATASET_LABELS: Partial<Record<string, string>> = {
    f13: "Form 13F (institutional holdings)",
    f345: "Forms 3, 4 and 5 (insider transactions)",
    formd: "Form D (private offerings)",
    fsn: "Financial statement and notes",
    icsc: "Investment company series and classes",
    ncen: "Form N-CEN (fund census)",
    nport: "Form N-PORT (fund holdings)",
    rr: "Mutual fund prospectus risk / return summaries",
};

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
];

/** The SEC data sets the filings routes serve (pure): newest release each, its date and forms. */
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
                exportConfig={{ dataset: "datasets", scope: "sec" }}
                isLoading={isLoading}
                operationId="listDatasets"
                rows={pages.flatMap(page => page.data)}
            />
        </div>
    );
}

/** `/sec/datasets`: the SEC bulk data set releases behind the filings, facts, holdings and insider routes (`GET /v1/datasets`). */
function SecDatasetsPage() {
    const datasets = useV2DatasetsInfinite();

    return (
        <PageContainer>
            <PageHeader
                description="The SEC bulk data sets the API serves, with the newest release of each: a filing's facts and notes, 13F and N-PORT holdings, insider transactions and Form D offerings come from them."
                title="SEC data sets"
            />
            <SecDatasetsView error={datasets.error} isLoading={datasets.isLoading} pages={datasets.data?.pages ?? []} />
        </PageContainer>
    );
}
