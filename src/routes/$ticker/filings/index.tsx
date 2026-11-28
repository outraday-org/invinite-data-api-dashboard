import { createFileRoute, Link } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import * as React from "react";
import { z } from "zod";

import type { SecPanelTarget } from "@/components/sec/sec-source-panel";
import type { V2FilingsResponse } from "@/lib/api/types";
import type { FilingListRow } from "@/lib/sec/parity";

import { AlertEntryPoints, ENTRY_TYPES } from "@/components/alerts/create-alert-button";
import { LIVE_FILINGS_PLAN_NOTE, LiveStopNotice, LiveToggle } from "@/components/live/live-toggle";
import { SecFilingSearch } from "@/components/sec/sec-filing-search";
import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { SecSourceDialog } from "@/components/sec/sec-source-panel";
import { Button } from "@/components/ui/button";
import { useCompanyFiscalPeriods, useInstrument, useV2FilingsInfinite } from "@/lib/api/queries";
import { instrumentSubject } from "@/lib/instruments";
import { tickerHead } from "@/lib/layout";
import { liveOn, liveParam, useLiveDefault } from "@/lib/live/live-default";
import { commaList, hasLiveForm, isFilingOf, mergeLiveRows, toLiveFilingRow } from "@/lib/live/live-filings";
import { facetSummary, fiscalPeriodIndex, formTypesOfFacet, toFilingListRow } from "@/lib/sec/parity";
import { isV2GenuineEmpty } from "@/lib/sec/readiness";
import { IN_PLACE, optionalAccession, optionalDay, optionalEnum, optionalFlag, optionalText } from "@/lib/url-state";

import type { FilingHtmlTarget } from "./-components/html-dialog";

import { FilingsHeader } from "./-components/filings-header";
import { FilingsList } from "./-components/filings-list";
import { HtmlDialog } from "./-components/html-dialog";
import { useLiveFilingsFeed } from "./-components/use-live-filings-feed";

/**
 * `?form=` (one form type of the facet), `?items=` (8-K items, comma list), `?from=&to=` (filed days, inclusive),
 * `?sort=asc` (oldest filed first; default newest), `?live=false` / `?live=true` (new filings over the stream on top; on by default when the key's plan reaches the stream, `useLiveDefault`), `?search=true`
 * (the SEC filing search box; `?source=<version id>&block=<block id>` = a cited passage), `?filing=<accession>` (the
 * HTML view of a loaded row; a filing outside the loaded pages opens its documents instead), `?docs=<accession>` (the
 * SEC source panel of that accession).
 */
/**
 * `?items=`: the router reads a bare `?items=2.02` as the number 2.02 (JSON search values); an 8-K item is written with
 * two decimals, so a number is read back as such (`2.1` → `2.10`).
 */
const itemsParam = z.preprocess(value => (typeof value === "number" ? value.toFixed(2) : value), z.string().trim().min(1).max(60)).optional().catch(undefined);

const filingsSearchSchema = z.object({
    block: z.string().regex(/^b\d+$/).optional().catch(undefined),
    docs: optionalAccession(),
    filing: optionalAccession(),
    form: optionalText(20),
    from: optionalDay(),
    items: itemsParam,
    live: optionalFlag(),
    search: optionalFlag(),
    sort: optionalEnum(["asc"]),
    source: z.uuid().optional().catch(undefined),
    to: optionalDay(),
});

type FilingsSearch = z.infer<typeof filingsSearchSchema>;

export const Route = createFileRoute("/$ticker/filings/")({
    component: FilingsPage,
    head: ({ params }) => tickerHead(params.ticker, "Filings"),
    validateSearch: filingsSearchSchema,
});

/** Filings per page of `/v1/filings` (one page per `next_cursor`). */
const FILINGS_PAGE = 40;

const detailsLink = (filing: FilingListRow) => (
    <Link className="text-primary hover:underline" params={{ accession: filing.accessionNumber }} title="Facts, notes, review chain, holdings and parties of this filing" to="/filings/$accession">
        Details
    </Link>
);

