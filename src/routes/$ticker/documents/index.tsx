import { createFileRoute, Link } from "@tanstack/react-router";
import { FolderIcon } from "lucide-react";
import * as React from "react";

import type { EarningsCompanyDocument } from "@/lib/api/types";
import type { DocumentsSearch } from "@/lib/earnings/documents";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { isTierError } from "@/lib/api/errors";
import { useEarningsCompanyDocumentsInfinite, useEarningsEventsInfinite } from "@/lib/api/queries";
import { earliestExpiry, validateDocumentsSearch } from "@/lib/earnings/documents";
import { eventLabel } from "@/lib/earnings/format";
import { useMediaUrl } from "@/lib/earnings/use-media-url";
import { MediaState, Notice } from "@/routes/$ticker/earnings-calls/-components/media-state";
import { LoadMoreButton } from "@/routes/$ticker/filings/-components/load-more-button";

import { DocumentFilters } from "./-components/document-filters";
import { DocumentSearch } from "./-components/document-search";
import { DocumentTextDialog } from "./-components/document-text";
import { DocumentTree } from "./-components/document-tree";

export const Route = createFileRoute("/$ticker/documents/")({
    component: DocumentsPage,
    validateSearch: validateDocumentsSearch,
});

const PAGE_SIZE = 100;

/** The company's calls that hold documents, as links to each call page's Documents tab. */
function CallFolders({ ticker }: { ticker: string }) {
    // Same query as the calls list (shared cache): every event type, newest first.
    const { data, isLoading } = useEarningsEventsInfinite({ eventType: "all", identifier: ticker, limit: 40, sort: "desc" });

    const folders = (data?.pages.flatMap(page => page.events) ?? []).filter(event => event.has_documents);

    if (isLoading) return <Skeleton className="h-6 w-full" />;

    if (folders.length === 0) return <div className="text-muted-foreground text-xs">No call holds documents yet.</div>;

    return (
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {folders.map(event => (
                <li key={event.event_id}>
                    <Link
                        className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
                        params={{ eventId: event.event_id, ticker: event.symbol }}
                        search={{ tab: "documents" }}
                        to="/$ticker/earnings-calls/$eventId"
                    >
                        <FolderIcon className="size-3" />
                        {`${eventLabel(event)} · ${event.scheduled_at.slice(0, 10)}`}
                    </Link>
                </li>
            ))}
        </ul>
    );
}

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

    const {
        data,
        error,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        refetch,
    } = useEarningsCompanyDocumentsInfinite({
        category: search.category ? [search.category] : undefined,
        identifier: ticker,
        kind: search.kind ? [search.kind] : undefined,
        limit: PAGE_SIZE,
        section: search.section ? [search.section] : undefined,
        year: search.year,
    });

    const documents = React.useMemo(() => data?.pages.flatMap(page => page.documents) ?? [], [data]);

    const company = data?.pages[0]?.company;

    // Signed links expire: refetch before the earliest one does (as the call Documents tab).
    useMediaUrl({ expiresAt: earliestExpiry(documents), refetch });

    const onFilterChange = (patch: Partial<DocumentsSearch>) => {
        void navigate({ search: prev => ({ ...prev, ...patch }) });
    };

    const filtered = search.category !== undefined || search.section !== undefined || search.kind !== undefined || search.year !== undefined;

    return (
        <div className="space-y-4 relative flex flex-col h-0 grow">
            <div className="flex flex-col gap-1 shrink-0">
                <div>Documents</div>
                <div className="text-muted-foreground text-sm">
                    The company&apos;s document tree by category and folder — earnings quarters, events, reports, proxy
                    statements, ESG reports, investor-day and conference decks, letters — and its calls&apos; document
                    folders. Company-published material, shown as published.
                </div>
            </div>

            <ScrollArea className="h-0 grow">
                <div className="flex flex-col gap-4 pr-3">
                    <DocumentSearch identifier={ticker} />

                    <section className="flex flex-col gap-2">
                        <div className="text-sm font-medium">Call folders</div>
                        <CallFolders ticker={ticker} />
                    </section>

                    <section className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-sm font-medium">
                                IR library
                                {!isLoading && !error && (
                                    <span className="text-muted-foreground font-normal">
                                        {` · ${documents.length}${hasNextPage ? "+" : ""} document${documents.length === 1 ? "" : "s"}`}
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
                                : documents.length === 0
                                    ? (
                                            <div className="text-muted-foreground w-full p-2 text-center text-xs">
                                                {filtered ? "No documents match these filters." : "No IR documents stored for this company yet."}
                                            </div>
                                        )
                                    : <DocumentTree documents={documents} onShowText={setTextOf} ticker={company?.symbol ?? ticker} />}

                        <LoadMoreButton
                            hasNextPage={Boolean(hasNextPage)}
                            isFetchingNextPage={isFetchingNextPage}
                            onLoadMore={() => fetchNextPage()}
                        />
                    </section>
                </div>
            </ScrollArea>

            <DocumentTextDialog doc={textOf} onClose={() => setTextOf(null)} />
        </div>
    );
}
