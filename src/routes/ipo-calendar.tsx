import type { ColumnDef } from "@tanstack/react-table";

import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";
import { z } from "zod";

import type { V2Ipo, V2IposResponse, V2IpoStage } from "@/lib/api/types";

import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { V2MetaLine } from "@/components/sec/v2-meta-line";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { DayRange } from "@/components/ui/day-range";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { FilterSelect } from "@/components/ui/filter-select";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Stat, StatGrid } from "@/components/ui/stat";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIpo, useV2IposInfinite } from "@/lib/api/queries";
import { V2_IPO_STAGES } from "@/lib/api/v2";
import { zonedDate } from "@/lib/earnings/format";
import { formatDay, formatInstant, formatShares } from "@/lib/format";
import { titleHead } from "@/lib/layout";
import { isV2GenuineEmpty } from "@/lib/sec/readiness";
import { IN_PLACE } from "@/lib/url-state";

const IPO_TABS = ["upcoming", "recent"] as const;

const ipoSearchSchema = z.object({
    from: z.iso.date().optional().catch(undefined),
    spac: z.enum(["yes", "no"]).optional().catch(undefined),
    stage: z.enum(V2_IPO_STAGES).optional().catch(undefined),
    tab: z.enum(IPO_TABS).optional().catch(undefined),
    to: z.iso.date().optional().catch(undefined),
});

export type IpoSearch = z.infer<typeof ipoSearchSchema>;

export const Route = createFileRoute("/ipo-calendar")({
    component: IposPage,
    head: () => titleHead("IPO calendar"),
    validateSearch: ipoSearchSchema,
});

/** Offerings per page of `/v1/ipos` (one page per `next_cursor`). */
const IPOS_PAGE = 50;

const ALL = "all";

type StageFilter = typeof ALL | V2IpoStage;

/** One vocabulary for the registration stages and the listing calendar's status. */
export const IPO_STAGE_LABELS: Record<V2IpoStage, string> = {
    announced: "Announced",
    effective: "Effective",
    exchange_approved: "Exchange approved",
    postponed: "Postponed",
    price_range: "Price range",
    priced: "Priced",
    registered: "Registered",
    trading: "Trading",
    withdrawn: "Withdrawn",
};

const STAGE_OPTIONS: Array<{ label: string; value: StageFilter }> = [
    { label: "Every stage", value: ALL },
    ...V2_IPO_STAGES.map(stage => ({ label: IPO_STAGE_LABELS[stage], value: stage as StageFilter })),
];

/** An amount in the offering's currency (plain number when the currency is missing or unknown). */
export function formatOfferAmount(value: null | number, currency: null | string) {
    if (value === null || !Number.isFinite(value)) return "—";

    if (currency) {
        try {
            return new Intl.NumberFormat("en", { currency, maximumFractionDigits: 2, style: "currency" }).format(value);
        }
        catch {
            // An unknown currency code: the plain number below.
        }
    }

    return new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);
}

/** The offer price: the final price, else the range ("$16 – $18"), else "—". */
export function offerPriceText(ipo: Pick<V2Ipo, "currency" | "final_price" | "price_range_high" | "price_range_low">) {
    if (ipo.final_price !== null) return formatOfferAmount(ipo.final_price, ipo.currency);

    const { price_range_high: high, price_range_low: low } = ipo;

    if (low !== null && high !== null && low !== high) {
        return `${formatOfferAmount(low, ipo.currency)} – ${formatOfferAmount(high, ipo.currency)}`;
    }

    return formatOfferAmount(low ?? high, ipo.currency);
}

/** The issuer's SEC CIK (unpadded) for its `/sec/$cik` page: the company row's, else the registration track's. */
export function ipoIssuerCik(ipo: Pick<V2Ipo, "company" | "sources">) {
    const cik = ipo.company?.cik ?? ipo.sources.registration?.cik ?? null;

    return cik && /^\d{1,10}$/.test(cik) && Number(cik) > 0 ? String(Number(cik)) : null;
}

/** The listed ticker (the company row's, else the listing calendar's), else null. */
export function ipoListedTicker(ipo: Pick<V2Ipo, "company" | "sources">) {
    return ipo.company?.ticker ?? ipo.sources.listing?.ticker ?? null;
}

/** The listed ticker, else the proposed symbols (marked as proposed), else "—". */
export function ipoSymbolText(ipo: Pick<V2Ipo, "company" | "proposed_symbols" | "sources">) {
    const listed = ipoListedTicker(ipo);

    if (listed) return listed;

    return ipo.proposed_symbols.length > 0 ? `${ipo.proposed_symbols.join(", ")} (proposed)` : "—";
}

