import type { LucideIcon } from "lucide-react";

import { useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import { HistoryIcon, LandmarkIcon, SearchIcon } from "lucide-react";
import * as React from "react";

import type { V2Dataset, V2FilerMatch, V2Instrument, V2InstrumentType } from "@/lib/api/types";
import type { HelpLink, NavPage } from "@/lib/navigation";
import type { RecentSubject } from "@/lib/stores/ticker-store";

import { TabStrip } from "@/components/navigation/tab-strip";
import { filerCikParam } from "@/components/sec/security-link";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useInstrumentSearch, useKeyReady, useV2Filers } from "@/lib/api/queries";
import { INSTRUMENT_TYPE_PLURALS, instrumentBadges, servesSection } from "@/lib/instruments";
import { searchPages } from "@/lib/navigation";
import { useTickerStore } from "@/lib/stores/ticker-store";
import { cn } from "@/lib/utils";

/** The category pills (owner 2026-11-21): one active at a time, All by default; task 7 adds People. */
export const SEARCH_PILLS = ["all", "stock", "etf", "closed_end_fund", "etn", "institutions"] as const;

export type SearchPill = (typeof SEARCH_PILLS)[number];

const PILL_OPTIONS = SEARCH_PILLS.map(pill => ({
    label: pill === "all" ? "All" : pill === "institutions" ? "Institutions" : INSTRUMENT_TYPE_PLURALS[pill],
    value: pill,
}));

/** Filers are searched from this many characters (a billed request). */
export const FILER_MIN_CHARS = 3;

/** The typing pause before a request. */
const DEBOUNCE_MS = 300;

const PLACEHOLDER = "Search stocks, ETFs, funds, institutions and pages";

/** One pickable row of the list. */
type SearchOption = {
    badges: ReadonlyArray<string>;
    group: string;
    icon?: LucideIcon;
    id: string;
    label: string;
    logoUrl?: null | string;
    pick: () => void;
    sub: null | string;
};

/** The institutions (`phase=manager`) first, then the other filers of the name (managers first), one row per CIK. */
export function mergeFilers(managers: ReadonlyArray<V2FilerMatch>, others: ReadonlyArray<V2FilerMatch>) {
    const seen = new Set(managers.map(filer => filer.cik));

    const rest = others.filter(filer => !seen.has(filer.cik)).sort((a, b) => Number(b.phase === "manager") - Number(a.phase === "manager"));

    return [...managers, ...rest];
}

/**
 * The instrument hits in the order a typed name means them: the exact ticker first, then names that start with the text
 * ("apple" → Apple Inc. before the leveraged AAPL ETFs), listed before delisted, stocks before funds; the API's order
 * otherwise (stable).
 */
export function rankInstruments<T extends Pick<V2Instrument, "is_active" | "name" | "symbol" | "type">>(query: string, instruments: ReadonlyArray<T>): Array<T> {
    const text = query.trim().toLowerCase();

    const score = (instrument: T) => [
        instrument.symbol.toLowerCase() === text ? 0 : 1,
        (instrument.name ?? "").toLowerCase().startsWith(text) ? 0 : 1,
        instrument.is_active ? 0 : 1,
        instrument.type === "stock" ? 0 : 1,
    ];

    return instruments
        .map((instrument, index) => ({ index, instrument, score: score(instrument) }))
        .sort((a, b) => {
            for (let i = 0; i < a.score.length; i += 1) {
                if (a.score[i] !== b.score[i]) return a.score[i] - b.score[i];
            }

            return a.index - b.index;
        })
        .map(entry => entry.instrument);
}

/** "⌘K" on Apple platforms, "Ctrl K" elsewhere (read once in the browser; "⌘K" during the server render). */
function useShortcutLabel() {
    const [label, setLabel] = React.useState("⌘K");

    React.useEffect(() => {
        const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform;

        if (!/mac|iphone|ipad/i.test(platform)) setLabel("Ctrl K");
    }, []);

    return label;
}

