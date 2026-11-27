import type { ColumnDef } from "@tanstack/react-table";

import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";
import { z } from "zod";

import type { SecPanelTarget } from "@/components/sec/sec-source-panel";
import type { LatestFilingRow } from "@/lib/live/live-filings";

import { LIVE_FILINGS_PLAN_NOTE, LiveStopNotice, LiveToggle } from "@/components/live/live-toggle";
import { DebouncedInput } from "@/components/navigation/debounced-input";
import { SecFilingSearch } from "@/components/sec/sec-filing-search";
import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { SecSourceDialog } from "@/components/sec/sec-source-panel";
import { filerCikParam } from "@/components/sec/security-link";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { KeysetPagerNav } from "@/components/ui/keyset-pager";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { useLatestFilingsPage } from "@/lib/api/queries";
import { DASH, formatDay, formatInstant } from "@/lib/format";
import { firstPage, nextPage, pageCursor, pageNumber, pagerFor, previousPage } from "@/lib/keyset-pager";
import { titleHead } from "@/lib/layout";
import { liveOn, liveParam, useLiveDefault } from "@/lib/live/live-default";
import { commaList, hasLiveForm, mergeLatest } from "@/lib/live/live-filings";
import { useArrivalFlash } from "@/lib/live/use-arrival-flash";
import { IN_PLACE, optionalDay, optionalFlag, optionalText } from "@/lib/url-state";
import { useLiveFilingsFeed } from "@/routes/$ticker/filings/-components/use-live-filings-feed";

/**
 * `?live=false` (the live feed off; on by default when the key's plan reaches the stream, `useLiveDefault`;
 * `?live=true` switches it on otherwise; the old `?paused=true` still reads as off), `?form=` (the list's forms, comma
 * list: sent to `/v1/filings` as `form` and applied to the live frames in the browser), the market-wide search's filters
 * `?searchForm=&searchItem=&filedFrom=&filedTo=` (applied on Search) and
 * `?source=<version id>&block=<block id>` (a hit's cited passage).
 */
/** `?searchItem=7`: the router reads a bare number as a number (JSON search values); a section id is text. */
const sectionItemsParam = z.preprocess(value => (typeof value === "number" ? String(value) : value), z.string().trim().min(1).max(200)).optional().catch(undefined);

const filingsSearchSchema = z.object({
    block: z.string().regex(/^b\d+$/).optional().catch(undefined),
    filedFrom: optionalDay(),
    filedTo: optionalDay(),
    form: optionalText(60),
    live: optionalFlag(),
    /** Before 2026-11-27 the switch was `?paused=true`: an old link still turns it off. */
    paused: optionalFlag(),
    searchForm: optionalText(20),
    searchItem: sectionItemsParam,
    source: z.uuid().optional().catch(undefined),
});

export const Route = createFileRoute("/filings/")({
    component: FilingsPage,
    head: () => titleHead("Filings"),
    validateSearch: filingsSearchSchema,
});

const linkClass = "underline-offset-4 hover:underline";

/** The filer of a row: its instrument's filings when it has a ticker, else its filer page by name, else by CIK. */
function LatestFiler({ row }: { row: LatestFilingRow }) {
    const cik = filerCikParam(row.cik);

    if (row.ticker) {
        return (
            <span className="flex min-w-0 items-center gap-2">
                <Link className={linkClass} params={{ ticker: row.ticker }} to="/$ticker/filings">
                    <Badge variant="secondary">{row.ticker}</Badge>
                </Link>
                {row.filerName && <span className="text-muted-foreground truncate">{row.filerName}</span>}
            </span>
        );
    }

    if (!cik) return <span>{DASH}</span>;

    return <Link className={linkClass} params={{ cik }} to="/sec/$cik">{row.filerName ?? `CIK ${cik}`}</Link>;
}

