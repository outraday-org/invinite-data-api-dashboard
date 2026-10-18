import { Link } from "@tanstack/react-router";
import { ExternalLink, Search } from "lucide-react";
import * as React from "react";

import type { EarningsDocumentSearchHit, EarningsDocumentSearchResponse } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useEarningsDocumentSearch } from "@/lib/api/queries";
import { documentKindLabel, documentPageHref } from "@/lib/earnings/documents";
import { HighlightedText, SearchError } from "@/routes/$ticker/earnings-calls/-components/ask-this-call";

const SEARCH_LIMIT = 10;

const MIN_QUERY_LENGTH = 2;

type DocumentTable = NonNullable<EarningsDocumentSearchHit["table"]>;

const TABLE_LABELS: Record<DocumentTable, string> = {
    company_documents: "IR library",
    event_documents: "Call documents",
};

const TABLES = Object.keys(TABLE_LABELS) as Array<DocumentTable>;

/** The wording rule: passages, never facts; every hit names its document, year and page. */
export const DOCUMENT_SEARCH_LEAD = "Passages from company-published documents, not verified facts.";

const DOCUMENT_SEARCH_TIER = { badge: "STANDARD", title: "Your plan does not include document search" };

const linkClass = "inline-flex items-center gap-1 underline-offset-4 hover:underline";

function DocumentHitCard({ hit, query }: { hit: EarningsDocumentSearchHit; query: string }) {
    const source = [
        hit.title ?? "Untitled document",
        hit.year === null ? "undated" : String(hit.year),
        hit.page === null ? null : `p. ${hit.page}`,
    ].filter(Boolean).join(" · ");

    return (
        <li className="flex flex-col gap-1.5 rounded-md border p-3">
            <div className="flex flex-wrap items-center gap-2">
                {hit.kind && <Badge variant="outline">{documentKindLabel(hit.kind)}</Badge>}
                <span className="font-medium">{source}</span>
                {hit.heading && <span className="text-muted-foreground">{hit.heading}</span>}
                <span className="text-muted-foreground ml-auto tabular-nums" title="Relevance score">{hit.score.toFixed(2)}</span>
            </div>
            <HighlightedText query={query} text={hit.text} />
            <div className="flex flex-wrap items-center gap-3">
                {hit.url
                    ? (
                            // Presigned: a bearer credential, only an href; no referrer.
                            <a className={linkClass} href={documentPageHref(hit.url, hit.page)} rel="noopener noreferrer" target="_blank">
                                <ExternalLink className="size-3" />
                                {hit.page === null ? "Open document" : "Open page"}
                            </a>
                        )
                    : <span className="text-muted-foreground">No stored file</span>}
                {hit.event_id && (
                    <Link
                        className={linkClass}
                        params={{ eventId: hit.event_id, ticker: hit.symbol }}
                        search={{ tab: "documents" }}
                        to="/$ticker/earnings-calls/$eventId"
                    >
                        Open event
                    </Link>
                )}
            </div>
        </li>
    );
}

/** The results body (pure: data / error / loading in, list out). */
export function DocumentSearchResults({
    data,
    error,
    isLoading,
}: {
    data: EarningsDocumentSearchResponse | null;
    error: unknown;
    isLoading: boolean;
}) {
    if (error) return <SearchError error={error} tier={DOCUMENT_SEARCH_TIER} />;

    if (isLoading && !data) return <Skeleton className="h-24 w-full" />;

    if (!data) return null;

    if (data.hits.length === 0) return <div className="text-muted-foreground">No passages found</div>;

    return (
        <ul className="flex flex-col gap-2">
            {data.hits.map(hit => (
                <DocumentHitCard
                    hit={hit}
                    // A hit has no id of its own: document + page + chunk start is unique within one answer.
                    key={`${hit.document_id}:${hit.page ?? ""}:${hit.text.slice(0, 32)}`}
                    query={data.query}
                />
            ))}
        </ul>
    );
}

/**
 * Semantic search over one company's documents (`/documents/search`, 10 credits): its calls' documents and its IR
 * library. Runs on submit, never per keystroke; a source chip re-runs the submitted question.
 */
export function DocumentSearch({ identifier }: { identifier: string }) {
    const [draft, setDraft] = React.useState("");

    const [query, setQuery] = React.useState("");

    const [table, setTable] = React.useState<DocumentTable | undefined>(undefined);

    const { data, error, isFetching } = useEarningsDocumentSearch({ identifier, limit: SEARCH_LIMIT, q: query, table });

    const canSubmit = draft.trim().length >= MIN_QUERY_LENGTH;

    const submit = (event: React.FormEvent) => {
        event.preventDefault();

        if (canSubmit) setQuery(draft.trim());
    };

    return (
        <section className="flex flex-col gap-2 rounded-md border p-3">
            <form className="flex items-center gap-2" onSubmit={submit}>
                <Input
                    aria-label="Search this company's documents"
                    maxLength={500}
                    onChange={event => setDraft(event.target.value)}
                    placeholder="Search this company's documents — e.g. capital allocation"
                    value={draft}
                />
                <Button disabled={!canSubmit || isFetching} type="submit">
                    <Search />
                    {isFetching ? "Searching…" : "Search"}
                </Button>
            </form>

            <div className="flex flex-wrap items-center gap-1">
                <Button
                    aria-pressed={table === undefined}
                    onClick={() => setTable(undefined)}
                    size="xs"
                    type="button"
                    variant={table === undefined ? "secondary" : "outline"}
                >
                    All documents
                </Button>
                {TABLES.map(value => (
                    <Button
                        aria-pressed={table === value}
                        key={value}
                        onClick={() => setTable(value)}
                        size="xs"
                        type="button"
                        variant={table === value ? "secondary" : "outline"}
                    >
                        {TABLE_LABELS[value]}
                    </Button>
                ))}
                <span className="text-muted-foreground ml-auto text-[0.625rem]">10 credits per search</span>
            </div>

            {query && (
                <>
                    <div className="text-muted-foreground text-xs">{DOCUMENT_SEARCH_LEAD}</div>
                    <DocumentSearchResults data={data} error={error} isLoading={isFetching} />
                </>
            )}
        </section>
    );
}
