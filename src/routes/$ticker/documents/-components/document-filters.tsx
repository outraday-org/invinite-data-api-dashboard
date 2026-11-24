import * as React from "react";

import type { DocumentsSearch } from "@/lib/earnings/documents";

import { DropdownSelect } from "@/components/ui/dropdown-select";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { Input } from "@/components/ui/input";
import { ASSET_GROUP_CATEGORIES, categoryLabel, COMPANY_DOCUMENT_KINDS, documentKindLabel, IR_SECTION_KINDS, sectionLabel } from "@/lib/earnings/documents";

const ALL = "all";

const QUERY_DEBOUNCE_MS = 200;

/**
 * The tree's text filter: typed locally, written to `?q=` 200 ms after the last keystroke; follows the URL when it
 * changes elsewhere (Clear, back / forward).
 */
function TextFilter({ id, onChange, value }: { id: string; onChange: (q: string | undefined) => void; value: string | undefined }) {
    const [text, setText] = React.useState(value ?? "");

    const [synced, setSynced] = React.useState(value);

    // The URL moved without this input (the debounced write lands here too, already equal to the text).
    if (value !== synced) {
        setSynced(value);

        if ((value ?? "") !== text.trim()) setText(value ?? "");
    }

    // A new `onChange` per parent render must not restart the debounce.
    const commit = React.useEffectEvent((next: string | undefined) => onChange(next));

    React.useEffect(() => {
        const next = text.trim() || undefined;

        if (next === value) return;

        const timer = setTimeout(() => commit(next), QUERY_DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [text, value]);

    return (
        <Input
            aria-label="Filter documents"
            className="w-full"
            id={id}
            onChange={event => setText(event.target.value)}
            placeholder="Filter: title, kind, folder, year…"
            type="search"
            value={text}
        />
    );
}

/** A typed year, or undefined (empty / out of range = no year filter). */
function parseYear(value: string) {
    const year = Number(value);

    return value.trim() && Number.isInteger(year) && year >= 1990 && year <= 2100 ? year : undefined;
}

/** Every documents filter cleared (the text filter included). */
const FILTER_RESET = { category: undefined, kind: undefined, q: undefined, section: undefined, year: undefined } satisfies Partial<DocumentsSearch>;

/**
 * Documents filters (the text filter and the API's category / section / kind / year) as one labelled `FilterBar`,
 * controlled by the route's search params (a filter set is a shareable URL); "Reset filters" clears them all.
 */
export function DocumentFilters({
    onChange,
    search,
}: {
    onChange: (patch: Partial<DocumentsSearch>) => void;
    search: DocumentsSearch;
}) {
    const activeCount = [search.q, search.category, search.section, search.kind, search.year].filter(value => value !== undefined).length;

    return (
        <FilterBar activeCount={activeCount} onReset={() => onChange(FILTER_RESET)}>
            <FilterField label="Filter">
                {id => <TextFilter id={id} onChange={q => onChange({ q })} value={search.q} />}
            </FilterField>
            <FilterField label="Category">
                {id => (
                    <DropdownSelect
                        aria-label="Category"
                        className="w-full"
                        id={id}
                        onValueChange={value => onChange({ category: value === ALL ? undefined : value as DocumentsSearch["category"] })}
                        options={[{ label: "All categories", value: ALL }, ...ASSET_GROUP_CATEGORIES.map(category => ({ label: categoryLabel(category), value: category }))]}
                        value={search.category ?? ALL}
                    />
                )}
            </FilterField>
            <FilterField label="Section">
                {id => (
                    <DropdownSelect
                        aria-label="Section"
                        className="w-full"
                        id={id}
                        onValueChange={value => onChange({ section: value === ALL ? undefined : value as DocumentsSearch["section"] })}
                        options={[{ label: "All sections", value: ALL }, ...IR_SECTION_KINDS.map(section => ({ label: sectionLabel(section), value: section }))]}
                        value={search.section ?? ALL}
                    />
                )}
            </FilterField>
            <FilterField label="Kind">
                {id => (
                    <DropdownSelect
                        aria-label="Kind"
                        className="w-full"
                        id={id}
                        onValueChange={value => onChange({ kind: value === ALL ? undefined : value as DocumentsSearch["kind"] })}
                        options={[{ label: "All kinds", value: ALL }, ...COMPANY_DOCUMENT_KINDS.map(kind => ({ label: documentKindLabel(kind), value: kind }))]}
                        value={search.kind ?? ALL}
                    />
                )}
            </FilterField>
            <FilterField label="Year">
                {id => (
                    <Input
                        aria-label="Year"
                        className="w-full"
                        defaultValue={search.year ?? ""}
                        id={id}
                        // Committed on blur / Enter (a keystroke filter would refetch on "2", "20", …); remounted when the
                        // URL's year changes (Reset, back / forward).
                        key={search.year ?? "none"}
                        max={2100}
                        min={1990}
                        onBlur={event => onChange({ year: parseYear(event.target.value) })}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") onChange({ year: parseYear(event.currentTarget.value) });
                        }}
                        placeholder="Any year"
                        type="number"
                    />
                )}
            </FilterField>
        </FilterBar>
    );
}
