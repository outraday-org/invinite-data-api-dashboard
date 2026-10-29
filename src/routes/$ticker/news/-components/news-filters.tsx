import type { NewsSearch } from "@/lib/news/labels";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    NEWS_KIND_LABELS,
    NEWS_KINDS,
    NEWS_PUBLICATION_TYPES,
    NEWS_SOURCE_LABELS,
    NEWS_SOURCES,
    NEWS_TOPIC_LABELS,
    NEWS_TOPICS,
    publicationTypeLabel,
} from "@/lib/news/labels";
import { FilterSelect } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";

const ALL = "all";

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
 * "Has media" keeps the items with an original PDF or image the API serves now (`has_media=true`), in either scope.
 */
export function NewsFilters({
    categories,
    onChange,
    search,
    tags,
    ticker,
}: {
    /** The publisher's newsroom categories seen in the loaded items. */
    categories: ReadonlyArray<string>;
    onChange: (patch: Partial<NewsSearch>) => void;
    search: NewsSearch;
    tags: ReadonlyArray<string>;
    ticker: string;
}) {
    const market = search.scope === "market";

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
                <FilterSelect
                    className="w-[170px]"
                    onValueChange={value => onChange({ scope: value === "market" ? "market" : undefined })}
                    options={[
                        { label: `${ticker} news`, value: "company" },
                        { label: "Whole market", value: "market" },
                    ]}
                    value={market ? "market" : "company"}
                />
                {!market && (
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
                <Button
                    aria-pressed={search.media === true}
                    onClick={() => onChange({ media: search.media ? undefined : true })}
                    size="lg"
                    type="button"
                    variant={search.media ? "default" : "outline"}
                >
                    Has media
                </Button>
                <Input
                    aria-label="From"
                    className="w-[150px]"
                    onChange={e => onChange({ from: e.target.value || undefined })}
                    type="date"
                    value={search.from ?? ""}
                />
                <span className="text-muted-foreground text-xs">to</span>
                <Input
                    aria-label="To"
                    className="w-[150px]"
                    onChange={e => onChange({ to: e.target.value || undefined })}
                    type="date"
                    value={search.to ?? ""}
                />
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
                {search.published && (
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
