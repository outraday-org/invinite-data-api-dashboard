import type { ColumnDef } from "@tanstack/react-table";

import { Link } from "@tanstack/react-router";
import * as React from "react";

import type { NewsDevelopment, V2AnnouncementsResponse } from "@/lib/api/types";
import type { ExportColumn } from "@/lib/export";
import type { NewsSearch } from "@/lib/news/labels";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { tierLabel } from "@/components/ui/credit-hint";
import { DataTable } from "@/components/ui/data-table";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { isTierError } from "@/lib/api/errors";
import { useV2AnnouncementsInfinite } from "@/lib/api/queries";
import { DASH, formatDay, formatInstant } from "@/lib/format";
import { ANNOUNCEMENT_TOPICS, CLAIM_STATUS_LABELS, DATE_PRECISION_LABELS, NEWS_ORDER_LABELS, NEWS_TOPIC_LABELS } from "@/lib/news/labels";
import { FilterSelect } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";

const PAGE_SIZE = 50;

const ALL = "all";

/**
 * The effective range as one line: "Dec 1, 2026 – Jan 31, 2027 · month" (the precision names how exact the days are),
 * else the text as the publication states it, else none.
 */
export function effectiveLabel(row: Pick<NewsDevelopment, "date_precision" | "effective_date_text" | "effective_from" | "effective_to">): string {
    const { date_precision: precision, effective_from: from, effective_to: to } = row;

    if (!from && !to) return row.effective_date_text?.trim() || DASH;

    const range = from && to && from !== to
        ? `${formatDay(from)} – ${formatDay(to)}`
        : from ? (to ? formatDay(from) : `from ${formatDay(from)}`) : `until ${formatDay(to)}`;

    return precision === "day" ? range : `${range} · ${DATE_PRECISION_LABELS[precision]}`;
}

const COLUMNS: Array<ColumnDef<NewsDevelopment>> = [
    { cell: ({ row }) => <span className="whitespace-nowrap">{formatInstant(row.original.announced_at)}</span>, header: "Announced", id: "announced_at" },
    {
        cell: ({ row }) => {
            const { counterparties, products, summary, title } = row.original;

            const named = [...products.map(p => p.name), ...counterparties.map(c => c.name)];

            return (
                <div className="flex max-w-[460px] flex-col gap-0.5 whitespace-normal">
                    <span className="font-medium">{title}</span>
                    <span className="text-muted-foreground text-xs">{summary}</span>
                    {named.length > 0 && <span className="text-muted-foreground text-xs">{`Names: ${named.join(", ")}`}</span>}
                </div>
            );
        },
        header: "Announcement",
        id: "title",
    },
    { cell: ({ row }) => <Badge variant="outline">{NEWS_TOPIC_LABELS[row.original.topic]}</Badge>, header: "Topic", id: "topic" },
    {
        cell: ({ row }) => (
            <Badge title={`Extraction confidence: ${row.original.confidence}`} variant={row.original.claim_status === "planned" ? "default" : "secondary"}>
                {CLAIM_STATUS_LABELS[row.original.claim_status]}
            </Badge>
        ),
        header: "Status",
        id: "claim_status",
    },
    {
        cell: ({ row }) => (
            <div className="flex flex-col whitespace-nowrap">
                <span>{effectiveLabel(row.original)}</span>
                {row.original.effective_date_text && (row.original.effective_from || row.original.effective_to) && (
                    <span className="text-muted-foreground text-xs">{`“${row.original.effective_date_text}”`}</span>
                )}
            </div>
        ),
        header: "Effective",
        id: "effective",
    },
    {
        cell: ({ row }) => (
            // The news item it was read from opens in the item panel (`?item=`), as a headline of the news list does.
            <Link className="line-clamp-2 max-w-[240px] whitespace-normal hover:underline" resetScroll={false} search={prev => ({ ...prev, item: row.original.item_id })} to=".">
                {row.original.item.title}
            </Link>
        ),
        header: "News item",
        id: "item",
    },
];

const EXPORT_COLUMNS: ReadonlyArray<ExportColumn<NewsDevelopment>> = [
    { header: "announced_at", value: row => row.announced_at },
    { header: "title", value: row => row.title },
    { header: "summary", value: row => row.summary },
    { header: "topic", value: row => row.topic },
    { header: "claim_status", value: row => row.claim_status },
    { header: "confidence", value: row => row.confidence },
    { header: "effective_from", value: row => row.effective_from },
    { header: "effective_to", value: row => row.effective_to },
    { header: "date_precision", value: row => row.date_precision },
    { header: "effective_date_text", value: row => row.effective_date_text },
    { header: "products", value: row => row.products.map(p => p.name) },
    { header: "counterparties", value: row => row.counterparties.map(c => c.name) },
    { header: "item_id", value: row => row.item_id },
    { header: "item_title", value: row => row.item.title },
    { header: "item_url", value: row => row.item.url },
];

/** The list's request state: `/v1/announcements` needs a plan (LITE in 10.0), so a plan gate is a notice. */
function AnnouncementsError({ error }: { error: unknown }) {
    if (isTierError(error)) return <Notice badge={tierLabel("listAnnouncements") ?? "Plan"} title="Your plan does not include announcements" />;

    return <ErrorState error={error} title="Failed to load the announcements" />;
}

