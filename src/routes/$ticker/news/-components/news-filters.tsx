import type * as React from "react";

import type { NewsSearch } from "@/lib/news/labels";

import { Button } from "@/components/ui/button";
import { DayRange } from "@/components/ui/day-range";
import {
    NEWS_KIND_LABELS,
    NEWS_KINDS,
    NEWS_ORDER_LABELS,
    NEWS_PUBLICATION_TYPES,
    NEWS_SOURCE_LABELS,
    NEWS_SOURCES,
    NEWS_TOPIC_LABELS,
    NEWS_TOPICS,
    publicationTypeLabel,
} from "@/lib/news/labels";
import { FilterSelect } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";

const ALL = "all";

/** The search params the filter row reads and writes (the News page and the watchlist feed share them). */
export type NewsFilterValues = Pick<NewsSearch, "category" | "earnings" | "from" | "kind" | "published" | "pubType" | "sort" | "source" | "tag" | "to" | "topic">;

const options = <T extends string>(allLabel: string, values: ReadonlyArray<T>, label: (value: T) => string) => [
    { label: allLabel, value: ALL as T | typeof ALL },
    ...values.map(value => ({ label: label(value), value: value as T | typeof ALL })),
];

const orNone = <T extends string>(value: T | typeof ALL) => (value === ALL ? undefined : value);

/**
 * The News filters, controlled by the route's search (a filter set is a shareable URL). "Company-published" (company
 * scope) selects items the company published itself — its verified newsroom publications, by CIK — not every item
 * that mentions it; publication type and the publisher's own newsroom categories / tags apply only there. Kind (the
 * pipeline's classification), topic (AI-read development topics) and the publisher's categories stay separate controls.
 */
export function NewsFilters({
    categories,
    companyScope = true,
    eventFilter,
    onChange,
    search,
    tags,
    windowFilters = true,
}: {
    /** The publisher's newsroom categories seen in the loaded items. */
    categories: ReadonlyArray<string>;
    /** One company's page: "Company-published" and its pickers (the watchlist feed has several companies: none). */
    companyScope?: boolean;
    /** The "news of one call" picker (company scope). */
    eventFilter?: React.ReactNode;
    onChange: (patch: Partial<NewsFilterValues>) => void;
    search: NewsFilterValues;
    tags: ReadonlyArray<string>;
    /** The day window and the order (off for the live-only market scope: nothing is listed). */
    windowFilters?: boolean;
}) {
    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
                {companyScope && (
                    <Button
                        aria-pressed={search.published === true}
                        onClick={() => onChange(search.published
                            ? { category: undefined, published: undefined, pubType: undefined, tag: undefined }
                            : { published: true })}
                        size="lg"
                        type="button"
                        variant={search.published ? "default" : "outline"}
                    >
                        Company-published
                    </Button>
                )}
                {eventFilter}
                {windowFilters && (
                    <>
                        <DayRange from={search.from} labels={{ from: "From", to: "To" }} onChange={onChange} separatorClassName="text-muted-foreground text-xs" to={search.to} />
                        <FilterSelect
                            aria-label="Order"
                            className="w-[140px]"
                            onValueChange={value => onChange({ sort: value === "oldest" ? "oldest" : undefined })}
                            options={[{ label: NEWS_ORDER_LABELS.newest, value: "newest" }, { label: NEWS_ORDER_LABELS.oldest, value: "oldest" }]}
                            value={search.sort ?? "newest"}
                        />
                    </>
                )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <FilterSelect
                    className="w-[170px]"
                    onValueChange={value => onChange({ source: orNone(value) })}
                    options={options("All sources", NEWS_SOURCES, value => NEWS_SOURCE_LABELS[value])}
                    value={search.source ?? ALL}
                />
                <FilterSelect
                    className="w-[180px]"
                    onValueChange={value => onChange({ kind: orNone(value) })}
                    options={options("All kinds", NEWS_KINDS, value => NEWS_KIND_LABELS[value])}
                    value={search.kind ?? ALL}
                />
                <FilterSelect
                    className="w-[180px]"
                    onValueChange={value => onChange({ topic: orNone(value) })}
                    options={options("All topics", NEWS_TOPICS, value => NEWS_TOPIC_LABELS[value])}
                    value={search.topic ?? ALL}
                />
                <FilterSelect
                    className="w-[170px]"
                    onValueChange={value => onChange({ earnings: orNone(value) })}
                    options={[
                        { label: "Earnings and other", value: ALL },
                        { label: "Earnings news only", value: "true" },
                        { label: "Without earnings news", value: "false" },
                    ]}
                    value={search.earnings ?? ALL}
                />
                {companyScope && search.published && (
                    <>
                        <FilterSelect
                            className="w-[170px]"
                            onValueChange={value => onChange({ pubType: orNone(value) })}
                            options={options("All publication types", NEWS_PUBLICATION_TYPES, publicationTypeLabel)}
                            value={search.pubType ?? ALL}
                        />
                        {(categories.length > 0 || search.category) && (
                            <FilterSelect
                                className="w-[180px]"
                                onValueChange={value => onChange({ category: orNone(value) })}
                                options={options("All newsroom categories", withCurrent(categories, search.category), value => value)}
                                value={search.category ?? ALL}
                            />
                        )}
                        {(tags.length > 0 || search.tag) && (
                            <FilterSelect
                                className="w-[160px]"
                                onValueChange={value => onChange({ tag: orNone(value) })}
                                options={options("All newsroom tags", withCurrent(tags, search.tag), value => value)}
                                value={search.tag ?? ALL}
                            />
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

/** The loaded labels plus the selected one (a filtered list may no longer carry it). */
function withCurrent(values: ReadonlyArray<string>, current: string | undefined) {
    return current && !values.includes(current) ? [current, ...values] : [...values];
}
