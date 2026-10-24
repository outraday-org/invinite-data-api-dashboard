import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

import type { EarningsCompanyDocument } from "@/lib/api/types";
import type { DocumentsSearch } from "@/lib/earnings/documents";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { isTierError } from "@/lib/api/errors";
import { useEarningsCompanyDocumentsInfinite, useEarningsEventsInfinite } from "@/lib/api/queries";
import { useLoadAllPages } from "@/lib/api/use-load-all-pages";
import { buildDocumentTree, callEntries, earliestExpiry, eventTitleMap, filterCallEntries, validateDocumentsSearch } from "@/lib/earnings/documents";
import { useMediaUrl } from "@/lib/earnings/use-media-url";
import { MediaState, Notice } from "@/routes/$ticker/earnings-calls/-components/media-state";

import { DocumentFilters } from "./-components/document-filters";
import { DocumentSearch } from "./-components/document-search";
import { DocumentTextDialog } from "./-components/document-text";
import { DocumentTree } from "./-components/document-tree";

export const Route = createFileRoute("/$ticker/documents/")({
    component: DocumentsPage,
    validateSearch: validateDocumentsSearch,
});

const PAGE_SIZE = 100;

// The events list feeds the call rows: every event type, newest first, the API's largest page.
const EVENTS_PAGE_SIZE = 200;

/** The library's request state: the plan gate names STANDARD (the shared `MediaState` says PRO). */
function LibraryError({ error }: { error: unknown }) {
    if (isTierError(error)) return <Notice badge="STANDARD" title="Your plan does not include company documents" />;

    return <MediaState error={error} notFound="No earnings-call coverage for this company" title="Failed to load the documents" />;
}

function DocumentsPage() {
    const { ticker } = Route.useParams();

    const search = Route.useSearch();

    const navigate = Route.useNavigate();

    const [textOf, setTextOf] = React.useState<EarningsCompanyDocument | null>(null);

    const library = useEarningsCompanyDocumentsInfinite({
        category: search.category ? [search.category] : undefined,
        identifier: ticker,
        include: ["calls"],
        kind: search.kind ? [search.kind] : undefined,
        limit: PAGE_SIZE,
        section: search.section ? [search.section] : undefined,
        year: search.year,
    });

    const events = useEarningsEventsInfinite({ eventType: "all", identifier: ticker, limit: EVENTS_PAGE_SIZE, sort: "desc" });

    // No totals in the API: load every page of both, so the counts and the text filter see everything.
    useLoadAllPages({ ...library, hasNextPage: Boolean(library.hasNextPage) });

    useLoadAllPages({ ...events, hasNextPage: Boolean(events.hasNextPage) });

    const { data, error, isLoading, refetch } = library;

    const documents = React.useMemo(() => data?.pages.flatMap(page => page.documents) ?? [], [data]);

    const eventList = React.useMemo(() => events.data?.pages.flatMap(page => page.events) ?? [], [events.data]);

    const calls = React.useMemo(() => filterCallEntries(callEntries(eventList, documents), search), [documents, eventList, search]);

    // An event folder without a stored name is named after its event (`folderLabel`).
    const eventTitles = React.useMemo(() => eventTitleMap(eventList), [eventList]);

    const tree = React.useMemo(
        () => buildDocumentTree(documents, calls, search.q ?? "", eventTitles),
        [calls, documents, eventTitles, search.q],
    );

    const company = data?.pages[0]?.company;

    // Signed links expire: refetch before the earliest one does (as the call Documents tab).
    useMediaUrl({ expiresAt: earliestExpiry(documents), refetch });

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
                    <DocumentSearch identifier={ticker} />

                    <section className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-sm font-medium">
                                Documents
                                {!isLoading && !error && (
                                    <span className="text-muted-foreground font-normal">
                                        {` · ${documents.length}${loadingMore ? "+" : ""} document${documents.length === 1 ? "" : "s"}`}
                                        {company ? ` · ${company.name}` : ""}
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
                                                ticker={company?.symbol ?? ticker}
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
