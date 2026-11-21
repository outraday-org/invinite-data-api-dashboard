import type { ColumnDef } from "@tanstack/react-table";

import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";

import type { SecPanelTarget } from "@/components/sec/sec-source-panel";
import type { ReceivedFiling } from "@/lib/live/live-filings";
import type { LiveFilingsMode } from "@/lib/live/use-live-filings";

import { LIVE_FILINGS_PLAN_NOTE, LiveStopNotice, LiveToggle } from "@/components/live/live-toggle";
import { DebouncedInput } from "@/components/navigation/debounced-input";
import { SecFilingSearch } from "@/components/sec/sec-filing-search";
import { SecSourceDialog } from "@/components/sec/sec-source-panel";
import { filerCikParam } from "@/components/sec/security-link";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { DASH, formatDay, formatInstant } from "@/lib/format";
import { titleHead } from "@/lib/layout";
import { commaList, hasLiveForm } from "@/lib/live/live-filings";
import { IN_PLACE, optionalDay, optionalFlag, optionalText } from "@/lib/url-state";
import { useLiveFilingsFeed } from "@/routes/$ticker/filings/-components/use-live-filings-feed";

/**
 * `?paused=true` (the live feed off; on by default), `?form=` (the live list's forms, comma list, filtered in the
 * browser), the market-wide search's filters `?searchForm=&searchItem=&filedFrom=&filedTo=` (applied on Search) and
 * `?source=<version id>&block=<block id>` (a hit's cited passage).
 */
/** `?searchItem=7`: the router reads a bare number as a number (JSON search values); a section id is text. */
const sectionItemsParam = z.preprocess(value => (typeof value === "number" ? String(value) : value), z.string().trim().min(1).max(200)).optional().catch(undefined);

const filingsSearchSchema = z.object({
    block: z.string().regex(/^b\d+$/).optional().catch(undefined),
    filedFrom: optionalDay(),
    filedTo: optionalDay(),
    form: optionalText(60),
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

/** The filer of a live filing: its instrument's filings when it has a ticker, else its filer page. */
function LiveFiler({ filing }: { filing: ReceivedFiling["filing"] }) {
    if (filing.ticker) {
        return (
            <Link className={linkClass} params={{ ticker: filing.ticker }} to="/$ticker/filings">
                <Badge variant="secondary">{filing.ticker}</Badge>
            </Link>
        );
    }

    const cik = filerCikParam(filing.cik);

    return cik ? <Link className={linkClass} params={{ cik }} to="/sec/$cik">{`CIK ${cik}`}</Link> : <span>{filing.cik}</span>;
}

const LIVE_COLUMNS: Array<ColumnDef<ReceivedFiling>> = [
    { cell: ({ row }) => <span className="tabular-nums whitespace-nowrap">{formatInstant(row.original.receivedAt)}</span>, header: "Arrived", id: "received" },
    { cell: ({ row }) => <span className="font-semibold">{row.original.filing.form_type}</span>, header: "Form", id: "form" },
    { cell: ({ row }) => <LiveFiler filing={row.original.filing} />, header: "Filer", id: "filer" },
    {
        cell: ({ row }) => {
            const proposed = row.original.filing.proposed_symbols ?? [];

            return proposed.length > 0 ? <span title="Tickers the registration statement proposes">{proposed.map(symbol => symbol.symbol).join(", ")}</span> : DASH;
        },
        header: "Proposed tickers",
        id: "proposed",
    },
    { cell: ({ row }) => <span className="tabular-nums whitespace-nowrap">{formatDay(row.original.filing.filing_date)}</span>, header: "Filed", id: "filed" },
    { cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{formatDay(row.original.filing.period_end)}</span>, header: "Period", id: "period" },
    {
        cell: ({ row }) => (
            <Link className="text-primary hover:underline" params={{ accession: row.original.filing.accession_number }} to="/filings/$accession">
                {row.original.filing.accession_number}
            </Link>
        ),
        header: "Filing",
        id: "accession",
    },
];

/** The live list (pure): what arrived since the page opened, the state of the socket, or why it stopped. */
export function LiveFilingsView({ filings, mode, paused }: { filings: ReadonlyArray<ReceivedFiling>; mode: LiveFilingsMode; paused: boolean }) {
    let emptyText = "Nothing has arrived since this page opened.";

    if (paused) emptyText = "The live feed is off.";
    else if (mode !== "live") emptyText = "Connecting to the live feed…";

    return (
        <DataTable
            columns={LIVE_COLUMNS}
            emptyText={emptyText}
            exportConfig={{ dataset: "live-filings", scope: "sec" }}
            isLoading={false}
            rows={[...filings]}
        />
    );
}

/**
 * Every filer's SEC filings (`/filings`). The API lists filings per instrument only (`/v1/filings` needs `symbol`), so
 * this page has no REST list: it shows the filings that arrive over the stream's `filings` channel since it opened, and
 * a full-text search across every filer (`/v1/search/filings` without `symbol`; its cap is stated).
 */
function FilingsPage() {
    const search = Route.useSearch();

    const navigate = Route.useNavigate();

    const onChange = (patch: z.infer<typeof filingsSearchSchema>) => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, ...patch }) });

    const paused = search.paused === true;

    const live = useLiveFilingsFeed({ enabled: !paused, onStopped: () => onChange({ paused: true }) });

    const forms = commaList(search.form);

    const shown = live.filings.filter(({ filing }) => hasLiveForm(filing, forms));

    const secTarget: null | SecPanelTarget = search.source && search.block
        ? { blockId: search.block, kind: "citation", title: "SEC filing", versionId: search.source }
        : null;

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 lg:px-8">
            <SecSourceDialog onClose={() => onChange({ block: undefined, source: undefined })} target={secTarget} />

            <section aria-label="Live filings" className="flex flex-col gap-3">
                <PageHeader
                    actions={(
                        <>
                            <DebouncedInput
                                aria-label="Live filings by form"
                                className="w-[170px]"
                                onCommit={value => onChange({ form: value.trim() || undefined })}
                                placeholder="Forms, e.g. 8-K,S-1"
                                value={search.form ?? ""}
                            />
                            <LiveToggle
                                listening="Listening for new filings"
                                live={!paused}
                                mode={live.mode}
                                onChange={(on) => {
                                    live.clearStop();

                                    onChange({ paused: on ? undefined : true });
                                }}
                            />
                        </>
                    )}
                    description="New SEC filings of every filer as they arrive — only those since this page opened: the API lists filings per instrument, so there is no market-wide list to load. A filer's history is on its instrument or filer page."
                    title="Filings"
                />
                <LiveStopNotice planNote={LIVE_FILINGS_PLAN_NOTE} stop={live.stop} />
                {forms.length > 0 && (
                    <div className="text-muted-foreground text-xs" role="status">
                        {`Showing ${shown.length} of ${live.filings.length} arrived filings (forms ${forms.join(", ")}, filtered in the browser).`}
                    </div>
                )}
                <LiveFilingsView filings={shown} mode={live.mode} paused={paused} />
            </section>

            <section aria-label="Search every filer" className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">Search every filer</h3>
                <p className="text-muted-foreground text-xs">
                    Full text of every filer&apos;s SEC documents. Without a company the API reads a capped number of matching
                    passages, newest filings first; the answer says how many and how to narrow it.
                </p>
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
            </section>
        </div>
    );
}
