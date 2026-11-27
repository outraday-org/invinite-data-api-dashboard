import type * as React from "react";

import type { NewsSearch } from "@/lib/news/labels";

import { Button } from "@/components/ui/button";
import { DayRange } from "@/components/ui/day-range";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { FilterSelect } from "@/components/ui/filter-select";
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

const ALL = "all";

/** The search params the filter row reads and writes (the News page and the watchlist feed share them). */
export type NewsFilterValues = Pick<NewsSearch, "category" | "earnings" | "from" | "kind" | "published" | "pubType" | "sort" | "source" | "tag" | "to" | "topic">;

/** Every filter of the bar cleared ("Reset filters"; the News page also clears `event`, the watchlist feed has none). */
export const NEWS_FILTER_RESET = {
    category: undefined,
    earnings: undefined,
    from: undefined,
    kind: undefined,
    published: undefined,
    pubType: undefined,
    sort: undefined,
    source: undefined,
    tag: undefined,
    to: undefined,
    topic: undefined,
} satisfies Record<keyof NewsFilterValues, undefined>;

/** The filters set (the day range counts once). */
export function newsFilterCount(search: NewsFilterValues) {
    return [
        search.published,
        search.pubType,
        search.category,
        search.tag,
        search.kind,
        search.topic,
        search.source,
        search.earnings,
        search.from ?? search.to,
        search.sort,
    ].filter(value => value !== undefined).length;
}

const options = <T extends string>(allLabel: string, values: ReadonlyArray<T>, label: (value: T) => string) => [
    { label: allLabel, value: ALL as T | typeof ALL },
    ...values.map(value => ({ label: label(value), value: value as T | typeof ALL })),
];

const orNone = <T extends string>(value: T | typeof ALL) => (value === ALL ? undefined : value);

/**
 * The News filters as one labelled `FilterBar` (ui-redesign task 11), controlled by the route's search (a filter set is
 * a shareable URL); the caller counts and resets (`newsFilterCount`, `NEWS_FILTER_RESET`). "Company-published" (company
 * scope) selects items the company published itself — its verified newsroom publications, by CIK — not every item
 * that mentions it; publication type and the publisher's own newsroom categories / tags apply only there. Kind (the
 * pipeline's classification), topic (AI-read development topics) and the publisher's categories stay separate controls.
 */
