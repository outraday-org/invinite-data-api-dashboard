import * as React from "react";

import { Input } from "@/components/ui/input";

/** A four-digit fiscal year in the API's window (the URL schema's `optionalInt(1900, 2200)`), else null. */
export function parseFiscalYear(text: string): null | number {
    if (!/^\d{4}$/.test(text.trim())) return null;

    const year = Number(text.trim());

    return year >= 1900 && year <= 2200 ? year : null;
}

/**
 * One year field: commits 300 ms after the last keystroke, but only an empty field (= no bound) or a valid year — a
 * half-typed "20" sends nothing. A value changed from outside (back button, "Clear") replaces the draft.
 */
function YearInput({ label, onCommit, placeholder, value }: {
    label: string;
    onCommit: (value: number | undefined) => void;
    placeholder: string;
    value: number | undefined;
}) {
    const text = value === undefined ? "" : String(value);

    const [draft, setDraft] = React.useState(text);

    const [committed, setCommitted] = React.useState(text);

    if (committed !== text) {
        setCommitted(text);

        setDraft(text);
    }

    React.useEffect(() => {
        const trimmed = draft.trim();

        if (trimmed === text) return;

        const year = parseFiscalYear(trimmed);

        if (trimmed !== "" && year === null) return;

        const timer = window.setTimeout(() => onCommit(year ?? undefined), 300);

        return () => window.clearTimeout(timer);
    }, [draft, onCommit, text]);

    return (
        <Input
            aria-label={label}
            className="min-w-0 flex-1"
            inputMode="numeric"
            maxLength={4}
            onChange={event => setDraft(event.target.value)}
            placeholder={placeholder}
            value={draft}
        />
    );
}

/**
 * The fiscal-year window of a Financials tab (`fiscal_year.gte` / `fiscal_year.lte`, URL `?fyFrom=&fyTo=`): two year
 * fields filling their `FilterField` ("Fiscal years", the group's label); an empty field is no bound.
 */
export function FiscalYearRange({ from, onChange, to }: {
    from: number | undefined;
    onChange: (patch: { fyFrom?: number; fyTo?: number }) => void;
    to: number | undefined;
}) {
    const commitFrom = React.useCallback((year: number | undefined) => onChange({ fyFrom: year, fyTo: to }), [onChange, to]);

    const commitTo = React.useCallback((year: number | undefined) => onChange({ fyFrom: from, fyTo: year }), [from, onChange]);

    return (
        <div className="flex w-full items-center gap-1.5">
            <YearInput label="Fiscal year from" onCommit={commitFrom} placeholder="from" value={from} />
            <span aria-hidden className="text-muted-foreground">–</span>
            <YearInput label="Fiscal year to" onCommit={commitTo} placeholder="to" value={to} />
        </div>
    );
}
