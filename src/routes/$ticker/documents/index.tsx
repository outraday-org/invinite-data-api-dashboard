import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

import type { SecPanelTarget } from "@/components/sec/sec-source-panel";
import type { V2InvestorDocument } from "@/lib/api/types";
import type { DocumentsSearch } from "@/lib/earnings/documents";

import { SecFilingSearch } from "@/components/sec/sec-filing-search";
import { SecSourceDialog } from "@/components/sec/sec-source-panel";
import { Button } from "@/components/ui/button";
import { tierLabel } from "@/components/ui/credit-hint";
import { PageHeader } from "@/components/ui/page-header";
import { RequestErrorState } from "@/components/ui/request-error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useV2Company, useV2EventsInfinite, useV2InvestorDocumentsInfinite } from "@/lib/api/queries";
import { useAutoLoadPages } from "@/lib/api/use-auto-load-pages";
import { buildDocumentTree, callEntries, eventTitleMap, filterCallEntries, validateDocumentsSearch } from "@/lib/earnings/documents";
import { tickerHead } from "@/lib/layout";
import { IN_PLACE } from "@/lib/url-state";
import { MEDIA_CODES } from "@/routes/$ticker/earnings-calls/-components/media-state";

import { DocumentFilters } from "./-components/document-filters";
import { DocumentSearch } from "./-components/document-search";
import { DocumentTextDialog } from "./-components/document-text";
import { DocumentTree } from "./-components/document-tree";

export const Route = createFileRoute("/$ticker/documents/")({
    component: DocumentsPage,
    head: ({ params }) => tickerHead(params.ticker, "Documents"),
    validateSearch: validateDocumentsSearch,
});

// The API's largest page (`/v1/investor-documents`, `/v1/events`).
const PAGE_SIZE = 200;

// The events list feeds the call rows: every event type, newest first, the API's largest page.
const EVENTS_PAGE_SIZE = 200;

/** The library's request state: `MediaState`'s options, the plan gate naming `/v1/investor-documents`' own tier. */
function LibraryError({ error }: { error: unknown }) {
    return (
        <RequestErrorState
            codes={MEDIA_CODES}
            error={error}
            notFound={{ title: "No earnings-call coverage for this company" }}
            tier={{ badge: tierLabel("listInvestorDocuments") ?? "Plan", title: "Your plan does not include company documents" }}
            title="Failed to load the documents"
        />
    );
}

/** The search sources: the company's own documents (`/v1/search/investor-documents`) or its SEC filings (`/v1/search/filings`). */
const SEARCH_SOURCES = [
    { label: "Company documents", value: "company" },
    { label: "SEC filings", value: "sec" },
] as const;

type SearchSource = (typeof SEARCH_SOURCES)[number]["value"];

/** SEC filing search scoped to the company (`symbol=<ticker>`). */
function SecFilingsSource({ onOpen, target, ticker }: { onOpen: (target: null | SecPanelTarget) => void; target: null | SecPanelTarget; ticker: string }) {
    return (
        <>
            <SecFilingSearch onOpen={onOpen} symbol={ticker} />
            <SecSourceDialog onClose={() => onOpen(null)} target={target} />
        </>
    );
}

function DocumentsPage() {
    const { ticker } = Route.useParams();

    const search = Route.useSearch();

    const navigate = Route.useNavigate();

    const [textOf, setTextOf] = React.useState<null | V2InvestorDocument>(null);

    const searchSource: SearchSource = search.searchIn === "sec" ? "sec" : "company";

    // `?source=<version id>&block=<block id>`: the cited block of an SEC hit in the source panel (a shareable link).
    const secTarget: null | SecPanelTarget = search.source && search.block
        ? { blockId: search.block, kind: "citation", title: `${ticker} · SEC filing`, versionId: search.source }
        : null;

    const openSecTarget = (target: null | SecPanelTarget) => void navigate({
        ...IN_PLACE,
        search: prev => ({
            ...prev,
            block: target?.kind === "citation" ? target.blockId : undefined,
            source: target?.kind === "citation" ? target.versionId : undefined,
        }),
    });

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
    useAutoLoadPages({ ...library, hasNextPage: Boolean(library.hasNextPage) });

    useAutoLoadPages({ ...events, hasNextPage: Boolean(events.hasNextPage) });

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
        // In place (URL state rule): no history entry per keystroke or pick, and the filters sit above the tree, so the page
        // keeps its scroll position (the document scrolls; a reset would jump to the top).
        void navigate({ ...IN_PLACE, search: prev => ({ ...prev, ...patch }) });
    };

    const filtered = search.category !== undefined || search.section !== undefined || search.kind !== undefined || search.year !== undefined;

    const loadingMore = Boolean(library.hasNextPage) || Boolean(events.hasNextPage);

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                description={(
                    <>
                        The company&apos;s whole document tree by category and folder — earnings quarters with each call&apos;s
                        documents, press release and slides, events, reports, proxy statements, ESG reports, investor-day and
                        conference decks, letters. Company-published material, shown as published.
                    </>
                )}
                title="Documents"
            />

            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                    <div aria-label="Search source" className="flex items-center gap-1" role="group">
                        {SEARCH_SOURCES.map(source => (
                            <Button
                                aria-pressed={searchSource === source.value}
                                key={source.value}
                                onClick={() => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, block: undefined, searchIn: source.value === "sec" ? "sec" : undefined, source: undefined }) })}
                                size="xs"
                                type="button"
                                variant={searchSource === source.value ? "secondary" : "outline"}
                            >
                                {source.label}
                            </Button>
                        ))}
                    </div>
                    {searchSource === "company" ? <DocumentSearch identifier={ticker} /> : <SecFilingsSource onOpen={openSecTarget} target={secTarget} ticker={ticker} />}
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

            <DocumentTextDialog doc={textOf} onClose={() => setTextOf(null)} />
        </div>
    );
}