export function NewsFilters({
    activeCount,
    categories,
    companyScope = true,
    eventFilter,
    onChange,
    onReset,
    search,
    tags,
    windowFilters = true,
    windowProblem,
}: {
    /** The filters set (default: `newsFilterCount`). */
    activeCount?: number;
    /** The publisher's newsroom categories seen in the loaded items. */
    categories: ReadonlyArray<string>;
    /** One company's page: "Company-published" and its pickers (the watchlist feed has several companies: none). */
    companyScope?: boolean;
    /** The "news of one call" picker (company scope): gets the field's id. */
    eventFilter?: (id: string) => React.ReactNode;
    onChange: (patch: Partial<NewsFilterValues>) => void;
    /** "Reset filters" (default: `NEWS_FILTER_RESET`). */
    onReset?: () => void;
    search: NewsFilterValues;
    tags: ReadonlyArray<string>;
    /** The day window and the order (off for the live-only market scope: nothing is listed). */
    windowFilters?: boolean;
    windowProblem?: null | string;
}) {
    return (
        <FilterBar activeCount={activeCount ?? newsFilterCount(search)} onReset={onReset ?? (() => onChange(NEWS_FILTER_RESET))}>
            {companyScope && (
                <FilterField label="Published by">
                    <Button
                        aria-pressed={search.published === true}
                        className="w-full justify-start"
                        onClick={() => onChange(search.published
                            ? { category: undefined, published: undefined, pubType: undefined, tag: undefined }
                            : { published: true })}
                        type="button"
                        variant={search.published ? "default" : "outline"}
                    >
                        Company-published
                    </Button>
                </FilterField>
            )}
            {companyScope && search.published && (
                <FilterField label="Publication type">
                    {id => (
                        <FilterSelect
                            aria-label="Publication type"
                            className="w-full"
                            id={id}
                            onValueChange={value => onChange({ pubType: orNone(value) })}
                            options={options("All publication types", NEWS_PUBLICATION_TYPES, publicationTypeLabel)}
                            value={search.pubType ?? ALL}
                        />
                    )}
                </FilterField>
            )}
            {companyScope && search.published && (categories.length > 0 || search.category) && (
                <FilterField label="Newsroom category">
                    {id => (
                        <FilterSelect
                            aria-label="Newsroom category"
                            className="w-full"
                            id={id}
                            onValueChange={value => onChange({ category: orNone(value) })}
                            options={options("All newsroom categories", withCurrent(categories, search.category), value => value)}
                            value={search.category ?? ALL}
                        />
                    )}
                </FilterField>
            )}
            {companyScope && search.published && (tags.length > 0 || search.tag) && (
                <FilterField label="Newsroom tag">
                    {id => (
                        <FilterSelect
                            aria-label="Newsroom tag"
                            className="w-full"
                            id={id}
                            onValueChange={value => onChange({ tag: orNone(value) })}
                            options={options("All newsroom tags", withCurrent(tags, search.tag), value => value)}
                            value={search.tag ?? ALL}
                        />
                    )}
                </FilterField>
            )}
            {eventFilter && <FilterField label="Call">{id => eventFilter(id)}</FilterField>}
            <FilterField label="Kind">
                {id => (
                    <FilterSelect
                        aria-label="Kind"
                        className="w-full"
                        id={id}
                        onValueChange={value => onChange({ kind: orNone(value) })}
                        options={options("All kinds", NEWS_KINDS, value => NEWS_KIND_LABELS[value])}
                        value={search.kind ?? ALL}
                    />
                )}
            </FilterField>
            <FilterField label="Topic">
                {id => (
                    <FilterSelect
                        aria-label="Topic"
                        className="w-full"
                        id={id}
                        onValueChange={value => onChange({ topic: orNone(value) })}
                        options={options("All topics", NEWS_TOPICS, value => NEWS_TOPIC_LABELS[value])}
                        value={search.topic ?? ALL}
                    />
                )}
            </FilterField>
            <FilterField label="Source">
                {id => (
                    <FilterSelect
                        aria-label="Source"
                        className="w-full"
                        id={id}
                        onValueChange={value => onChange({ source: orNone(value) })}
                        options={options("All sources", NEWS_SOURCES, value => NEWS_SOURCE_LABELS[value])}
                        value={search.source ?? ALL}
                    />
                )}
            </FilterField>
            <FilterField label="Earnings">
                {id => (
                    <FilterSelect
                        aria-label="Earnings news"
                        className="w-full"
                        id={id}
                        onValueChange={value => onChange({ earnings: orNone(value) })}
                        options={[
                            { label: "Earnings and other", value: ALL },
                            { label: "Earnings news only", value: "true" },
                            { label: "Without earnings news", value: "false" },
                        ]}
                        value={search.earnings ?? ALL}
                    />
                )}
            </FilterField>
            {windowFilters && (
                <FilterField label="Published" span={2}>
                    <div>
                        <DayRange from={search.from} labels={{ from: "From", to: "To" }} onChange={onChange} to={search.to} />
                        {windowProblem && <p className="text-muted-foreground text-xs" role="status">{windowProblem}</p>}
                    </div>
                </FilterField>
            )}
            {windowFilters && (
                <FilterField label="Order">
                    {id => (
                        <FilterSelect
                            aria-label="Order"
                            className="w-full"
                            id={id}
                            onValueChange={value => onChange({ sort: value === "oldest" ? "oldest" : undefined })}
                            options={[{ label: NEWS_ORDER_LABELS.newest, value: "newest" }, { label: NEWS_ORDER_LABELS.oldest, value: "oldest" }]}
                            value={search.sort ?? "newest"}
                        />
                    )}
                </FilterField>
            )}
        </FilterBar>
    );
}

/** The loaded labels plus the selected one (a filtered list may no longer carry it). */
function withCurrent(values: ReadonlyArray<string>, current: string | undefined) {
    return current && !values.includes(current) ? [current, ...values] : [...values];
}
