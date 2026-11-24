import type { ColumnDef } from "@tanstack/react-table";

import { Link } from "@tanstack/react-router";

import type { MacroSeries } from "@/lib/api/macro";

import { DataTable } from "@/components/ui/data-table";
import { ErrorState } from "@/components/ui/error-state";
import { MACRO_PAGES, TENORS } from "@/lib/api/macro";
import { useMacroCatalog } from "@/lib/api/macro-queries";
import { OPERATIONS } from "@/lib/api/operations.gen";
import { useAutoLoadPages } from "@/lib/api/use-auto-load-pages";

import { MacroAvailability } from "./macro-availability";

const columns: Array<ColumnDef<MacroSeries>> = [
    {
        cell: ({ row: { original: r } }) => (
            <Link
                className="font-medium underline"
                search={
                    r.family === "yield_curve"
                        ? { tenor: TENORS.find(t => t === r.tenor), view: "history" }
                        : { series: r.series_id, view: "history" }
                }
                to={MACRO_PAGES[r.family].path}
            >
                {r.label}
                <span className="block text-muted-foreground">{r.series_id}</span>
            </Link>
        ),
        header: "Series",
        id: "series_id",
    },
    { accessorFn: r => MACRO_PAGES[r.family].title, header: "Family" },
    {
        cell: ({ row: { original: r } }) => (
            <a className="underline" href={r.source_url} rel="noreferrer" target="_blank">
                {r.agency}
            </a>
        ),
        header: "Agency",
        id: "agency",
    },
    { accessorKey: "unit", header: "Unit" },
    { accessorKey: "frequency", header: "Frequency" },
    { accessorKey: "seasonal_adjustment", header: "Adjustment" },
    { accessorFn: r => r.first_date ?? "No coverage", header: "First" },
    { accessorFn: r => r.last_date ?? "No coverage", header: "Latest" },
];

export function MacroCatalog(props: { filter?: string }) {
    return <MacroAvailability><MacroCatalogContent {...props} /></MacroAvailability>;
}

function MacroCatalogContent({ filter = "" }: { filter?: string }) {
    const query = useMacroCatalog();

    useAutoLoadPages(query);

    const term = filter.trim().toLowerCase();

    const rows = (query.data?.pages.flatMap(page => page.data) ?? []).filter(r =>
        [r.series_id, r.label, r.agency, r.source_code, r.unit, r.family, r.seasonal_adjustment, r.frequency].some(
            v => v.toLowerCase().includes(term),
        ),
    );

    return (
        <section className="space-y-3">
            <a className="text-muted-foreground underline" href={OPERATIONS.listMacroSeries.docsUrl}>
                Macro series reference
            </a>
            <DataTable
                columns={columns}
                emptyText="No matching macro series."
                errorState={query.error ? <ErrorState error={query.error} title="Could not load macro series" /> : null}
                exportConfig={{ dataset: "macro-series", scope: "us" }}
                hasNextPage={query.hasNextPage}
                isFetchingNextPage={query.isFetchingNextPage}
                isLoading={query.isLoading}
                onLoadMore={() => void query.fetchNextPage()}
                operationId="listMacroSeries"
                rows={rows}
            />
        </section>
    );
}
