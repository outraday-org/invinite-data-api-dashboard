import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { z } from "zod";

import type { SecPanelTarget } from "@/components/sec/sec-source-panel";
import type { V2FilingsResponse } from "@/lib/api/types";

import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { SecSourceDialog } from "@/components/sec/sec-source-panel";
import { useCompanyFiscalPeriods, useInstrument, useV2FilingsInfinite } from "@/lib/api/queries";
import { tickerHead } from "@/lib/layout";
import { fiscalPeriodIndex, formTypesOfFacet, toFilingListRow } from "@/lib/sec/parity";
import { isV2GenuineEmpty } from "@/lib/sec/readiness";
import { IN_PLACE, optionalAccession, optionalEnum, optionalText } from "@/lib/url-state";

import type { FilingHtmlTarget } from "./-components/html-dialog";

import { FilingsHeader } from "./-components/filings-header";
import { FilingsList } from "./-components/filings-list";
import { HtmlDialog } from "./-components/html-dialog";

/**
 * `?form=` (one form type of the facet), `?sort=asc` (oldest filed first; default newest), `?filing=<accession>` (the
 * HTML view of a loaded row; a filing outside the loaded pages opens its documents instead), `?docs=<accession>` (the
 * SEC source panel of that accession).
 */
const filingsSearchSchema = z.object({
    docs: optionalAccession(),
    filing: optionalAccession(),
    form: optionalText(20),
    sort: optionalEnum(["asc"]),
});

type FilingsSearch = z.infer<typeof filingsSearchSchema>;

export const Route = createFileRoute("/$ticker/filings/")({
    component: FilingsPage,
    head: ({ params }) => tickerHead(params.ticker, "Filings"),
    validateSearch: filingsSearchSchema,
});

/** Filings per page of `/v1/filings` (one page per `next_cursor`). */
const FILINGS_PAGE = 40;

function FilingsPage() {
    const { ticker } = Route.useParams();

    const search = Route.useSearch();

    const navigate = Route.useNavigate();

    const onChange = (patch: FilingsSearch) => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, ...patch }) });

    const formTypeFilter = search.form ?? null;

    const sortDirection = search.sort ?? "desc";

    // `/v1/filings?symbol=<ticker>`, newest filed first by default (`-filed_at`), one page per `next_cursor`.
    const {
        data: pagedData,
        error: errorPaged,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading: loadingPaged,
    } = useV2FilingsInfinite({
        form: formTypeFilter ? [formTypeFilter] : undefined,
        limit: FILINGS_PAGE,
        sort: sortDirection === "desc" ? "-filed_at" : "filed_at",
        symbol: ticker,
    });

    // Fiscal / calendar quarters by `report_date` = `period_end` (one request set per company, never per row); only for
    // an instrument that has fiscal periods (a fund's filings stay unlabelled, no 404 per page view).
    const { data: instrument } = useInstrument(ticker);

    const { data: fiscalPeriods } = useCompanyFiscalPeriods(instrument?.datasets.includes("fiscal_periods") ? ticker : "");

    const periods = React.useMemo(() => fiscalPeriodIndex(fiscalPeriods ?? []), [fiscalPeriods]);

    const pages: ReadonlyArray<V2FilingsResponse> = React.useMemo(() => pagedData?.pages ?? [], [pagedData]);

    const displayFilings = React.useMemo(
        () => pages.flatMap(page => page.data.flatMap((row) => {
            const filing = toFilingListRow(row, periods);

            return filing ? [filing] : [];
        })),
        [pages, periods],
    );

    // The form-type picker = the company's `meta.form_facet`; the last one seen stays while a filtered list loads.
    const facetForms = React.useMemo(() => formTypesOfFacet(pages.at(0)?.meta.form_facet), [pages]);

    const [availableFormTypes, setAvailableFormTypes] = React.useState<{ forms: Array<string>; ticker: string }>({ forms: [], ticker });

    React.useEffect(() => {
        if (facetForms.length > 0) setAvailableFormTypes({ forms: facetForms, ticker });
    }, [facetForms, ticker]);

    const formTypes = availableFormTypes.ticker === ticker ? availableFormTypes.forms : [];

    // The open HTML view: the loaded row of `?filing=`; not loaded (once the first page is in) = its documents panel.
    const filingRow = search.filing ? displayFilings.find(row => row.accessionNumber === search.filing) : undefined;

    const htmlDialog: FilingHtmlTarget | null = filingRow ? { ...filingRow, ticker } : null;

    const docsAccession = search.docs ?? (search.filing && !filingRow && !loadingPaged ? search.filing : undefined);

    const docsRow = docsAccession ? displayFilings.find(row => row.accessionNumber === docsAccession) : undefined;

    // The SEC store's documents of one accession (the source panel).
    const secTarget: null | SecPanelTarget = docsAccession
        ? { accession: docsAccession, kind: "filing", title: [ticker, docsRow?.formType, docsAccession].filter(Boolean).join(" · ") }
        : null;

    let content: React.ReactNode;

    if (errorPaged && pages.length === 0) {
        content = <SecReadinessNotice error={errorPaged} title="Failed to load filings" />;
    }
    else {
        content = (
            <>
                <SecReadinessNotice coverage={pages.at(0)?.meta.coverage} />
                <FilingsList
                    displayFilings={displayFilings}
                    emptyIsGenuine={isV2GenuineEmpty(pages.at(0)?.meta.coverage)}
                    errorState={errorPaged ? <SecReadinessNotice error={errorPaged} title="Failed to load more filings" /> : null}
                    hasNextPage={hasNextPage}
                    isFetchingNextPage={isFetchingNextPage}
                    isLoading={loadingPaged}
                    onFetchNextPage={() => fetchNextPage()}
                    onOpenHtml={filing => onChange({ docs: undefined, filing: filing.accessionNumber })}
                    onOpenSecDocuments={filing => onChange({ docs: filing.accessionNumber, filing: undefined })}
                    onSortToggle={() => onChange({ sort: sortDirection === "desc" ? "asc" : undefined })}
                    sortDirection={sortDirection}
                    ticker={ticker}
                />
            </>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <HtmlDialog
                dialog={htmlDialog}
                onOpenChange={(open) => {
                    if (!open) onChange({ filing: undefined });
                }}
                onOpenDocuments={filing => onChange({ docs: filing.accessionNumber, filing: undefined })}
                ticker={ticker}
            />

            <SecSourceDialog onClose={() => onChange({ docs: undefined, filing: undefined })} target={secTarget} />

            <FilingsHeader
                availableFormTypes={formTypes}
                formTypeFilter={formTypeFilter}
                loadingFormTypes={loadingPaged && formTypes.length === 0}
                onFormTypeChange={val => onChange({ form: val === "all" || !val ? undefined : val })}
                sortDirection={sortDirection}
            />

            {content}
        </div>
    );
}
