import { Search } from "lucide-react";
import * as React from "react";

import type { SearchMode } from "@/lib/api/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SEARCH_MODE_LABELS, SEARCH_MODES } from "@/lib/earnings/labels";

/** The shortest query a search box sends (every search is billed: one or two characters are never worth a request). */
export const MIN_SEARCH_QUERY_LENGTH = 2;

/**
 * THE submit-only query box of every search (transcripts, news, company documents, SEC filings, "Search this call"):
 * the typed text is the caller's draft (`value` / `onValueChange`, never the URL); Search (or Enter) hands the trimmed
 * text to `onSubmit` once it has `MIN_SEARCH_QUERY_LENGTH` characters and `canSubmit` holds. The button is disabled
 * while `busy` and reads "Searching…" while `searching` (default `busy`; the news search keeps "Search" while it only
 * loads a next page). `trailing` follows the button (news: the clear ×); `children` are further fields inside the same
 * form (the SEC filters: Enter in a filter submits too), below the query row.
 */
export function SearchQueryForm({
    busy,
    canSubmit = true,
    children,
    label,
    onSubmit,
    onValueChange,
    placeholder,
    searching = busy,
    trailing,
    value,
}: {
    busy: boolean;
    /** A page condition beyond the query length (the SEC search: a symbol or the market-wide scope). */
    canSubmit?: boolean;
    children?: React.ReactNode;
    /** The input's accessible name. */
    label: string;
    onSubmit: (query: string) => void;
    onValueChange: (value: string) => void;
    placeholder: string;
    searching?: boolean;
    trailing?: React.ReactNode;
    value: string;
}) {
    const submittable = canSubmit && value.trim().length >= MIN_SEARCH_QUERY_LENGTH;

    const submit = (event: React.FormEvent) => {
        event.preventDefault();

        if (submittable) onSubmit(value.trim());
    };

    const row = (
        <>
            <Input aria-label={label} maxLength={500} onChange={event => onValueChange(event.target.value)} placeholder={placeholder} value={value} />
            <Button disabled={!submittable || busy} type="submit">
                <Search />
                {searching ? "Searching…" : "Search"}
            </Button>
            {trailing}
        </>
    );

    if (children === undefined) return <form className="flex items-center gap-2" onSubmit={submit}>{row}</form>;

    return (
        <form className="flex flex-col gap-2" onSubmit={submit}>
            <div className="flex items-center gap-2">{row}</div>
            {children}
        </form>
    );
}

/** A toggle chip of a search's option row (mode, type, "Match case"): `aria-pressed`, secondary while on. */
export function SearchChip({ children, onClick, pressed }: { children: React.ReactNode; onClick: () => void; pressed: boolean }) {
    return (
        <Button aria-pressed={pressed} onClick={onClick} size="xs" type="button" variant={pressed ? "secondary" : "outline"}>
            {children}
        </Button>
    );
}

/** The Keyword / Exact chips (`SEARCH_MODES`), as bare chips: the caller's row or group holds them. */
export function SearchModeChips<TMode extends SearchMode>({ mode, onModeChange }: { mode: TMode; onModeChange: (mode: TMode) => void }) {
    return SEARCH_MODES.map(value => (
        <SearchChip key={value} onClick={() => onModeChange(value as TMode)} pressed={mode === value}>
            {SEARCH_MODE_LABELS[value]}
        </SearchChip>
    ));
}

/** The cost line at the end of a search's option row ("10 credits per search"). */
export function SearchCostNote({ children }: { children: React.ReactNode }) {
    return <span className="text-muted-foreground ml-auto text-[0.625rem]">{children}</span>;
}