function OptionIcon({ option }: { option: SearchOption }) {
    if (option.icon) {
        const Icon = option.icon;

        return (
            <div className="bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-md">
                <Icon className="size-3.5" />
            </div>
        );
    }

    return (
        <div className="relative size-6 shrink-0">
            <div className="bg-muted text-muted-foreground flex size-6 items-center justify-center rounded-md text-[10px] font-semibold">
                {option.label.slice(0, 1)}
            </div>
            {option.logoUrl
                ? (
                        <img
                            alt=""
                            className="absolute inset-0 size-6 rounded-md bg-background object-contain"
                            loading="lazy"
                            onError={(event) => {
                                // The letter tile behind it shows through.
                                event.currentTarget.style.display = "none";
                            }}
                            src={option.logoUrl}
                        />
                    )
                : null}
        </div>
    );
}

/**
 * The top-bar search (⌘K / Ctrl K, also from inside an input): groups Instruments (`/v1/instruments?q=`, type badges),
 * Institutions & filers (`/v1/filers?q=`, from 3 characters, after a typing pause — billed) and Pages (the navigation
 * table, no request); category pills (All · Stocks · ETFs · Closed-end funds · ETNs · Institutions) send only their own
 * request. Combobox + listbox: arrows move, Enter picks the highlighted or first hit (waiting for an answer in flight);
 * empty = the recently opened subjects. Picking an instrument keeps the current section when it has it.
 */