const LATEST_COLUMNS: Array<ColumnDef<LatestFilingRow>> = [
    {
        // The acceptance instant when known: an after-hours filing carries the next business day as its filing date.
        cell: ({ row }) => (
            <span className="tabular-nums whitespace-nowrap" title={`Filing date ${formatDay(row.original.filedDay)}`}>
                {row.original.filedAt ? formatInstant(row.original.filedAt) : formatDay(row.original.filedDay)}
            </span>
        ),
        header: "Filed",
        id: "filed",
    },
    { cell: ({ row }) => <span className="font-semibold">{row.original.form}</span>, header: "Form", id: "form" },
    { cell: ({ row }) => <LatestFiler row={row.original} />, header: "Filer", id: "filer" },
    {
        cell: ({ row }) => {
            const proposed = row.original.proposedTickers;

            return proposed.length > 0 ? <span title="Tickers the registration statement proposes">{proposed.join(", ")}</span> : DASH;
        },
        header: "Proposed tickers",
        id: "proposed",
    },
    { cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{formatDay(row.original.periodEnd)}</span>, header: "Period", id: "period" },
    {
        cell: ({ row }) => (
            <Link className="text-primary hover:underline" params={{ accession: row.original.accession }} to="/filings/$accession">
                {row.original.accession}
            </Link>
        ),
        header: "Filing",
        id: "accession",
    },
];

/** The text of an empty list (no REST row, no live row). */
export function latestEmptyText(forms: ReadonlyArray<string>, paused: boolean) {
    const none = forms.length > 0 ? `No ${forms.join(", ")} filings in the last 7 days.` : "No filings in the last 7 days.";

    return paused ? `${none} The live feed is off.` : none;
}

const rowIdOf = (row: LatestFilingRow) => row.accession;

/**
 * The latest filings (pure): the REST page with the live rows merged on top (page 1), a flashing row marked
 * `row-arrive`, the REST error above the table (live rows stay), skeleton rows while page 1 loads, under any live rows,
 * the keyset pager under it (hidden while there is one page).
 */
export function LatestFilingsView({
    error,
    flashing,
    forms,
    isLoading,
    pager,
    paused,
    rows,
}: {
    error: unknown;
    flashing: ReadonlySet<string>;
    forms: ReadonlyArray<string>;
    isLoading: boolean;
    pager: Omit<React.ComponentProps<typeof KeysetPagerNav>, "label">;
    paused: boolean;
    rows: Array<LatestFilingRow>;
}) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            {error ? <SecReadinessNotice error={error} operationId="listFilings" title="Failed to load the latest filings" /> : null}
            <DataTable
                columns={LATEST_COLUMNS}
                emptyIsGenuine={!error}
                emptyText={latestEmptyText(forms, paused)}
                exportConfig={{ dataset: "latest-filings", scope: "sec" }}
                getRowId={rowIdOf}
                isLoading={isLoading}
                rowClassName={row => (flashing.has(row.accession) ? "row-arrive" : undefined)}
                rows={rows}
                skeletonBelowRows
            />
            <KeysetPagerNav {...pager} label="Filings pages" />
        </div>
    );
}

const arrivedAtOf = (row: LatestFilingRow) => row.arrivedAt;

/**
 * Every filer's SEC filings (`/filings`): the newest filings of every filer (`/v1/filings` without `symbol`, Data API
 * 12.3: the last 7 New York days, newest first, one page per keyset cursor), the filings arriving over the stream's
 * `filings` channel on top of page 1 (once per accession; a row that arrives after the list loaded flashes), and a
 * full-text search across every filer (`/v1/search/filings` without `symbol`; its cap is stated).
 */
