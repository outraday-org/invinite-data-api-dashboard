import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

import type { SecPanelTarget } from "@/components/sec/sec-source-panel";
import type { SecFilingsResponse } from "@/lib/api/types";

import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { SecSourceDialog } from "@/components/sec/sec-source-panel";
import { useCompanyFiscalPeriods, useSecFilingsInfinite } from "@/lib/api/queries";
import { fiscalPeriodIndex, formTypesOfFacet, toFilingListRow } from "@/lib/sec/parity";

import type { FilingHtmlTarget } from "./-components/html-dialog";

import { FilingsHeader } from "./-components/filings-header";
import { FilingsList } from "./-components/filings-list";
import { HtmlDialog } from "./-components/html-dialog";

export const Route = createFileRoute("/$ticker/filings/")({
    component: FilingsPage,
});

/** Filings per page of `/v1/sec/filings` (one page per `next_cursor`). */
const FILINGS_PAGE = 40;

function FilingsPage() {
    const { ticker } = Route.useParams();

    const [formTypeFilter, setFormTypeFilter] = React.useState<null | string>(null);

    const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("desc");

    const [htmlDialog, setHtmlDialog] = React.useState<FilingHtmlTarget | null>(null);

    // The SEC store's documents of one accession (the source panel).
    const [secTarget, setSecTarget] = React.useState<null | SecPanelTarget>(null);

    // `/v1/sec/filings` (ticker or CIK), newest first by default, one page per `next_cursor`.
    const {
        data: pagedData,
        error: errorPaged,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading: loadingPaged,
    } = useSecFilingsInfinite({
        form: formTypeFilter ?? undefined,
        identifier: ticker,
        limit: FILINGS_PAGE,
        order: sortDirection,
    });

    // Fiscal / calendar quarters by `report_date` = `period_end` (one request set per company, never per row).
    const { data: fiscalPeriods } = useCompanyFiscalPeriods(ticker);

    const periods = React.useMemo(() => fiscalPeriodIndex(fiscalPeriods ?? []), [fiscalPeriods]);

    const pages: ReadonlyArray<SecFilingsResponse> = React.useMemo(() => pagedData?.pages ?? [], [pagedData]);

    const displayFilings = React.useMemo(
        () => pages.flatMap(page => (page.filings ?? []).flatMap((row) => {
            const filing = toFilingListRow(row, periods);

            return filing ? [filing] : [];
        })),
        [pages, periods],
    );

    // The form-type picker = the filer's `form_facet`; the last one seen stays while a filtered list loads.
    const facetForms = React.useMemo(() => formTypesOfFacet(pages.at(0)?.form_facet), [pages]);

    const [availableFormTypes, setAvailableFormTypes] = React.useState<{ forms: Array<string>; ticker: string }>({ forms: [], ticker });

    React.useEffect(() => {
        if (facetForms.length > 0) setAvailableFormTypes({ forms: facetForms, ticker });
    }, [facetForms, ticker]);

    const formTypes = availableFormTypes.ticker === ticker ? availableFormTypes.forms : [];

    let content: React.ReactNode;

    if (errorPaged && pages.length === 0) {
        content = <SecReadinessNotice error={errorPaged} title="Failed to load filings" />;
    }
    else {
        content = (
            <>
                <SecReadinessNotice readiness={pages.at(-1)?.readiness} />
                <FilingsList
                    displayFilings={displayFilings}
                    hasNextPage={hasNextPage}
                    isFetchingNextPage={isFetchingNextPage}
                    isLoading={loadingPaged}
                    onFetchNextPage={() => fetchNextPage()}
                    onOpenHtml={filing => setHtmlDialog({ ...filing, ticker })}
                    onOpenSecDocuments={filing => setSecTarget({
                        accession: filing.accessionNumber,
                        kind: "filing",
                        title: `${ticker} · ${filing.formType} · ${filing.accessionNumber}`,
                    })}
                    onSortToggle={() => setSortDirection(prev => (prev === "desc" ? "asc" : "desc"))}
                    sortDirection={sortDirection}
                />
                {errorPaged ? <SecReadinessNotice error={errorPaged} title="Failed to load more filings" /> : null}
            </>
        );
    }

    return (
        <div className="space-y-4 relative flex flex-col h-0 grow">
            <HtmlDialog
                dialog={htmlDialog}
                onOpenChange={(open) => {
                    if (!open) setHtmlDialog(null);
                }}
                onOpenDocuments={(filing) => {
                    setHtmlDialog(null);

                    setSecTarget({
                        accession: filing.accessionNumber,
                        kind: "filing",
                        title: `${filing.ticker} · ${filing.formType} · ${filing.accessionNumber}`,
                    });
                }}
                ticker={ticker}
            />

            <SecSourceDialog onClose={() => setSecTarget(null)} target={secTarget} />

            <FilingsHeader
                availableFormTypes={formTypes}
                formTypeFilter={formTypeFilter}
                loadingFormTypes={loadingPaged && formTypes.length === 0}
                onFormTypeChange={val => setFormTypeFilter(val === "all" ? null : val)}
                sortDirection={sortDirection}
            />

            {content}
        </div>
    );
}
