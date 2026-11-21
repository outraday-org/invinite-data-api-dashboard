import type { ReactNode } from "react";

import { createFileRoute, Link } from "@tanstack/react-router";

import type { FinancialView } from "@/components/financials-pages/views";
import type { V2CompanyCoverage, V2CompanyResponse, V2Dataset, V2Event, V2Filing, V2Fund, V2FundPositionsResponse, V2Instrument } from "@/lib/api/types";
import type { TickerPath } from "@/lib/navigation";

import { AlertEntryPoints, ENTRY_TYPES } from "@/components/alerts/create-alert-button";
import { FiscalPeriodsCard } from "@/components/reference/fiscal-periods-card";
import { FundAdvisersView, FundSourceBadge } from "@/components/sec/fund-views";
import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiRequestError } from "@/lib/api/errors";
import { useFund, useFundPositionsInfinite, useInstrument, useV2Company, useV2EventsInfinite, useV2FilingsInfinite } from "@/lib/api/queries";
import { coverageEntries } from "@/lib/api/v2";
import { eventLabel, formatCallTime } from "@/lib/earnings/format";
import { formatDay, formatMoneyCompact, formatNumber, formatShares } from "@/lib/format";
import { datasetGateText, FUND_STRUCTURE_LABELS, INSTRUMENT_TYPE_LABELS, isFundType } from "@/lib/instruments";
import { tickerHead } from "@/lib/layout";
import { fundReasonText, netAssetsScopeText } from "@/lib/sec/fund";
import { formatFractionPercentCompact, formatNumberEn } from "@/lib/utils";
import { EventLink } from "@/routes/$ticker/earnings-calls/-components/event-link";

export const Route = createFileRoute("/$ticker/")({
    component: TickerOverview,
    head: ({ params }) => tickerHead(params.ticker, "Overview"),
});

/**
 * The overview of one instrument (Data API 7.0): a stock's company profile (`/v1/companies/{company}`), a fund's profile
 * (`/v1/funds/{fund}`) or, for an ETN, the instrument itself. The layout already read the instrument (same query).
 */
function TickerOverview() {
    const { ticker } = Route.useParams();

    const { data: instrument, isLoading } = useInstrument(ticker);

    if (isLoading) return <Skeleton className="h-64 w-full" />;

    // The layout renders the unknown / failed instrument states.
    if (!instrument) return null;

    const overview = instrument.type === "stock"
        ? <CompanyOverview datasets={instrument.datasets} ticker={ticker} />
        : isFundType(instrument.type) ? <FundOverview instrument={instrument} ticker={ticker} /> : <InstrumentCard instrument={instrument} />;

    return (
        <div className="flex flex-col gap-4">
            {/* "Create alert" (price types; a stock's metrics too) and the ticker's alerts link (alerts task 4). */}
            <div className="flex justify-end empty:hidden">
                <AlertEntryPoints symbol={ticker} types={ENTRY_TYPES.overview} />
            </div>
            {overview}
        </div>
    );
}