export function TickerSearch() {
    const navigate = useNavigate();

    const currentTicker = useParams({ select: params => params.ticker, strict: false });

    const pathname = useRouterState({ select: state => state.location.pathname });

    const recents = useTickerStore(state => (state.hasHydrated ? state.recents : []));

    const keyReady = useKeyReady();

    const shortcut = useShortcutLabel();

    const inputRef = React.useRef<HTMLInputElement | null>(null);

    const [open, setOpen] = React.useState(false);

    const [input, setInput] = React.useState("");

    const [pill, setPill] = React.useState<SearchPill>("all");

    const [active, setActive] = React.useState(0);

    // Enter pressed before the answer for the typed text arrived: pick its first hit when it does.
    const [pendingEnter, setPendingEnter] = React.useState(false);

    const query = input.trim();

    const [debounced, setDebounced] = React.useState(query);

    React.useEffect(() => {
        const timer = window.setTimeout(() => setDebounced(query), DEBOUNCE_MS);

        return () => window.clearTimeout(timer);
    }, [query]);

    const instrumentPill = pill !== "institutions";

    const filerPill = pill === "all" || pill === "institutions";

    const types: ReadonlyArray<V2InstrumentType> | undefined = pill === "all" || pill === "institutions" ? undefined : [pill];

    // A pill sends only its own request; nothing before the key answered `/v1/me`.
    const instruments = useInstrumentSearch(keyReady && instrumentPill ? debounced : "", types);

    // Institutions first (`phase=manager`), the other filers below: two billed requests per typing pause.
    const filerQuery = keyReady && filerPill ? debounced : "";

    const managers = useV2Filers({ limit: 10, minLength: FILER_MIN_CHARS, phase: "manager", q: filerQuery });

    const filers = useV2Filers({ limit: 5, minLength: FILER_MIN_CHARS, q: filerQuery });

    const settled = debounced === query && !instruments.isFetching && !managers.isFetching && !filers.isFetching;

    const goToTicker = React.useCallback((ticker: string, datasets?: ReadonlyArray<V2Dataset>) => {
        const normalizedTicker = ticker.toUpperCase();

        // Stay on the same sidebar item (/<old>/news → /<new>/news) unless the new instrument lacks it.
        const section = currentTicker ? pathname.split("/")[2] : undefined;

        if (section && (datasets === undefined || servesSection(datasets, section))) {
            void navigate({ href: `/${encodeURIComponent(normalizedTicker)}/${section}` });

            return;
        }

        void navigate({ params: { ticker: normalizedTicker }, to: "/$ticker" });
    }, [currentTicker, navigate, pathname]);

    const options = React.useMemo((): Array<SearchOption> => {
        const close = (then: () => void) => () => {
            setOpen(false);

            then();
        };

        if (!query) {
            return recents.map((recent: RecentSubject) => ({
                badges: recent.badge ? [recent.badge] : [],
                group: "Recently opened",
                icon: recent.kind === "filer" ? LandmarkIcon : HistoryIcon,
                id: `recent-${recent.kind}-${recent.ref}`,
                label: recent.label,
                pick: close(() => (recent.kind === "filer"
                    ? void navigate({ params: { cik: recent.ref }, to: "/sec/$cik" })
                    : goToTicker(recent.ref))),
                sub: recent.name,
            }));
        }

        const list: Array<SearchOption> = [];

        if (instrumentPill && debounced === query) {
            for (const instrument of rankInstruments(query, instruments.data?.data ?? [])) {
                list.push({
                    badges: instrumentBadges(instrument),
                    group: "Instruments",
                    id: `instrument-${instrument.symbol}`,
                    label: instrument.symbol,
                    logoUrl: instrument.logo_url,
                    pick: close(() => goToTicker(instrument.symbol, instrument.datasets)),
                    sub: instrument.name,
                });
            }
        }

        if (filerPill && debounced === query && query.length >= FILER_MIN_CHARS) {
            for (const filer of mergeFilers(managers.data?.data ?? [], filers.data?.data ?? [])) {
                const cik = filerCikParam(filer.cik);

                if (!cik) continue;

                list.push({
                    badges: [filer.phase === "manager" ? "Institution" : "Filer", ...(filer.listing ? [filer.listing.ticker] : [])],
                    group: "Institutions & filers",
                    icon: LandmarkIcon,
                    id: `filer-${cik}`,
                    label: filer.name,
                    pick: close(() => void navigate({ params: { cik }, to: "/sec/$cik" })),
                    sub: `CIK ${cik}`,
                });
            }
        }

        if (pill === "all") {
            for (const page of searchPages(query) as ReadonlyArray<HelpLink | NavPage>) {
                list.push({
                    badges: ["Page"],
                    group: "Pages",
                    icon: page.icon,
                    id: `page-${page.label}`,
                    label: page.label,
                    pick: close(() => ("href" in page ? void window.open(page.href, "_blank", "noreferrer") : void navigate({ to: page.to }))),
                    sub: page.description,
                });
            }
        }

        return list;
    }, [debounced, filerPill, filers.data, goToTicker, instrumentPill, instruments.data, managers.data, navigate, pill, query, recents]);

    const activeIndex = Math.min(active, Math.max(0, options.length - 1));

    // Enter before the answer: pick the first hit once the typed text has settled.
    React.useEffect(() => {
        if (!pendingEnter || !settled) return;

        setPendingEnter(false);

        options.at(0)?.pick();
    }, [options, pendingEnter, settled]);

    React.useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) return;

            // From anywhere, inside an input too.
            event.preventDefault();

            setOpen(true);
        };

        window.addEventListener("keydown", onKeyDown);

        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    // Every open is a fresh search (trigger, ⌘K): empty text, All, the first row highlighted.
    React.useEffect(() => {
        if (!open) return;

        setInput("");

        setPill("all");

        setActive(0);

        setPendingEnter(false);

        window.setTimeout(() => inputRef.current?.focus(), 0);
    }, [open]);

    const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();

            if (options.length === 0) return;

            const step = event.key === "ArrowDown" ? 1 : -1;

            setActive((activeIndex + step + options.length) % options.length);

            return;
        }

        if (event.key !== "Enter") return;

        event.preventDefault();

        if (!query) {
            options.at(activeIndex)?.pick();

            return;
        }

        if (settled && options.length > 0) options[activeIndex].pick();
        else if (!settled) setPendingEnter(true);
    };

    const listboxId = "app-search-listbox";

    const optionId = (index: number) => `app-search-option-${index}`;

    return (
        <Dialog onOpenChange={setOpen} open={open}>
            <DialogTrigger
                render={(
                    <button
                        aria-label="Search"
                        className="bg-input/20 cursor-text dark:bg-input/30 border-input hover:bg-input/30 dark:hover:bg-input/40 focus-visible:border-ring focus-visible:ring-ring/30 flex h-9 w-full items-center justify-between gap-3 rounded-md border px-3 text-left text-sm outline-none transition-colors focus-visible:ring-2 md:w-[520px]"
                        type="button"
                    />
                )}
            >
                <span className="text-muted-foreground inline-flex min-w-0 items-center gap-2">
                    <SearchIcon className="size-4 shrink-0" />
                    <span className="truncate">Search stocks, ETFs, funds and institutions</span>
                </span>
                <span className="text-muted-foreground shrink-0 text-xs" data-testid="search-shortcut">{shortcut}</span>
            </DialogTrigger>

            <DialogContent
                className="top-2 flex max-h-[min(36rem,calc(100svh-2rem))] w-[calc(100vw-2rem)] max-w-none translate-y-0 flex-col gap-2 overflow-hidden rounded-xl p-3 sm:max-w-[640px]"
                showCloseButton={false}
            >
                <Input
                    aria-activedescendant={options.length > 0 ? optionId(activeIndex) : undefined}
                    aria-autocomplete="list"
                    aria-controls={listboxId}
                    aria-expanded={options.length > 0}
                    aria-label="Search"
                    autoComplete="off"
                    className="h-9 rounded-lg"
                    onChange={(event) => {
                        setInput(event.target.value);

                        setActive(0);
                    }}
                    onKeyDown={onInputKeyDown}
                    placeholder={PLACEHOLDER}
                    ref={inputRef}
                    role="combobox"
                    spellCheck={false}
                    value={input}
                />

                <TabStrip
                    aria-label="Search category"
                    className="self-start"
                    onSelect={(value) => {
                        setPill(value);

                        setActive(0);
                    }}
                    options={PILL_OPTIONS}
                    value={pill}
                />

                <div className="min-h-0 flex-1 overflow-auto">
                    {query && !settled && options.length === 0 && (
                        <div className="text-muted-foreground px-2 py-2">Searching…</div>
                    )}
                    {query && settled && options.length === 0 && (
                        <div className="text-muted-foreground px-2 py-2">
                            {filerPill && query.length < FILER_MIN_CHARS && !instrumentPill ? `Type ${FILER_MIN_CHARS} characters to search institutions.` : "Nothing found"}
                        </div>
                    )}
                    {!query && options.length === 0 && (
                        <div className="text-muted-foreground px-2 py-2">Type a ticker, a name, an institution or a page.</div>
                    )}

                    <div aria-label="Results" className="flex flex-col" id={listboxId} role="listbox">
                        {options.map((option, index) => {
                            const heading = index === 0 || options[index - 1].group !== option.group ? option.group : null;

                            return (
                                <React.Fragment key={option.id}>
                                    {heading && (
                                        <div className="text-muted-foreground px-2 pt-2 pb-1 text-[0.625rem] font-medium tracking-wide uppercase" role="presentation">
                                            {heading}
                                        </div>
                                    )}
                                    <div
                                        aria-selected={index === activeIndex}
                                        className={cn(
                                            "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5",
                                            index === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                                        )}
                                        data-testid="search-option"
                                        id={optionId(index)}
                                        onClick={option.pick}
                                        // The keyboard stays in the combobox (arrows + Enter, `aria-activedescendant`).
                                        onKeyDown={undefined}
                                        onMouseMove={() => index !== activeIndex && setActive(index)}
                                        role="option"
                                        tabIndex={-1}
                                    >
                                        <OptionIcon option={option} />
                                        <div className="min-w-14 shrink-0 font-medium">{option.label}</div>
                                        <div className="text-muted-foreground line-clamp-1 grow">{option.sub}</div>
                                        <div className="flex shrink-0 gap-1">
                                            {option.badges.map(badge => (
                                                <Badge data-testid="search-badge" key={badge} variant="outline">{badge}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