function FilingsPage() {
    const { ticker } = Route.useParams();

    const { data: instrument } = useInstrument(ticker);

    const subject = instrument ? instrumentSubject(instrument) : ticker;

    const search = Route.useSearch();

    const navigate = Route.useNavigate();

    const onChange = (patch: FilingsSearch) => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, ...patch }) });

    const formTypeFilter = search.form ?? null;

    const sortDirection = search.sort ?? "desc";

    const items = commaList(search.items);

    // `/v1/filings?symbol=<ticker>`, newest filed first by default (`-filed_at`), one page per `next_cursor`.
    const {
        data: pagedData,
        error: errorPaged,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading: loadingPaged,
        refetch,
    } = useV2FilingsInfinite({
        form: formTypeFilter ? [formTypeFilter] : undefined,
        from: search.from,
        items: items.length > 0 ? items : undefined,
        limit: FILINGS_PAGE,
        sort: sortDirection === "desc" ? "-filed_at" : "filed_at",
        symbol: subject,
        to: search.to,
    });

    // Fiscal / calendar quarters by `report_date` = `period_end` (one request set per company, never per row); only for
    // an instrument that has fiscal periods (a fund's filings stay unlabelled, no 404 per page view).
    const { data: fiscalPeriods } = useCompanyFiscalPeriods(instrument?.datasets.includes("fiscal_periods") ? ticker : "");

    const periods = React.useMemo(() => fiscalPeriodIndex(fiscalPeriods ?? []), [fiscalPeriods]);

    const pages: ReadonlyArray<V2FilingsResponse> = React.useMemo(() => pagedData?.pages ?? [], [pagedData]);

    const listedFilings = React.useMemo(
        () => pages.flatMap(page => page.data.flatMap((row) => {
            const filing = toFilingListRow(row, periods);

            return filing ? [filing] : [];
        })),
        [pages, periods],
    );

    // Live: new filings whose primary ticker is this page's, on top of a newest-first list without a date / items
    // filter (a live frame carries no 8-K items and is filed today).
    const liveApplies = sortDirection === "desc" && !search.to && items.length === 0;

    const liveByDefault = useLiveDefault();

    const liveEnabled = liveOn(search.live, liveByDefault);

    const live = useLiveFilingsFeed({
        enabled: liveEnabled,
        onReconnected: () => void refetch(),
        onStopped: () => onChange({ live: liveParam(false, liveByDefault) }),
    });

    const liveRows = liveApplies
        ? live.filings
                .filter(({ filing }) => isFilingOf(filing, ticker) && hasLiveForm(filing, formTypeFilter ? [formTypeFilter] : []))
                .map(({ filing }) => toLiveFilingRow(filing))
        : [];

    const displayFilings = mergeLiveRows(liveRows, listedFilings);

    // The form-type picker = the company's `meta.form_facet`; the last one seen stays while a filtered list loads.
    const facet = pages.at(0)?.meta.form_facet;

    const facetForms = React.useMemo(() => formTypesOfFacet(facet), [facet]);

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

    // The SEC store's documents of one accession, or a search hit's cited passage (the source panel).
    let secTarget: null | SecPanelTarget = null;

    if (docsAccession) secTarget = { accession: docsAccession, kind: "filing", title: [ticker, docsRow?.formType, docsAccession].filter(Boolean).join(" · ") };
    else if (search.source && search.block) secTarget = { blockId: search.block, kind: "citation", title: `${ticker} · SEC filing`, versionId: search.source };

    const onOpenCitation = (target: SecPanelTarget) => {
        if (target.kind === "citation") onChange({ block: target.blockId, docs: undefined, source: target.versionId });
        else onChange({ docs: target.accession });
    };

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
                    // `items` is applied to the store's pages: an empty page with `has_more` is no "No filings found".
                    emptyIsGenuine={isV2GenuineEmpty(pages.at(0)?.meta.coverage) && !hasNextPage}
                    errorState={errorPaged ? <SecReadinessNotice error={errorPaged} title="Failed to load more filings" /> : null}
                    hasNextPage={hasNextPage}
                    isFetchingNextPage={isFetchingNextPage}
                    isLoading={loadingPaged}
                    onFetchNextPage={() => fetchNextPage()}
                    onOpenHtml={filing => onChange({ docs: undefined, filing: filing.accessionNumber })}
                    onOpenSecDocuments={filing => onChange({ docs: filing.accessionNumber, filing: undefined })}
                    onSortToggle={() => onChange({ sort: sortDirection === "desc" ? "asc" : undefined })}
                    renderDetailsLink={detailsLink}
                    sortDirection={sortDirection}
                    ticker={ticker}
                />
            </>
        );
    }

    // The filter bar's filters (the filed-day range counts once); the sort is the table header's toggle.
    const activeCount = [search.form, search.items, search.from || search.to].filter(Boolean).length;

    return (
        <div className="flex flex-col gap-6">
            <HtmlDialog
                dialog={htmlDialog}
                onOpenChange={(open) => {
                    if (!open) onChange({ filing: undefined });
                }}
                onOpenDocuments={filing => onChange({ docs: filing.accessionNumber, filing: undefined })}
                ticker={ticker}
            />

            <SecSourceDialog onClose={() => onChange({ block: undefined, docs: undefined, filing: undefined, source: undefined })} target={secTarget} />

            <FilingsHeader
                actions={(
                    <>
                        <AlertEntryPoints symbol={ticker} types={ENTRY_TYPES.filings} />
                        <LiveToggle
                            listening="Listening for new filings"
                            live={liveEnabled}
                            mode={live.mode}
                            onChange={(on) => {
                                live.clearStop();

                                onChange({ live: liveParam(on, liveByDefault) });
                            }}
                        />
                    </>
                )}
                activeCount={activeCount}
                availableFormTypes={formTypes}
                facetLine={facetSummary(facet, formTypeFilter)}
                formTypeFilter={formTypeFilter}
                from={search.from}
                items={search.items}
                loadingFormTypes={loadingPaged && formTypes.length === 0}
                onFormTypeChange={val => onChange({ form: val === "all" || !val ? undefined : val })}
                onItemsChange={value => onChange({ items: value.trim() || undefined })}
                onRangeChange={patch => onChange(patch)}
                onReset={() => onChange({ form: undefined, from: undefined, items: undefined, to: undefined })}
                sortDirection={sortDirection}
                to={search.to}
                trailing={(
                    <Button aria-pressed={search.search === true} onClick={() => onChange({ search: search.search ? undefined : true })} type="button" variant={search.search ? "default" : "outline"}>
                        <SearchIcon />
                        Search text
                    </Button>
                )}
            />

            <LiveStopNotice planNote={LIVE_FILINGS_PLAN_NOTE} stop={live.stop} />
            {liveEnabled && !liveApplies && (
                <div className="text-muted-foreground text-xs" role="status">Live filings join a newest-first list without an end date or 8-K items filter.</div>
            )}
            {liveEnabled && liveApplies && (
                <div className="text-muted-foreground text-xs" role="status">{`Live adds new filings whose primary ticker is ${ticker.toUpperCase()}, from when Live was switched on.`}</div>
            )}

            {search.search && (
                <SecFilingSearch
                    onOpen={onOpenCitation}
                    renderFilingLink={accession => (
                        <Link className="text-primary text-xs hover:underline" params={{ accession }} to="/filings/$accession">
                            Filing details
                        </Link>
                    )}
                    symbol={subject}
                />
            )}

            {content}
        </div>
    );
}
