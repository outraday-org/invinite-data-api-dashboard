import type { DocumentsSearch } from "@/lib/earnings/documents";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { ASSET_GROUP_CATEGORIES, categoryLabel, COMPANY_DOCUMENT_KINDS, documentKindLabel, IR_SECTION_KINDS, sectionLabel } from "@/lib/earnings/documents";

const ALL = "all";

/** A typed year, or undefined (empty / out of range = no year filter). */
function parseYear(value: string) {
    const year = Number(value);

    return value.trim() && Number.isInteger(year) && year >= 1990 && year <= 2100 ? year : undefined;
}

/** Documents filters, controlled by the route's search params (a filter set is a shareable URL). */
export function DocumentFilters({
    onChange,
    search,
}: {
    onChange: (patch: Partial<DocumentsSearch>) => void;
    search: DocumentsSearch;
}) {
    const active = search.category !== undefined || search.section !== undefined || search.kind !== undefined || search.year !== undefined;

    return (
        <div className="flex flex-wrap items-center gap-2">
            <Select
                onValueChange={value => onChange({ category: value === ALL ? undefined : value as DocumentsSearch["category"] })}
                value={search.category ?? ALL}
            >
                <SelectTrigger aria-label="Category" className="w-[160px]">
                    {search.category ? categoryLabel(search.category) : "All categories"}
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={ALL}>All categories</SelectItem>
                    {ASSET_GROUP_CATEGORIES.map(category => (
                        <SelectItem key={category} value={category}>{categoryLabel(category)}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Select
                onValueChange={value => onChange({ section: value === ALL ? undefined : value as DocumentsSearch["section"] })}
                value={search.section ?? ALL}
            >
                <SelectTrigger aria-label="Section" className="w-[170px]">
                    {search.section ? sectionLabel(search.section) : "All sections"}
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={ALL}>All sections</SelectItem>
                    {IR_SECTION_KINDS.map(section => (
                        <SelectItem key={section} value={section}>{sectionLabel(section)}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Select
                onValueChange={value => onChange({ kind: value === ALL ? undefined : value as DocumentsSearch["kind"] })}
                value={search.kind ?? ALL}
            >
                <SelectTrigger aria-label="Kind" className="w-[190px]">
                    {search.kind ? documentKindLabel(search.kind) : "All kinds"}
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={ALL}>All kinds</SelectItem>
                    {COMPANY_DOCUMENT_KINDS.map(kind => (
                        <SelectItem key={kind} value={kind}>{documentKindLabel(kind)}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Input
                aria-label="Year"
                className="w-[110px]"
                defaultValue={search.year ?? ""}
                // Committed on blur / Enter (a keystroke filter would refetch on "2", "20", …); remounted when the
                // URL's year changes (Clear, back / forward).
                key={search.year ?? "none"}
                max={2100}
                min={1990}
                onBlur={event => onChange({ year: parseYear(event.target.value) })}
                onKeyDown={(event) => {
                    if (event.key === "Enter") onChange({ year: parseYear(event.currentTarget.value) });
                }}
                placeholder="Year"
                type="number"
            />
            {active && (
                <Button onClick={() => onChange({ category: undefined, kind: undefined, section: undefined, year: undefined })} size="xs" type="button" variant="ghost">
                    Clear
                </Button>
            )}
        </div>
    );
}