function CompanyOverview({ datasets, ticker }: { datasets: ReadonlyArray<V2Dataset>; ticker: string }) {
    const { data: company, error, isLoading } = useV2Company(ticker, { expand: ["coverage"] });

    if (error instanceof ApiRequestError && error.code === "not_covered") {
        return <Notice badge="Not covered" title={`${ticker} is not covered by the Invinite API`}>{error.message}</Notice>;
    }

    if (error) {
        return <ErrorState error={error} title="Failed to load company details" />;
    }

    if (isLoading) {
        return <Skeleton className="h-64 w-full" />;
    }

    if (!company) {
        return <div className="text-muted-foreground">No company data found.</div>;
    }

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <OverviewTiles company={company} datasets={datasets} ticker={ticker} />

            <Card className="border-border/60">
                <CardHeader>
                    <CardTitle>Company Info</CardTitle>
                    <CardDescription>Basic details from the Invinite API</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Ticker</span>
                        <span className="font-medium">{company.ticker}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">CIK</span>
                        {company.filer_cik
                            ? (
                                    <Link
                                        className="font-medium underline-offset-4 hover:underline"
                                        params={{ cik: company.filer_cik }}
                                        title="SEC filer: identity, lifecycle and filings"
                                        to="/sec/$cik"
                                    >
                                        {company.cik}
                                    </Link>
                                )
                            : <span className="font-medium">{company.cik}</span>}
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Sector</span>
                        <span className="font-medium">{company.sector}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Industry</span>
                        <span className="font-medium">{company.industry}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Currency</span>
                        <span className="font-medium">{company.currency}</span>
                    </div>
                    {company.employees != null && (
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Employees</span>
                            <span className="font-medium">{formatNumber(company.employees)}</span>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="border-border/60">
                <CardHeader>
                    <CardTitle>Market Data</CardTitle>
                    <CardDescription>Key financial metrics</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                    {company.market_cap != null && (
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Market Cap</span>
                            <span className="font-medium">{formatMoneyCompact(company.market_cap)}</span>
                        </div>
                    )}
                    {company.shares_outstanding != null && (
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Shares Outstanding</span>
                            <span className="font-medium">{formatShares(company.shares_outstanding)}</span>
                        </div>
                    )}
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Exchange</span>
                        <span className="font-medium">{company.exchange ?? "-"}</span>
                    </div>
                    {company.list_date && (
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Listed since</span>
                            <span className="font-medium">
                                {formatDay(company.list_date)}
                            </span>
                        </div>
                    )}
                </CardContent>
            </Card>

            <CoverageCard coverage={company.coverage} ticker={ticker} />

            {/* O7 group 7: the fiscal calendar (asked only when the instrument has the dataset, as the filings list does). */}
            {datasets.includes("fiscal_periods") && <FiscalPeriodsCard ticker={ticker} />}

            {company.description && (
                <Card className="border-border/60 md:col-span-2">
                    <CardHeader>
                        <CardTitle>Description</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            {company.description}
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

/** The overview section a coverage family's data lives on (a family without a page = a plain badge). */
const COVERAGE_SECTIONS: Partial<Record<string, { to: "/$ticker/financials"; view: FinancialView } | { to: TickerPath }>> = {
    dividends: { to: "/$ticker/dividends" },
    events: { to: "/$ticker/earnings-calls" },
    filings: { to: "/$ticker/filings" },
    financials: { to: "/$ticker/financials" },
    holdings: { to: "/$ticker/holders" },
    insider_trades: { to: "/$ticker/insider-trades" },
    metrics: { to: "/$ticker/financials", view: "ratios" },
    news: { to: "/$ticker/news" },
    segments: { to: "/$ticker/financials", view: "segments" },
    splits: { to: "/$ticker/stock-splits" },
};

/** `expand=coverage`: which data families hold rows for the company (or fund) and through which day; each links its section. */
export function CoverageCard({ coverage, noun = "company", ticker }: { coverage: null | undefined | V2CompanyCoverage; noun?: "company" | "fund"; ticker: string }) {
    const entries = coverageEntries(coverage);

    return (
        <Card className="border-border/60 md:col-span-2">
            <CardHeader>
                <CardTitle>Data available</CardTitle>
                <CardDescription>{`The data families that hold rows for this ${noun}`}</CardDescription>
            </CardHeader>
            <CardContent>
                {entries.length === 0
                    ? <div className="text-muted-foreground text-sm">{`No data family holds rows for this ${noun} yet.`}</div>
                    : (
                            <div className="flex flex-wrap gap-2">
                                {entries.map((entry) => {
                                    const target = COVERAGE_SECTIONS[entry.family];

                                    const badge = <Badge variant="secondary">{entry.text}</Badge>;

                                    if (!target) return <span key={entry.family}>{badge}</span>;

                                    return "view" in target
                                        ? <Link className="rounded-md hover:opacity-80" key={entry.family} params={{ ticker }} search={{ view: target.view }} to={target.to}>{badge}</Link>
                                        : <Link className="rounded-md hover:opacity-80" key={entry.family} params={{ ticker }} to={target.to}>{badge}</Link>;
                                })}
                            </div>
                        )}
            </CardContent>
        </Card>
    );
}

/** A public https link of the company (its website, its IR site), else null. */
const httpsHref = (url: null | string | undefined) => (url && /^https?:\/\//i.test(url) ? url : null);

/** The company fields the overview tiles read (all from `/v1/companies/{company}`, already fetched: no request). */
export type CompanyTileFields = Pick<
    V2CompanyResponse,
    | "city"
    | "composite_figi"
    | "country_code"
    | "homepage_url"
    | "insider_own_pct"
    | "insider_own_shares"
    | "inst_own_pct"
    | "inst_own_shares"
    | "investor_relations_url"
    | "is_delisted"
    | "short_float_pct"
    | "short_float_shares"
    | "state"
    | "street"
    | "zip_code"
>;

/**
 * The overview's tiles: the next call (links to it), the latest filing, the website and IR site; then ownership
 * (institutional, insider, short float), address and the listing (FIGI, delisted).
 */
export function OverviewTiles({ company, datasets, ticker }: { company: CompanyTileFields; datasets: ReadonlyArray<V2Dataset>; ticker: string }) {
    const hasEvents = datasets.includes("events");

    const hasFilings = datasets.includes("filings");

    const next = useV2EventsInfinite({ company: ticker, enabled: hasEvents, limit: 1, sort: "scheduled_at", status: ["upcoming"], toastErrors: false, type: "all" });

    const filings = useV2FilingsInfinite({ limit: 1, sort: "-filed_at", symbol: hasFilings ? ticker : "" });

    return (
        <>
            <OverviewTilesView
                filing={filings.data?.pages.at(0)?.data.at(0) ?? null}
                filingLoading={hasFilings && filings.isLoading}
                homepage={httpsHref(company.homepage_url)}
                investorRelations={httpsHref(company.investor_relations_url)}
                nextCall={next.data?.pages.at(0)?.data.at(0) ?? null}
                nextLoading={hasEvents && next.isLoading}
                ticker={ticker}
            />
            <CompanyFactTilesView company={company} />
        </>
    );
}

/**
 * An ownership share: "63.65% · 9,250,375,827 shares" (the API's `*_pct` are percent values, 63.65 = 63.65 %);
 * `of` names the base ("of float").
 */
export function ownershipText(pct: null | number | undefined, shares: null | number | undefined, of?: string): null | string {
    const parts = [
        pct == null ? null : `${formatNumberEn(pct, { maximumFractionDigits: 2 })}%${of ? ` ${of}` : ""}`,
        shares == null ? null : `${formatShares(shares)} shares`,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(" · ") : null;
}

/** The postal address in two lines ("ONE APPLE PARK WAY" / "CUPERTINO, California 95014 · US"); none stated = []. */
export function addressLines(company: Pick<CompanyTileFields, "city" | "country_code" | "state" | "street" | "zip_code">): Array<string> {
    const place = [[company.city, [company.state, company.zip_code].filter(Boolean).join(" ")].filter(Boolean).join(", "), company.country_code]
        .filter(Boolean)
        .join(" · ");

    return [company.street, place].filter((line): line is string => Boolean(line && line.trim()));
}

function FactTile({ children, label }: { children: ReactNode; label: string }) {
    return (
        <Card className="border-border/60" size="sm">
            <CardHeader><CardDescription>{label}</CardDescription></CardHeader>
            <CardContent>{children}</CardContent>
        </Card>
    );
}

const notStated = <span className="text-muted-foreground">Not stated</span>;

/** The fact tiles (pure): ownership, short float, address, listing. */
export function CompanyFactTilesView({ company }: { company: Omit<CompanyTileFields, "homepage_url" | "investor_relations_url"> }) {
    const institutional = ownershipText(company.inst_own_pct, company.inst_own_shares);

    const insider = ownershipText(company.insider_own_pct, company.insider_own_shares);

    const shortFloat = ownershipText(company.short_float_pct, company.short_float_shares, "of float");

    const address = addressLines(company);

    return (
        <div className="grid gap-3 sm:grid-cols-3 md:col-span-2" data-testid="company-fact-tiles">
            <FactTile label="Institutional ownership">{institutional ? <span className="font-medium tabular-nums">{institutional}</span> : notStated}</FactTile>
            <FactTile label="Insider ownership">{insider ? <span className="font-medium tabular-nums">{insider}</span> : notStated}</FactTile>
            <FactTile label="Short float">{shortFloat ? <span className="font-medium tabular-nums">{shortFloat}</span> : notStated}</FactTile>
            <FactTile label="Address">
                {address.length > 0 ? <address className="font-medium not-italic">{address.map(line => <div key={line}>{line}</div>)}</address> : notStated}
            </FactTile>
            <FactTile label="Listing">
                <div className="flex flex-wrap items-center gap-2">
                    {company.composite_figi ? <span className="font-medium" title="Composite FIGI">{`FIGI ${company.composite_figi}`}</span> : <span className="text-muted-foreground">No FIGI</span>}
                    {company.is_delisted ? <Badge variant="destructive">Delisted</Badge> : <Badge variant="secondary">Listed</Badge>}
                </div>
            </FactTile>
        </div>
    );
}

/** The tiles (pure). */
export function OverviewTilesView({ filing, filingLoading, homepage, investorRelations, nextCall, nextLoading, ticker }: {
    filing: null | Pick<V2Filing, "accession" | "filed_at" | "form">;
    filingLoading: boolean;
    homepage: null | string;
    investorRelations: null | string;
    nextCall: null | V2Event;
    nextLoading: boolean;
    ticker: string;
}) {
    return (
        <div className="grid gap-3 sm:grid-cols-3 md:col-span-2" data-testid="overview-tiles">
            <Card className="border-border/60" size="sm">
                <CardHeader><CardDescription>Next call</CardDescription></CardHeader>
                <CardContent>
                    {nextLoading
                        ? <Skeleton className="h-5 w-40" />
                        : nextCall
                            ? (
                                    <EventLink className="font-medium hover:underline" event={nextCall}>
                                        {`${eventLabel(nextCall)} · ${formatCallTime(nextCall)}`}
                                    </EventLink>
                                )
                            : <span className="text-muted-foreground">None scheduled</span>}
                </CardContent>
            </Card>
            <Card className="border-border/60" size="sm">
                <CardHeader><CardDescription>Latest filing</CardDescription></CardHeader>
                <CardContent>
                    {filingLoading
                        ? <Skeleton className="h-5 w-40" />
                        : filing
                            ? <Link className="font-medium hover:underline" params={{ ticker }} to="/$ticker/filings">{`${filing.form} · ${formatDay(filing.filed_at)}`}</Link>
                            : <span className="text-muted-foreground">None</span>}
                </CardContent>
            </Card>
            <Card className="border-border/60" size="sm">
                <CardHeader><CardDescription>Links</CardDescription></CardHeader>
                <CardContent className="flex flex-wrap gap-x-3 gap-y-1">
                    {homepage && <a className="font-medium underline-offset-4 hover:underline" href={homepage} rel="noopener noreferrer" target="_blank">Website</a>}
                    {investorRelations && <a className="font-medium underline-offset-4 hover:underline" href={investorRelations} rel="noopener noreferrer" target="_blank">Investor relations</a>}
                    {!homepage && !investorRelations && <span className="text-muted-foreground">None stated</span>}
                </CardContent>
            </Card>
        </div>
    );
}

function Row({ children, label }: { children: ReactNode; label: string }) {
    return (
        <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-right font-medium">{children}</span>
        </div>
    );
}

const day = (value: null | string | undefined) => (value ? formatDay(value) : null);

/** The listing facts every instrument has (`GET /v1/instruments/{symbol}`); an ETN's whole overview. */
export function InstrumentCard({ instrument }: { instrument: V2Instrument }) {
    return (
        <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-border/60">
                <CardHeader>
                    <CardTitle>Instrument</CardTitle>
                    <CardDescription>
                        {instrument.type === "etn"
                            ? "An exchange-traded note: a debt security of its issuing bank, neither a company nor a fund."
                            : "The listing"}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                    <Row label="Type">{INSTRUMENT_TYPE_LABELS[instrument.type]}</Row>
                    <Row label="Exchange">{instrument.exchange ?? "—"}</Row>
                    <Row label="Currency">{instrument.currency ?? "—"}</Row>
                    <Row label="Listed since">{day(instrument.list_date) ?? "—"}</Row>
                    <Row label="Status">{instrument.is_active ? "Active" : "Delisted"}</Row>
                </CardContent>
            </Card>
        </div>
    );
}

/** "$812.4B · as of 2026-08-31 · series total, all share classes" (VOO: the series' assets, never one class's). */
export function netAssetsText(fund: Pick<V2Fund, "net_assets_as_of" | "net_assets_scope" | "net_assets_usd">): null | string {
    if (fund.net_assets_usd == null) return null;

    return [formatMoneyCompact(fund.net_assets_usd), fund.net_assets_as_of && `as of ${formatDay(fund.net_assets_as_of)}`, netAssetsScopeText(fund.net_assets_scope)]
        .filter(Boolean)
        .join(" · ");
}

/** The composition line of the overview: its source and as-of date, or why there is none. */
function CompositionLine({ instrument, ticker }: { instrument: V2Instrument; ticker: string }) {
    const hasHoldings = instrument.datasets.includes("fund_holdings");

    // One position is enough for the source and the as-of (the Holdings page reads the rest).
    const positions = useFundPositionsInfinite({ fund: hasHoldings ? ticker : "", limit: 1 });

    if (!hasHoldings) return <div className="text-muted-foreground text-sm" data-testid="fund-no-holdings">{datasetGateText(instrument, "fund_holdings")}</div>;

    return <CompositionMeta error={positions.error} page={positions.data?.pages.at(0)} ticker={ticker} />;
}

export function CompositionMeta({ error, page, ticker }: { error: unknown; page: undefined | V2FundPositionsResponse; ticker: string }) {
    if (error) return <SecReadinessNotice error={error} title="Failed to load the composition" />;

    if (!page) return <div className="text-muted-foreground text-sm">Loading the composition...</div>;

    const reason = fundReasonText(page.meta.reason);

    return (
        <div className="flex flex-col gap-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
                <FundSourceBadge asOf={page.meta.as_of} source={page.meta.source} />
                <Link className="text-primary text-xs underline-offset-4 hover:underline" params={{ ticker }} to="/$ticker/holdings">
                    Holdings and weights
                </Link>
            </div>
            {reason && <div className="text-muted-foreground text-xs">{reason}</div>}
        </div>
    );
}

/** A listed fund's profile (`GET /v1/funds/{fund}`): the fund, its size and costs, its classes, its composition. */
function FundOverview({ instrument, ticker }: { instrument: V2Instrument; ticker: string }) {
    const { data: fund, error, isLoading } = useFund(ticker, ["coverage"]);

    if (error) return <SecReadinessNotice error={error} title="Failed to load the fund profile" />;

    if (isLoading || !fund) return <div className="text-muted-foreground">Loading the fund profile...</div>;

    return <FundProfileView composition={<CompositionLine instrument={instrument} ticker={ticker} />} fund={fund} />;
}

/** The fund profile (pure): `composition` is the composition line (its own request). */
export function FundProfileView({ composition, fund }: { composition: ReactNode; fund: V2Fund }) {
    const netAssets = netAssetsText(fund);

    const homepage = httpsHref(fund.homepage_url);

    return (
        <div className="grid gap-6 md:grid-cols-2" data-testid="fund-overview">
            <Card className="border-border/60">
                <CardHeader>
                    <CardTitle>Fund</CardTitle>
                    <CardDescription>{fund.name}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                    <Row label="Type">{INSTRUMENT_TYPE_LABELS[fund.type]}</Row>
                    <Row label="Structure">{fund.structure ? FUND_STRUCTURE_LABELS[fund.structure] : "—"}</Row>
                    <Row label="Issuer / trust">
                        {fund.registrant_cik
                            ? (
                                    <Link className="underline-offset-4 hover:underline" params={{ cik: String(Number(fund.registrant_cik)) }} title="SEC filer: identity, lifecycle and filings" to="/sec/$cik">
                                        {fund.registrant_name ?? fund.registrant_cik}
                                    </Link>
                                )
                            : (fund.registrant_name ?? "—")}
                    </Row>
                    {fund.series_id && <Row label="Series">{fund.series_id}</Row>}
                    {fund.investment_company_type && <Row label="Registration">{fund.investment_company_type}</Row>}
                    {fund.is_index != null && <Row label="Index fund">{fund.is_index ? "Yes" : "No"}</Row>}
                    {homepage && (
                        <Row label="Website">
                            <a className="underline-offset-4 hover:underline" href={homepage} rel="noreferrer" target="_blank">{homepage.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "")}</a>
                        </Row>
                    )}
                    <Row label="Exchange">{fund.exchange ?? "—"}</Row>
                    {fund.list_date && <Row label="Listed since">{day(fund.list_date)}</Row>}
                </CardContent>
            </Card>

            <Card className="border-border/60">
                <CardHeader>
                    <CardTitle>Size and costs</CardTitle>
                    <CardDescription>N-PORT net assets, prospectus expense ratio</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                    <Row label="Net assets">
                        <span data-testid="fund-net-assets">{netAssets ?? "—"}</span>
                    </Row>
                    {fund.market_cap != null && <Row label="Market cap">{formatMoneyCompact(fund.market_cap)}</Row>}
                    {fund.expense_ratio_net != null && (
                        <Row label="Expense ratio (net)">
                            {[formatFractionPercentCompact(fund.expense_ratio_net), fund.expense_ratio_as_of && `as of ${formatDay(fund.expense_ratio_as_of)}`].filter(Boolean).join(" · ")}
                        </Row>
                    )}
                    {fund.expense_ratio_gross != null && <Row label="Expense ratio (gross)">{formatFractionPercentCompact(fund.expense_ratio_gross)}</Row>}
                    {fund.shares_outstanding != null && <Row label="Shares outstanding">{formatShares(fund.shares_outstanding)}</Row>}
                    {fund.short_float_pct != null && <Row label="Short interest">{`${formatNumberEn(fund.short_float_pct, { maximumFractionDigits: 2 })}% of float`}</Row>}
                </CardContent>
            </Card>

            <Card className="border-border/60">
                <CardHeader>
                    <CardTitle>Share classes</CardTitle>
                    <CardDescription>Listed classes open their own page</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                    {fund.share_classes.length === 0
                        ? <div className="flex flex-wrap gap-2">{fund.symbols.map(symbol => <ClassLink key={symbol} symbol={symbol} />)}</div>
                        : fund.share_classes.map(entry => (
                                <div className="flex justify-between gap-4" key={entry.class_id}>
                                    <span className="text-muted-foreground truncate">{entry.class_name ?? entry.class_id}</span>
                                    {entry.is_listed && entry.ticker ? <ClassLink symbol={entry.ticker} /> : <span>{entry.ticker ?? "Not listed"}</span>}
                                </div>
                            ))}
                </CardContent>
            </Card>

            <Card className="border-border/60">
                <CardHeader>
                    <CardTitle>Composition</CardTitle>
                    <CardDescription>What the fund holds, from its freshest source</CardDescription>
                </CardHeader>
                <CardContent>{composition}</CardContent>
            </Card>

            {fund.advisers.length > 0 && (
                <Card className="border-border/60">
                    <CardHeader>
                        <CardTitle>Advisers</CardTitle>
                        <CardDescription>Advisers and sub-advisers as reported on Form N-CEN</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FundAdvisersView advisers={fund.advisers} />
                    </CardContent>
                </Card>
            )}

            <CoverageCard coverage={fund.coverage} noun="fund" ticker={fund.symbol} />
        </div>
    );
}

function ClassLink({ symbol }: { symbol: string }) {
    return (
        <Link className="font-medium underline-offset-4 hover:underline" params={{ ticker: symbol }} to="/$ticker">
            {symbol}
        </Link>
    );
}