const COLUMNS: Array<ColumnDef<V2Ipo>> = [
    {
        accessorKey: "listing_date",
        cell: ({ row }) => formatDay(row.original.listing_date),
        header: "Listing date",
    },
    {
        cell: ({ row }) => {
            const listed = ipoListedTicker(row.original);

            return listed
                ? (
                        <Link className="font-medium underline-offset-4 hover:underline" params={{ ticker: listed }} to="/$ticker">
                            {listed}
                        </Link>
                    )
                : ipoSymbolText(row.original);
        },
        header: "Symbol",
        id: "symbol",
    },
    {
        accessorKey: "issuer_name",
        cell: ({ row }) => {
            const cik = ipoIssuerCik(row.original);

            const name = row.original.issuer_name || "—";

            return (
                <div className="flex items-center gap-1">
                    {cik
                        ? (
                                <Link
                                    className="truncate underline-offset-4 hover:underline"
                                    params={{ cik }}
                                    title="SEC filer: identity, lifecycle, filings and Form D private offerings"
                                    to="/sec/$cik"
                                >
                                    {name}
                                </Link>
                            )
                        : <span className="truncate">{name}</span>}
                    {row.original.is_spac && <Badge variant="outline">SPAC</Badge>}
                </div>
            );
        },
        header: "Issuer",
    },
    {
        accessorKey: "stage",
        cell: ({ row }) => <Badge variant="outline">{IPO_STAGE_LABELS[row.original.stage]}</Badge>,
        header: "Stage",
    },
    {
        accessorKey: "exchange",
        cell: ({ row }) => <span title="Exchange (MIC)">{row.original.exchange ?? "—"}</span>,
        header: "Exchange",
    },
    {
        cell: ({ row }) => <div className="text-right tabular-nums">{offerPriceText(row.original)}</div>,
        header: () => <div className="text-right">Price</div>,
        id: "price",
    },
    {
        accessorKey: "shares_offered",
        cell: ({ row }) => (
            <div className="text-right tabular-nums">
                {formatShares(row.original.shares_offered)}
            </div>
        ),
        header: () => <div className="text-right">Shares</div>,
    },
    {
        accessorKey: "total_offer_size",
        cell: ({ row }) => (
            <div className="text-right tabular-nums">{formatOfferAmount(row.original.total_offer_size, row.original.currency)}</div>
        ),
        header: () => <div className="text-right">Offer size</div>,
    },
    {
        cell: ({ row }) => {
            const { listing, registration } = row.original.sources;

            return (
                <div className="flex flex-wrap gap-1">
                    {registration && (
                        <Badge title={`SEC registration ${registration.form_family} · ${registration.track_key}`} variant="secondary">
                            Registration
                        </Badge>
                    )}
                    {listing && <Badge title="Listing calendar" variant="secondary">Listing</Badge>}
                </div>
            );
        },
        header: "Sources",
        id: "sources",
    },
];

/** The offerings list (pure): the request's honest state, the answer's coverage, the rows and "Load more". */
export function IposView({
    error,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    onLoadMore,
    onOpen,
    pages,
}: {
    error: unknown;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    onLoadMore: () => void;
    /** Opens a row's detail (stage timestamps, pricing); no detail column without it. */
    onOpen?: (ipo: V2Ipo) => void;
    pages: ReadonlyArray<V2IposResponse>;
}) {
    const rows = React.useMemo(() => pages.flatMap(page => page.data), [pages]);

    const columns = React.useMemo<Array<ColumnDef<V2Ipo>>>(() => (onOpen
        ? [...COLUMNS, {
                cell: ({ row }) => (
                    <Button onClick={() => onOpen(row.original)} size="xs" type="button" variant="outline">
                        Details
                    </Button>
                ),
                header: "",
                id: "details",
            }]
        : COLUMNS), [onOpen]);

    if (error && pages.length === 0) return <SecReadinessNotice error={error} title="Failed to load IPOs" />;

    const meta = pages.at(0)?.meta;

    return (
        <div className="flex flex-col gap-2">
            <SecReadinessNotice coverage={meta?.coverage} />
            <V2MetaLine meta={meta} />
            <DataTable
                columns={columns}
                emptyIsGenuine={isV2GenuineEmpty(meta?.coverage)}
                emptyText="No IPOs match these filters."
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                onLoadMore={onLoadMore}
                rows={rows}
            />
            {error ? <SecReadinessNotice error={error} title="Failed to load more IPOs" /> : null}
        </div>
    );
}

/** Today's New York day (`YYYY-MM-DD`). */
const newYorkToday = () => zonedDate(new Date(), "America/New_York");

/** The request of a tab: Upcoming = every offering not yet trading or withdrawn, listing on or after today (New York)
 * by listing date ascending, so page 1 starts at the next listing (backend data-api-ui-walk-findings task 3, F013);
 * Recent = listed on or before today, newest first. A date range replaces the defaults. The offerings without a listing
 * date yet follow the Upcoming list (`upcomingUndatedRequest`): a `listing_date` range never matches them. */