function FilingsPage() {
    const search = Route.useSearch();

    const navigate = Route.useNavigate();

    const onChange = (patch: z.infer<typeof filingsSearchSchema>) => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, ...patch }) });

    const liveByDefault = useLiveDefault();

    const liveEnabled = liveOn(search.live ?? (search.paused ? false : undefined), liveByDefault);

    const paused = !liveEnabled;

    const forms = commaList(search.form);

    // A changed form filter starts a new list at page 1.
    const filterKey = forms.join(",");

    const [storedPager, setPager] = React.useState(() => firstPage(filterKey));

    const pager = pagerFor(storedPager, filterKey);

    const page = pageNumber(pager);

    const list = useLatestFilingsPage({ cursor: pageCursor(pager), form: forms });

    // The stream replays nothing: after a reconnect page 1 is read again.
    const live = useLiveFilingsFeed({
        enabled: liveEnabled,
        onReconnected: () => {
            if (page === 1) void list.refetch();
        },
        onStopped: () => onChange({ live: liveParam(false, liveByDefault), paused: undefined }),
    });

    const shown = live.filings.filter(({ filing }) => hasLiveForm(filing, forms));

    const listed = list.data?.data;

    const rows = mergeLatest(shown, listed ?? [], page);

    const flashing = useArrivalFlash(rows, { arrivedAt: arrivedAtOf, enabled: !paused, idOf: rowIdOf, ready: list.data !== null || list.error !== null });

    const nextCursor = list.data?.next_cursor ?? null;

    const secTarget: null | SecPanelTarget = search.source && search.block
        ? { blockId: search.block, kind: "citation", title: "SEC filing", versionId: search.source }
        : null;

    return (
        <PageContainer>
            <SecSourceDialog onClose={() => onChange({ block: undefined, source: undefined })} target={secTarget} />

            <PageHeader
                actions={(
                    <LiveToggle
                        listening="Listening for new filings"
                        live={liveEnabled}
                        mode={live.mode}
                        onChange={(on) => {
                            live.clearStop();

                            onChange({ live: liveParam(on, liveByDefault), paused: undefined });
                        }}
                    />
                )}
                description="The newest SEC filings of every filer, new ones live on top, and a full-text search across every filer's documents."
                title="Filings"
            />

            <Section description="The newest filings of every filer, newest first; new ones arrive live on top." title="Latest filings">
                <LiveStopNotice planNote={LIVE_FILINGS_PLAN_NOTE} stop={live.stop} />
                <FilterBar activeCount={forms.length > 0 ? 1 : 0} onReset={() => onChange({ form: undefined })}>
                    <FilterField label="Forms">
                        {id => (
                            <DebouncedInput
                                aria-label="Latest filings by form"
                                className="w-full"
                                id={id}
                                onCommit={value => onChange({ form: value.trim() || undefined })}
                                placeholder="e.g. 8-K,S-1"
                                value={search.form ?? ""}
                            />
                        )}
                    </FilterField>
                </FilterBar>
                {forms.length > 0 && live.filings.length > 0 && (
                    <div className="text-muted-foreground text-xs" role="status">
                        {`Live: showing ${shown.length} of ${live.filings.length} arrived filings (forms ${forms.join(", ")}, filtered in the browser).`}
                    </div>
                )}
                <LatestFilingsView
                    error={list.error}
                    flashing={flashing}
                    forms={forms}
                    isLoading={list.isLoading}
                    pager={{
                        hasNext: nextCursor !== null,
                        isFetching: list.isFetching,
                        onNext: () => {
                            if (nextCursor) setPager(nextPage(pager, nextCursor));
                        },
                        onPrevious: () => setPager(previousPage(pager)),
                        page,
                    }}
                    paused={paused}
                    rows={rows}
                />
            </Section>

            <Section
                description="Full text of every filer's SEC documents. Without a company the API reads a capped number of matching passages, newest filings first; the answer says how many and how to narrow it."
                title="Search every filer"
            >
                <SecFilingSearch
                    filters={{ form: search.searchForm, from: search.filedFrom, item: search.searchItem, to: search.filedTo }}
                    marketWide
                    onFiltersChange={filters => onChange({ filedFrom: filters.from, filedTo: filters.to, searchForm: filters.form, searchItem: filters.item })}
                    onOpen={(target) => {
                        if (target.kind === "citation") onChange({ block: target.blockId, source: target.versionId });
                    }}
                    renderFilingLink={accession => (
                        <Link className="text-primary text-xs hover:underline" params={{ accession }} to="/filings/$accession">
                            {`Filing ${accession}`}
                        </Link>
                    )}
                    symbol=""
                />
            </Section>
        </PageContainer>
    );
}
