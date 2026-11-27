import { Check, Search, X } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { ClearableInput } from "@/components/ui/clearable-input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useInstrumentSearch } from "@/lib/api/queries";
import { isCompanyToken, MAX_COMPANIES } from "@/lib/company-list";
import { cn } from "@/lib/utils";

/** The pause after the last keystroke before the instrument search is asked (every search is a request). */
const SEARCH_PAUSE_MS = 250;

/** Hits shown for a query. */
const HIT_LIMIT = 12;

type CompanyOption = { logoUrl?: null | string; name?: null | string; symbol: string };

/**
 * THE company filter (owner, 2026-11-25): a field-sized button holding one chip per picked company (the row scrolls
 * sideways when they do not fit) with an × beside it that clears them; the button opens `CompanyPickerDialog`. `value`
 * / `onChange` are the tickers / CIKs (a `company=` comma list: `parseCompanyList` / `joinCompanyList`).
 */
export function CompanyFilter({
    id,
    label = "Companies",
    max = MAX_COMPANIES,
    onChange,
    placeholder = "Any company",
    value,
}: {
    /** The trigger's id (a `FilterField`'s `<label htmlFor>`). */
    id?: string;
    label?: string;
    /** Companies the list may hold (default the API's 50 of one `company=` list). */
    max?: number;
    onChange: (next: Array<string>) => void;
    placeholder?: string;
    value: ReadonlyArray<string>;
}) {
    const [open, setOpen] = React.useState(false);

    return (
        <div className="border-input dark:bg-input/30 relative flex h-8 w-full min-w-0 items-center rounded-lg border bg-transparent max-sm:min-h-9" data-slot="company-filter">
            <button
                aria-haspopup="dialog"
                aria-label={value.length > 0 ? `${label}: ${value.join(", ")}` : `${label}: ${placeholder}`}
                className="flex h-full min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-lg py-1 pl-1.5 text-left [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                id={id}
                onClick={() => setOpen(true)}
                type="button"
            >
                {value.length === 0
                    ? <span className="text-muted-foreground truncate px-1">{placeholder}</span>
                    : value.map(symbol => (
                            <span className="bg-muted text-foreground shrink-0 rounded-sm px-1.5 py-0.5 font-mono text-xs font-medium" data-testid="company-chip" key={symbol}>
                                {symbol}
                            </span>
                        ))}
            </button>
            {value.length > 0 && (
                <Button aria-label={`Clear ${label.toLowerCase()}`} className="mr-0.5 shrink-0" onClick={() => onChange([])} size="icon-sm" type="button" variant="ghost">
                    <X />
                </Button>
            )}
            {open && (
                <CompanyPickerDialog
                    initial={value}
                    label={label}
                    max={max}
                    onApply={(next) => {
                        onChange(next);

                        setOpen(false);
                    }}
                    onClose={() => setOpen(false)}
                />
            )}
        </div>
    );
}

/**
 * The picker: a search box over `/v1/instruments?q=` (stocks, `rankInstruments`'s order, a pause before each request)
 * and a list of toggles. Without a query it lists the picked companies, so one is switched off in a click; a typed
 * ticker or CIK the search does not list can be added as typed. Toggles change a draft; "Apply" hands it over, Cancel /
 * Escape drops it.
 */