export function ipoRequest(search: IpoSearch, today: string) {
    const recent = search.tab === "recent";

    const stage = search.stage ? [search.stage] : recent ? undefined : V2_IPO_STAGES.filter(value => value !== "trading" && value !== "withdrawn");

    return {
        isSpac: search.spac === undefined ? undefined : search.spac === "yes",
        limit: IPOS_PAGE,
        listingDateGte: search.from ?? (recent || search.to !== undefined ? undefined : today),
        listingDateLte: search.to ?? (recent ? today : undefined),
        sort: recent ? "-listing_date" as const : "listing_date" as const,
        stage,
    };
}

/** The Upcoming tab's tail: the same offerings without the date floor; the API sorts the ones without a listing date
 * last (owner decision D4), and only those are shown from it (the dated ones were listed above). None for Recent or a
 * user's date range (a range never matches an undated offering). */
export function upcomingUndatedRequest(search: IpoSearch, today: string) {
    if (search.tab === "recent" || search.from !== undefined || search.to !== undefined) return null;

    return { ...ipoRequest(search, today), listingDateGte: undefined };
}

/** The undated rows of the tail's pages (`listing_date` null). */
export const undatedPages = (pages: ReadonlyArray<V2IposResponse>) =>
    pages.map(page => ({ ...page, data: page.data.filter(ipo => ipo.listing_date === null) }));

/** One offering's detail (`GET /v1/ipos/{ipo_id}`, the row while it loads): stage timestamps and pricing. */
export function IpoDetail({ ipo }: { ipo: V2Ipo }) {
    const registration = ipo.sources.registration;

    const listing = ipo.sources.listing;

    const timeline: Array<[string, null | string]> = [
        ["First public (SEC)", registration?.first_public_at ? formatInstant(registration.first_public_at) : null],
        ["Price range set", registration?.price_range_at ? formatInstant(registration.price_range_at) : null],
        ["Exchange approved", registration?.exchange_approved_at ? formatInstant(registration.exchange_approved_at) : null],
        ["Effective", registration?.effective_at ? formatInstant(registration.effective_at) : null],
        ["Priced", registration?.priced_at ? formatInstant(registration.priced_at) : null],
        ["Withdrawn", registration?.withdrawn_at ? formatInstant(registration.withdrawn_at) : null],
        ["First trade", registration?.first_trade_date ? formatDay(registration.first_trade_date) : null],
        ["Announced (listing calendar)", listing?.announced_date ? formatDay(listing.announced_date) : null],
        ["Listing date", ipo.listing_date ? formatDay(ipo.listing_date) : null],
        ["Registration", registration ? `${registration.form_family} · ${registration.track_key}` : null],
    ];

    const cik = ipoIssuerCik(ipo);

    const listed = ipoListedTicker(ipo);

    const linkClass = "underline-offset-4 hover:underline";

    const steps = timeline.filter((fact): fact is [string, string] => Boolean(fact[1]));

    return (
        <div className="flex min-w-0 flex-col gap-5" data-testid="ipo-detail">
            <StatGrid>
                <Stat
                    label="Issuer"
                    value={cik
                        ? <Link className={linkClass} params={{ cik }} title="SEC filer: identity, lifecycle, filings and Form D private offerings" to="/sec/$cik">{ipo.issuer_name || `CIK ${cik}`}</Link>
                        : ipo.issuer_name || "—"}
                />
                <Stat label="Symbol" value={listed ? <Link className={linkClass} params={{ ticker: listed }} to="/$ticker">{listed}</Link> : ipoSymbolText(ipo)} />
                <Stat label="Stage" value={IPO_STAGE_LABELS[ipo.stage]} />
                {ipo.exchange && <Stat label="Exchange" value={ipo.exchange} />}
                <Stat label="Price" value={offerPriceText(ipo)} />
                <Stat label="Shares offered" value={formatShares(ipo.shares_offered)} />
                <Stat label="Offer size" value={formatOfferAmount(ipo.total_offer_size, ipo.currency)} />
            </StatGrid>
            {steps.length > 0 && (
                <Section title="Timeline">
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
                        {steps.map(([label, value]) => (
                            <React.Fragment key={label}>
                                <dt className="text-muted-foreground">{label}</dt>
                                <dd className="tabular-nums">{value}</dd>
                            </React.Fragment>
                        ))}
                    </dl>
                </Section>
            )}
        </div>
    );
}

