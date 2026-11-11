import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

import type { SecPanelTarget } from "@/components/sec/sec-source-panel";
import type { V2InvestorDocument } from "@/lib/api/types";
import type { DocumentsSearch } from "@/lib/earnings/documents";

import { SecFilingSearch } from "@/components/sec/sec-filing-search";
import { SecSourceDialog } from "@/components/sec/sec-source-panel";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { isTierError } from "@/lib/api/errors";
import { useV2Company, useV2EventsInfinite, useV2InvestorDocumentsInfinite } from "@/lib/api/queries";
import { useLoadAllPages } from "@/lib/api/use-load-all-pages";
import { buildDocumentTree, callEntries, eventTitleMap, filterCallEntries, validateDocumentsSearch } from "@/lib/earnings/documents";
import { MediaState, Notice } from "@/routes/$ticker/earnings-calls/-components/media-state";

import { DocumentFilters } from "./-components/document-filters";
import { DocumentSearch } from "./-components/document-search";
import { DocumentTextDialog } from "./-components/document-text";
import { DocumentTree } from "./-components/document-tree";

export const Route = createFileRoute("/$ticker/documents/")({
    component: DocumentsPage,
    validateSearch: validateDocumentsSearch,
});

// The API's largest page (`/v1/investor-documents`, `/v1/events`).
const PAGE_SIZE = 200;

// The events list feeds the call rows: every event type, newest first, the API's largest page.
const EVENTS_PAGE_SIZE = 200;

/** The library's request state: the plan gate names STANDARD (the shared `MediaState` says PRO). */
function LibraryError({ error }: { error: unknown }) {
    if (isTierError(error)) return <Notice badge="STANDARD" title="Your plan does not include company documents" />;

    return <MediaState error={error} notFound="No earnings-call coverage for this company" title="Failed to load the documents" />;
}

/** The search sources: the company's own documents (`/v1/search/investor-documents`) or its SEC filings (`/v1/search/filings`). */
const SEARCH_SOURCES = [
    { label: "Company documents", value: "company" },
    { label: "SEC filings", value: "sec" },
] as const;

type SearchSource = (typeof SEARCH_SOURCES)[number]["value"];

/** SEC filing search scoped to the company (`company=<ticker>`). */
function SecFilingsSource({ ticker }: { ticker: string }) {
    const [target, setTarget] = React.useState<null | SecPanelTarget>(null);

    return (
        <>
            <SecFilingSearch company={ticker} onOpen={setTarget} />
            <SecSourceDialog onClose={() => setTarget(null)} target={target} />
        </>
    );
}

function DocumentsPage() {
    const { ticker } = Route.useParams();

    const search = Route.useSearch();

    const navigate = Route.useNavigate();

    const [textOf, setTextOf] = React.useState<null | V2InvestorDocument>(null);

    const [searchSource, setSearchSource] = React.useState<SearchSource>("company");

    // The IR library and every call's documents in one list (`source: company | call`).
    const library = useV2InvestorDocumentsInfinite({
        category: search.category,
        company: ticker,
        fiscalYear: search.year,
        kind: search.kind ? [search.kind] : undefined,
        limit: PAGE_SIZE,
    });

    const events = useV2EventsInfinite({ company: ticker, limit: EVENTS_PAGE_SIZE, sort: "-scheduled_at", type: "all" });

    const { data: details } = useV2Company(ticker);

    // No totals in the API: load every page of both, so the counts and the text filter see everything.
    useLoadAllPages({ ...library, hasNextPage: Boolean(library.hasNextPage) });

    useLoadAllPages({ ...events, hasNextPage: Boolean(events.hasNextPage) });

    const { data, error, isLoading } = library;

    // `/v1/investor-documents` has no section filter: the IR section filters the loaded rows.
    const documents = React.useMemo(
        () => (data?.pages.flatMap(page => page.data) ?? []).filter(doc => !search.section || doc.section === search.section),
        [data, search.section],
    );

    const eventList = React.useMemo(() => events.data?.pages.flatMap(page => page.data) ?? [], [events.data]);

    const calls = React.useMemo(() => filterCallEntries(callEntries(eventList, documents), search), [documents, eventList, search]);

    // An event folder without a stored name is named after its event (`folderLabel`).
    const eventTitles = React.useMemo(() => eventTitleMap(eventList), [eventList]);

    const tree = React.useMemo(
        () => buildDocumentTree(documents, calls, search.q ?? "", eventTitles),
        [calls, documents, eventTitles, search.q],
    );

    // v2 lists name no company: its name comes from the company details the layout already loads.
    const companyName = details?.name ?? null;

    const onFilterChange = (patch: Partial<DocumentsSearch>) => {
        // The text filter updates as you type: replace the history entry instead of adding one per keystroke.
        void navigate({ replace: Object.keys(patch).every(key => key === "q"), search: prev => ({ ...prev, ...patch }) });
    };

    const filtered = search.category !== undefined || search.section !== undefined || search.kind !== undefined || search.year !== undefined;

    const loadingMore = Boolean(library.hasNextPage) || Boolean(events.hasNextPage);

    return (
        <div className="space-y-4 relative flex flex-col h-0 grow">
            <div className="flex flex-col gap-1 shrink-0">
                <div>Documents</div>
                <div className="text-muted-foreground text-sm">
                    The company&apos;s whole document tree by category and folder — earnings quarters with each call&apos;s
                    documents, press release and slides, events, reports, proxy statements, ESG reports, investor-day and
                    conference decks, letters. Company-published material, shown as published.
                </div>
            </div>

            <ScrollArea className="h-0 grow">
                <div className="flex flex-col gap-4 pr-3">
                    <div className="flex flex-col gap-1">
                        <div aria-label="Search source" className="flex items-center gap-1" role="group">
                            {SEARCH_SOURCES.map(source => (
                                <Button
                                    aria-pressed={searchSource === source.value}
                                    key={source.value}
                                    onClick={() => setSearchSource(source.value)}
                                    size="xs"
                                    type="button"
                                    variant={searchSource === source.value ? "secondary" : "outline"}
                                >
                                    {source.label}
                                </Button>
                            ))}
                        </div>
                        {searchSource === "company" ? <DocumentSearch identifier={ticker} /> : <SecFilingsSource ticker={ticker} />}
                    </div>

                    <section className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-sm font-medium">
                                Documents
                                {!isLoading && !error && (
                                    <span className="text-muted-foreground font-normal">
                                        {` · ${documents.length}${loadingMore ? "+" : ""} document${documents.length === 1 ? "" : "s"}`}
                                        {companyName ? ` · ${companyName}` : ""}
                                    </span>
                                )}
                            </div>
                            <DocumentFilters onChange={onFilterChange} search={search} />
                        </div>

                        {error
                            ? <LibraryError error={error} />
                            : isLoading
                                ? <Skeleton className="h-40 w-full" />
                                : tree.length === 0
                                    ? (
                                            <div className="text-muted-foreground w-full p-2 text-center text-xs">
                                                {search.q
                                                    ? `No documents match “${search.q}”.`
                                                    : filtered ? "No documents match these filters." : "No documents stored for this company yet."}
                                            </div>
                                        )
                                    : (
                                            <DocumentTree
                                                filtering={Boolean(search.q)}
                                                onShowText={setTextOf}
                                                ticker={ticker}
                                                tree={tree}
                                            />
                                        )}
                    </section>
                </div>
            </ScrollArea>

            <DocumentTextDialog doc={textOf} onClose={() => setTextOf(null)} />
        </div>
    );
}