export function CompanyPickerDialog({
    initial,
    label,
    max = MAX_COMPANIES,
    onApply,
    onClose,
}: {
    initial: ReadonlyArray<string>;
    label: string;
    max?: number;
    onApply: (next: Array<string>) => void;
    onClose: () => void;
}) {
    const [draft, setDraft] = React.useState<Array<string>>(() => [...initial]);

    const [query, setQuery] = React.useState("");

    const inputRef = React.useRef<HTMLInputElement>(null);

    const [asked, setAsked] = React.useState("");

    // Names / logos of the hits seen while the dialog is open, so a picked company keeps its name in the picked list.
    const [known, setKnown] = React.useState<Record<string, CompanyOption>>({});

    React.useEffect(() => {
        const timer = window.setTimeout(() => setAsked(query.trim()), SEARCH_PAUSE_MS);

        return () => window.clearTimeout(timer);
    }, [query]);

    const search = useInstrumentSearch(asked, ["stock"]);

    const typed = query.trim();

    const hits = React.useMemo<Array<CompanyOption>>(() => {
        if (!asked) return [];

        const text = asked.toLowerCase();

        return [...(search.data?.data ?? [])]
            .sort((a, b) => Number(b.symbol.toLowerCase() === text) - Number(a.symbol.toLowerCase() === text)
                || Number((b.name ?? "").toLowerCase().startsWith(text)) - Number((a.name ?? "").toLowerCase().startsWith(text))
                || Number(b.is_active) - Number(a.is_active))
            .slice(0, HIT_LIMIT)
            .map(instrument => ({ logoUrl: instrument.logo_url, name: instrument.name, symbol: instrument.symbol.toUpperCase() }));
    }, [asked, search.data]);

    const full = draft.length >= max;

    const toggle = (option: CompanyOption) => {
        if (option.name || option.logoUrl) setKnown(prev => ({ ...prev, [option.symbol]: option }));

        setDraft(prev => (prev.includes(option.symbol)
            ? prev.filter(symbol => symbol !== option.symbol)
            : prev.length >= max ? prev : [...prev, option.symbol]));
    };

    const showTyped = typed.length > 0 && isCompanyToken(typed) && !hits.some(hit => hit.symbol === typed.toUpperCase());

    const rows: Array<CompanyOption> = typed
        ? [...(showTyped ? [{ symbol: typed.toUpperCase() }] : []), ...hits]
        : draft.map(symbol => known[symbol] ?? { symbol });

    const searching = typed.length > 0 && (typed !== asked || search.isFetching) && hits.length === 0;

    return (
        <Dialog onOpenChange={next => !next && onClose()} open>
            <DialogContent className="flex max-h-[min(36rem,calc(100svh-4rem))] flex-col gap-3 sm:max-w-md" initialFocus={inputRef}>
                <DialogHeader>
                    <DialogTitle>{label}</DialogTitle>
                    <DialogDescription>
                        Search by ticker or name and switch companies on or off. At most
                        {max}
                        .
                    </DialogDescription>
                </DialogHeader>
                <div className="relative">
                    <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                    <ClearableInput
                        aria-label="Search companies"
                        className="pl-8"
                        onChange={event => setQuery(event.target.value)}
                        onClear={() => setQuery("")}
                        onKeyDown={(event) => {
                            // Enter toggles the first row (the exact ticker when one matches).
                            if (event.key === "Enter" && rows.length > 0) {
                                event.preventDefault();

                                toggle(rows[0]);
                            }
                        }}
                        placeholder="Ticker, name or CIK"
                        ref={inputRef}
                        value={query}
                    />
                </div>
                <p className="text-muted-foreground text-xs" data-testid="company-picker-caption">
                    {typed ? "Results" : draft.length > 0 ? `Selected (${draft.length})` : "No company selected: every company is shown."}
                </p>
                <ul aria-label={typed ? "Results" : "Selected companies"} className="-mx-1 min-h-0 flex-1 overflow-y-auto">
                    {rows.map((option) => {
                        const on = draft.includes(option.symbol);

                        return (
                            <li key={option.symbol}>
                                <button
                                    aria-pressed={on}
                                    className={cn("hover:bg-muted flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left disabled:opacity-50", on && "bg-muted/60")}
                                    disabled={!on && full}
                                    onClick={() => toggle(option)}
                                    type="button"
                                >
                                    <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-sm border", on ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
                                        {on && <Check className="size-3" />}
                                    </span>
                                    {option.logoUrl
                                        ? <img alt="" className="size-5 shrink-0 rounded-sm object-contain" src={option.logoUrl} />
                                        : <span className="size-5 shrink-0" />}
                                    <span className="w-16 shrink-0 font-mono text-xs font-medium">{option.symbol}</span>
                                    <span className="text-muted-foreground min-w-0 flex-1 truncate">
                                        {option.name ?? (typed && option.symbol === typed.toUpperCase() && showTyped ? "Add as typed" : "")}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                    {searching && Array.from({ length: 3 }, (_, index) => <li className="px-2 py-1.5" key={index}><Skeleton className="h-5 w-full" /></li>)}
                    {typed && !searching && rows.length === 0 && <li className="text-muted-foreground px-2 py-3 text-sm">No company matches.</li>}
                </ul>
                <DialogFooter className="flex-row items-center sm:justify-between">
                    <Button disabled={draft.length === 0} onClick={() => setDraft([])} type="button" variant="ghost">
                        Clear all
                    </Button>
                    <div className="flex gap-2">
                        <Button onClick={onClose} type="button" variant="outline">Cancel</Button>
                        <Button onClick={() => onApply(draft)} type="button">{draft.length > 0 ? `Apply (${draft.length})` : "Apply"}</Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
