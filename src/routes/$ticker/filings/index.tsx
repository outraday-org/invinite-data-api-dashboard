import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

import type { SecPanelTarget } from "@/components/sec/sec-source-panel";

import { SecSourceDialog } from "@/components/sec/sec-source-panel";
import { ErrorState } from "@/components/ui/error-state";
import { useAvailableFormTypes, useFilingsInfinite } from "@/lib/api/queries";

import { FilingsHeader } from "./-components/filings-header";
import { FilingsList } from "./-components/filings-list";
import { HtmlDialog } from "./-components/html-dialog";

export const Route = createFileRoute("/$ticker/filings/")({
    component: FilingsPage,
});

function FilingsPage() {
    const { ticker } = Route.useParams();

    const [formTypeFilter, setFormTypeFilter] = React.useState<null | string>(null);

    const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("desc");

    const [htmlDialog, setHtmlDialog] = React.useState<null | {
        url: string;
        ticker: string;
        formType: string;
        accessionNumber: string;
        filingDate: string;
        fiscalQuarter: null | number;
        fiscalYear: null | number;
    }>(null);

    // Additive (task 7 switches the list itself to `/v1/sec/filings`): the SEC store's documents of one accession.
    const [secTarget, setSecTarget] = React.useState<null | SecPanelTarget>(null);

    // Fetch available form types for this identifier (ticker or CIK)
    const {
        data: availableFormTypesData,
        error: errorFormTypes,
        isLoading: loadingFormTypes,
    } = useAvailableFormTypes({
        identifier: ticker,
    });

    // Fetch filings paginated (offset-based) when filter is applied
    const {
        data: pagedData,
        error: errorPaged,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading: loadingPaged,
    } = useFilingsInfinite({
        formType: formTypeFilter ?? undefined,
        identifier: ticker,
        limit: 40,
        sort: sortDirection,
    });

    const displayFilings = React.useMemo(
        () => pagedData?.pages.flatMap(page => page.companies[0]?.filings ?? []) ?? [],
        [pagedData],
    );

    const availableFormTypes = React.useMemo(
        () => availableFormTypesData?.form_types ?? [],
        [availableFormTypesData],
    );

    const isLoading = loadingFormTypes || loadingPaged;

    const error = errorFormTypes ?? errorPaged;

    let content: React.ReactNode;

    if (error) {
        content = <ErrorState error={error} title="Failed to load filings" />;
    }
    else {
        content = (
            <FilingsList
                displayFilings={displayFilings}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                onFetchNextPage={() => fetchNextPage()}
                onOpenHtml={(filing, url) => {
                    setHtmlDialog({
                        accessionNumber: filing.accession_number,
                        filingDate: filing.filing_date,
                        fiscalQuarter: filing.fiscal_quarter,
                        fiscalYear: filing.fiscal_year,
                        formType: filing.form_type,
                        ticker,
                        url,
                    });
                }}
                onOpenSecDocuments={filing => setSecTarget({
                    accession: filing.accession_number,
                    kind: "filing",
                    title: `${ticker} · ${filing.form_type} · ${filing.accession_number}`,
                })}
                onSortToggle={() => setSortDirection(prev => (prev === "desc" ? "asc" : "desc"))}
                sortDirection={sortDirection}
            />
        );
    }

    return (
        <div className="space-y-4 relative flex flex-col h-0 grow">
            <HtmlDialog
                dialog={htmlDialog}
                onOpenChange={(open) => {
                    if (!open) setHtmlDialog(null);
                }}
                ticker={ticker}
            />

            <SecSourceDialog onClose={() => setSecTarget(null)} target={secTarget} />

            <FilingsHeader
                availableFormTypes={availableFormTypes}
                formTypeFilter={formTypeFilter}
                loadingFormTypes={loadingFormTypes}
                onFormTypeChange={val => setFormTypeFilter(val === "all" ? null : val)}
                sortDirection={sortDirection}
            />

            {content}
        </div>
    );
}