function IpoDetailDialog({ ipo, onClose }: { ipo: null | V2Ipo; onClose: () => void }) {
    const { data, error } = useIpo(ipo?.ipo_id ?? "");

    const shown = data ?? ipo;

    return (
        <Dialog onOpenChange={open => !open && onClose()} open={ipo !== null}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{shown?.issuer_name ?? "Offering"}</DialogTitle>
                </DialogHeader>
                {shown && <IpoDetail ipo={shown} />}
                {error ? <SecReadinessNotice error={error} title="Failed to refresh the offering" /> : null}
            </DialogContent>
        </Dialog>
    );
}

const SPAC_OPTIONS = [
    { label: "SPACs and others", value: ALL },
    { label: "SPACs only", value: "yes" },
    { label: "No SPACs", value: "no" },
] satisfies Array<{ label: string; value: "no" | "yes" | typeof ALL }>;

/**
 * The IPO calendar (`/v1/ipos`, market-wide): Upcoming (by listing date ascending) and Recent (newest listing first),
 * stage, SPAC and listing-date filters in the URL; a listed symbol opens its page, the issuer its SEC filer page, a row's
 * "Details" the offering (`/v1/ipos/{ipo_id}`).
 */
function IposPage() {
    const search = Route.useSearch();

    const navigate = Route.useNavigate();

    const [today] = React.useState(newYorkToday);

    const [open, setOpen] = React.useState<null | V2Ipo>(null);

    const dated = useV2IposInfinite(ipoRequest(search, today));

    const tailRequest = upcomingUndatedRequest(search, today);

    // The undated tail starts once the dated list is complete.
    const tail = useV2IposInfinite(tailRequest ?? ipoRequest(search, today), {
        enabled: tailRequest !== null && !dated.isLoading && dated.data !== null && !dated.hasNextPage,
    });

    const tailActive = tailRequest !== null && !dated.hasNextPage && tail.data !== null;

    const tailPages = React.useMemo(() => (tailActive ? undatedPages(tail.data?.pages ?? []) : []), [tailActive, tail.data]);

    // A tail page of dated rows only (the dated offerings come first) shows nothing: ask for the next one at once.
    const lastTailEmpty = tailPages.at(-1)?.data.length === 0;

    React.useEffect(() => {
        if (tailActive && lastTailEmpty && tail.hasNextPage && !tail.isFetchingNextPage) void tail.fetchNextPage();
    }, [tailActive, lastTailEmpty, tail]);

    const pages = React.useMemo(() => [...(dated.data?.pages ?? []), ...tailPages], [dated.data, tailPages]);

    const error = dated.error ?? (tailActive ? tail.error : null);

    const onChange = (patch: Partial<IpoSearch>) => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, ...patch }) });

    return (
        <PageContainer>
            <PageHeader
                description="Offerings from SEC registration to listing. Upcoming = not trading or withdrawn yet, from the next listing date on (offerings without one last); Recent = listed, newest first."
                title="IPO calendar"
            />
            <Tabs onValueChange={value => onChange({ tab: value === "recent" ? "recent" : undefined })} value={search.tab ?? "upcoming"}>
                <TabsList aria-label="IPOs" variant="line">
                    <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                    <TabsTrigger value="recent">Recent</TabsTrigger>
                </TabsList>
            </Tabs>
            <FilterBar
                activeCount={[search.stage, search.spac, search.from ?? search.to].filter(value => value !== undefined).length}
                onReset={() => onChange({ from: undefined, spac: undefined, stage: undefined, to: undefined })}
            >
                <FilterField label="Stage">
                    {id => (
                        <FilterSelect
                            aria-label="Stage"
                            className="w-full"
                            id={id}
                            onValueChange={(value: StageFilter) => onChange({ stage: value === ALL ? undefined : value })}
                            options={STAGE_OPTIONS}
                            value={search.stage ?? ALL}
                        />
                    )}
                </FilterField>
                <FilterField label="SPAC">
                    {id => (
                        <FilterSelect
                            aria-label="SPAC"
                            className="w-full"
                            id={id}
                            onValueChange={value => onChange({ spac: value === ALL ? undefined : value })}
                            options={SPAC_OPTIONS}
                            value={search.spac ?? ALL}
                        />
                    )}
                </FilterField>
                <FilterField label="Listing date" span={2}>
                    <DayRange from={search.from} labels={{ from: "Listing from", to: "Listing to" }} onChange={onChange} to={search.to} />
                </FilterField>
            </FilterBar>

            <IposView
                error={error}
                hasNextPage={dated.hasNextPage || (tailActive && tail.hasNextPage)}
                isFetchingNextPage={dated.isFetchingNextPage || tail.isFetchingNextPage}
                isLoading={dated.isLoading}
                onLoadMore={() => void (dated.hasNextPage ? dated.fetchNextPage() : tail.fetchNextPage())}
                onOpen={setOpen}
                pages={pages}
            />
            <IpoDetailDialog ipo={open} onClose={() => setOpen(null)} />
        </PageContainer>
    );
}
