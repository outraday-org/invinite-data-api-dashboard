import { useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import * as React from "react";

import type { V2Dataset } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useInstrumentSearch, useKeyReady } from "@/lib/api/queries";
import { instrumentBadges, servesSection } from "@/lib/instruments";
import { useTickerStore } from "@/lib/stores/ticker-store";
import { cn } from "@/lib/utils";

type TickerSearchProps = {
    defaultTicker?: string;
    placeholder?: string;
};

/**
 * The ⌘K search over everything exchange-traded (`GET /v1/instruments?q=`, Data API 7.0): stocks, ETFs, closed-end
 * funds and ETNs, each hit with its type badge ("Trust" for an exchange-traded trust such as GLD).
 */
export function TickerSearch({ defaultTicker = "", placeholder = "Search stocks, ETFs and funds" }: TickerSearchProps) {
    const navigate = useNavigate();

    const currentTicker = useParams({ select: params => params.ticker, strict: false });

    const pathname = useRouterState({ select: state => state.location.pathname });

    const setLastTicker = useTickerStore(state => state.setLastTicker);

    const triggerRef = React.useRef<HTMLButtonElement | null>(null);

    const inputRef = React.useRef<HTMLInputElement | null>(null);

    const [open, setOpen] = React.useState(false);

    const [input, setInput] = React.useState(defaultTicker);

    const trimmedQuery = input.trim();

    const [debouncedQuery, setDebouncedQuery] = React.useState(trimmedQuery);

    const debounceMs = 250;

    React.useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedQuery(trimmedQuery);
        }, debounceMs);

        return () => window.clearTimeout(timer);
    }, [trimmedQuery, debounceMs]);

    // No request (and no toast) before the key answered `/v1/me`.
    const keyReady = useKeyReady();

    const { data, isFetching } = useInstrumentSearch(keyReady ? debouncedQuery : "");

    const instruments = React.useMemo(() => data?.data ?? [], [data]);

    const [anchorStyle, setAnchorStyle] = React.useState<null | React.CSSProperties>(null);

    const updateAnchor = React.useCallback(() => {
        const el = triggerRef.current;

        if (!el) return;

        const rect = el.getBoundingClientRect();

        const padding = 16;

        const width = Math.min(rect.width, window.innerWidth - padding * 2);

        const left = Math.min(
            Math.max(rect.left, padding),
            window.innerWidth - width - padding,
        );

        const top = Math.max(rect.top, padding);

        const maxHeight = Math.max(160, window.innerHeight - top - padding);

        setAnchorStyle({
            left,
            maxHeight,
            top,
            width,
        });
    }, []);

    React.useEffect(() => {
        if (!open) return;

        updateAnchor();

        const onResize = () => updateAnchor();

        window.addEventListener("resize", onResize);

        return () => window.removeEventListener("resize", onResize);
    }, [open, updateAnchor]);

    React.useEffect(() => {
        if (!open) return;

        // reset + focus for the "input only first" state
        setInput("");

        window.setTimeout(() => inputRef.current?.focus(), 0);
    }, [open]);

    React.useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const isK = e.key.toLowerCase() === "k";

            if (!isK) return;

            if (!(e.metaKey || e.ctrlKey)) return;

            const target = e.target as HTMLElement | null;

            const isEditable = target
                && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

            if (isEditable) return;

            e.preventDefault();

            setOpen(true);
        };

        window.addEventListener("keydown", onKeyDown);

        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    /** `datasets` of the picked hit: the section is kept only when the new instrument has it (unknown = typed). */
    const goToTicker = (ticker: string, datasets?: ReadonlyArray<V2Dataset>) => {
        setOpen(false);

        const normalizedTicker = ticker.toUpperCase();

        setLastTicker(normalizedTicker);

        // stay on the same sidebar item: /<old>/news/… → /<new>/news (deeper paths and search are instrument-specific),
        // unless the new instrument has no such section (AAPL's financials → SPY opens SPY's overview)
        const section = currentTicker ? pathname.split("/")[2] : undefined;

        if (section && (datasets === undefined || servesSection(datasets, section))) {
            navigate({ href: `/${encodeURIComponent(normalizedTicker)}/${section}` });

            return;
        }

        navigate({ params: { ticker: normalizedTicker }, to: "/$ticker" });
    };

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!trimmedQuery) return;

        goToTicker(trimmedQuery);
    };

    return (
        <Dialog onOpenChange={setOpen} open={open}>
            <DialogTrigger
                render={(
                    <button
                        aria-label="Search stocks, ETFs and funds"
                        className={cn(
                            "bg-input/20 cursor-text dark:bg-input/30 border-input hover:bg-input/30 dark:hover:bg-input/40 focus-visible:border-ring focus-visible:ring-ring/30 flex h-9 w-full items-center justify-between gap-3 rounded-md border px-3 text-left text-sm outline-none transition-colors focus-visible:ring-2 md:w-[520px]",
                        )}
                        ref={triggerRef}
                        type="button"
                    />
                )}
            >
                <span className="text-muted-foreground inline-flex items-center gap-2">
                    <SearchIcon className="size-4" />
                    <span>{placeholder}</span>
                </span>
                <span className="text-muted-foreground text-xs">⌘K</span>
            </DialogTrigger>

            <DialogContent
                className={cn(
                    "translate-x-0 translate-y-0 flex flex-col w-auto max-w-none sm:max-w-none gap-0 overflow-hidden rounded-xl p-3",
                )}
                showCloseButton={false}
                style={anchorStyle ?? undefined}
            >
                <form className="flex flex-1 flex-col" onSubmit={onSubmit}>
                    <Input
                        autoComplete="off"
                        className="h-9 rounded-lg"
                        onChange={e => setInput(e.target.value)}
                        placeholder={placeholder}
                        ref={inputRef}
                        spellCheck={false}
                        value={input}
                    />

                    {trimmedQuery.length > 0 && (
                        <div className="mt-2 flex-1 overflow-auto">
                            {isFetching && (
                                <div className="text-muted-foreground px-2 py-2 text-xs">
                                    Searching…
                                </div>
                            )}

                            {!isFetching && instruments.length === 0 && (
                                <div className="text-muted-foreground px-2 py-2 text-xs">
                                    Nothing found
                                </div>
                            )}

                            {!isFetching && instruments.length > 0 && instruments.map((instrument) => {
                                const logoUrl = instrument.logo_url ?? null;

                                return (
                                    <button
                                        className="hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm"
                                        key={instrument.symbol}
                                        onClick={() => goToTicker(instrument.symbol, instrument.datasets)}
                                        type="button"
                                    >
                                        <div className="relative size-6 shrink-0">
                                            <div className="bg-muted text-muted-foreground flex size-6 items-center justify-center rounded-md text-[10px] font-semibold">
                                                {instrument.symbol.slice(0, 1)}
                                            </div>
                                            {logoUrl
                                                ? (
                                                        <img
                                                            alt={`${instrument.symbol} logo`}
                                                            className="absolute inset-0 size-6 rounded-md bg-background object-contain"
                                                            loading="lazy"
                                                            onError={(e) => {
                                                                // fallback to the letter tile behind it
                                                                e.currentTarget.style.display = "none";
                                                            }}
                                                            src={logoUrl}
                                                        />
                                                    )
                                                : null}
                                        </div>

                                        <div className="min-w-14 font-medium">{instrument.symbol}</div>
                                        <div className="text-muted-foreground line-clamp-1 grow leading-[1.6] text-xs">
                                            {instrument.name}
                                        </div>
                                        <div className="flex shrink-0 gap-1">
                                            {instrumentBadges(instrument).map(badge => (
                                                <Badge data-testid="search-badge" key={badge} variant="outline">{badge}</Badge>
                                            ))}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </form>
            </DialogContent>
        </Dialog>
    );
}