/** The announcements table (pure: tested in `announcements.test.tsx`). */
export function AnnouncementsView({
    error,
    filtered,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    onLoadMore,
    pages,
    scope,
}: {
    error: unknown;
    /** A filter is set: the empty line names the filters, not the company. */
    filtered: boolean;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    onLoadMore: () => void;
    pages: ReadonlyArray<V2AnnouncementsResponse>;
    /** The export file's scope (the ticker). */
    scope: string;
}) {
    const rows = React.useMemo(() => pages.flatMap(page => page.data), [pages]);

    return (
        <DataTable
            columns={COLUMNS}
            emptyText={filtered ? "No announcements match these filters." : "No announcements read from this company's news yet."}
            errorState={error ? <AnnouncementsError error={error} /> : null}
            exportConfig={{ columns: EXPORT_COLUMNS, dataset: "announcements", scope }}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            isLoading={isLoading}
            onLoadMore={onLoadMore}
            operationId="listAnnouncements"
            rows={rows}
        />
    );
}

type AnnouncementSearch = Pick<NewsSearch, "aFrom" | "aSort" | "aTo" | "aTopic" | "effFrom" | "effTo">;

/** A labelled day input of the filter row (empty = none). */
function DayInput({ label, onChange, value }: { label: string; onChange: (value: string | undefined) => void; value: string | undefined }) {
    return (
        <label className="text-muted-foreground flex items-center gap-1 text-xs">
            {label}
            <Input aria-label={label} className="w-[150px]" onChange={e => onChange(e.target.value || undefined)} type="date" value={value ?? ""} />
        </label>
    );
}

/** The Announcements filters, controlled by the route's search (every one is an API parameter). */
export function AnnouncementFilters({ onChange, search }: { onChange: (patch: Partial<AnnouncementSearch>) => void; search: AnnouncementSearch }) {
    const active = Object.values(search).some(Boolean);

    return (
        <div className="flex flex-wrap items-center gap-2" data-testid="announcement-filters">
            <FilterSelect
                aria-label="Topic"
                className="w-[180px]"
                onValueChange={value => onChange({ aTopic: value === ALL ? undefined : value })}
                options={[{ label: "All topics", value: ALL }, ...ANNOUNCEMENT_TOPICS.map(value => ({ label: NEWS_TOPIC_LABELS[value], value }))]}
                value={search.aTopic ?? ALL}
            />
            <FilterSelect
                aria-label="Order"
                className="w-[140px]"
                onValueChange={value => onChange({ aSort: value === "oldest" ? "oldest" : undefined })}
                options={[{ label: NEWS_ORDER_LABELS.newest, value: "newest" }, { label: NEWS_ORDER_LABELS.oldest, value: "oldest" }]}
                value={search.aSort ?? "newest"}
            />
            <DayInput label="Announced from" onChange={aFrom => onChange({ aFrom })} value={search.aFrom} />
            <DayInput label="to" onChange={aTo => onChange({ aTo })} value={search.aTo} />
            <DayInput label="Effective from" onChange={effFrom => onChange({ effFrom })} value={search.effFrom} />
            <DayInput label="Effective until" onChange={effTo => onChange({ effTo })} value={search.effTo} />
            {active && (
                <Button
                    onClick={() => onChange({ aFrom: undefined, aSort: undefined, aTo: undefined, aTopic: undefined, effFrom: undefined, effTo: undefined })}
                    size="sm"
                    type="button"
                    variant="ghost"
                >
                    Reset
                </Button>
            )}
        </div>
    );
}

/**
 * The Announcements tab of the News page: what the company's news announced (`/v1/announcements?company=`, LITE,
 * 2 credits a page) — product launches, partnerships, contracts … with what the publication says happened and when it
 * takes effect. Title and summary are model-derived (`derived: true`), never the publisher's words.
 */
export function AnnouncementsTab({ onChange, search, ticker }: { onChange: (patch: Partial<AnnouncementSearch>) => void; search: AnnouncementSearch; ticker: string }) {
    const list = useV2AnnouncementsInfinite({
        company: ticker,
        effectiveFrom: search.effFrom,
        effectiveTo: search.effTo,
        from: search.aFrom,
        limit: PAGE_SIZE,
        sort: search.aSort === "oldest" ? "announced_at" : undefined,
        to: search.aTo,
        topic: search.aTopic ? [search.aTopic] : undefined,
    });

    return (
        <div className="flex flex-col gap-3">
            <p className="text-muted-foreground text-xs">
                What the company&apos;s news announced, one row per development. Title and summary are written by a model from
                the publication, not the publisher&apos;s words; the news item links the source.
            </p>
            <AnnouncementFilters onChange={onChange} search={search} />
            <AnnouncementsView
                error={list.error}
                filtered={Boolean(search.aTopic || search.aFrom || search.aTo || search.effFrom || search.effTo)}
                hasNextPage={list.hasNextPage}
                isFetchingNextPage={list.isFetchingNextPage}
                isLoading={list.isLoading}
                onLoadMore={() => void list.fetchNextPage()}
                pages={list.data?.pages ?? []}
                scope={ticker}
            />
        </div>
    );
}
