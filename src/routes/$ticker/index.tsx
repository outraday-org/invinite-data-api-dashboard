import type { ReactNode } from "react";

import { createFileRoute, Link } from "@tanstack/react-router";

import type { V2CompanyCoverage, V2Fund, V2FundPositionsResponse, V2Instrument } from "@/lib/api/types";

import { FundSourceBadge } from "@/components/sec/fund-views";
import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Notice } from "@/components/ui/notice";
import { ApiRequestError } from "@/lib/api/errors";
import { useFund, useFundPositionsInfinite, useInstrument, useV2Company } from "@/lib/api/queries";
import { coverageEntries } from "@/lib/api/v2";
import { formatEnDateTime } from "@/lib/date";
import { datasetGateText, FUND_STRUCTURE_LABELS, INSTRUMENT_TYPE_LABELS, isFundType } from "@/lib/instruments";
import { fundReasonText, netAssetsScopeText } from "@/lib/sec/fund";
import { formatFractionPercentCompact, formatNumberEn, formatNumberEnCompact } from "@/lib/utils";

export const Route = createFileRoute("/$ticker/")({
    component: TickerOverview,
});

/**
 * The overview of one instrument (Data API 7.0): a stock's company profile (`/v1/companies/{company}`), a fund's profile
 * (`/v1/funds/{fund}`) or, for an ETN, the instrument itself. The layout already read the instrument (same query).
 */
function TickerOverview() {
    const { ticker } = Route.useParams();

    const { data: instrument, isLoading } = useInstrument(ticker);

    if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

    // The layout renders the unknown / failed instrument states.
    if (!instrument) return null;

    if (instrument.type === "stock") return <CompanyOverview ticker={ticker} />;

    if (isFundType(instrument.type)) return <FundOverview instrument={instrument} ticker={ticker} />;

    return <InstrumentCard instrument={instrument} />;
}

function CompanyOverview({ ticker }: { ticker: string }) {
    const { data: company, error, isLoading } = useV2Company(ticker, { expand: ["coverage"] });

    if (error instanceof ApiRequestError && error.code === "not_covered") {
        return <Notice badge="Not covered" title={`${ticker} is not covered by the Invinite API`}>{error.message}</Notice>;
    }

    if (error) {
        return <ErrorState error={error} title="Failed to load company details" />;
    }

    if (isLoading) {
        return <div className="text-muted-foreground">Loading company details...</div>;
    }

    if (!company) {
        return <div className="text-muted-foreground">No company data found.</div>;
    }

    return (
        <div className="grid gap-6 md:grid-cols-2">
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
                    {company.employees && (
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Employees</span>
                            <span className="font-medium">
                                {company.employees.toLocaleString()}
                            </span>
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
                    {company.market_cap && (
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Market Cap</span>
                            <span className="font-medium">
                                $
                                {(company.market_cap / 1e9).toFixed(2)}
                                B
                            </span>
                        </div>
                    )}
                    {company.shares_outstanding && (
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Shares Outstanding</span>
                            <span className="font-medium">
                                {(company.shares_outstanding / 1e6).toFixed(1)}
                                M
                            </span>
                        </div>
                    )}
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Exchange</span>
                        <span className="font-medium">{company.exchange ?? "-"}</span>
                    </div>
                    {company.employees && (
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Employees</span>
                            <span className="font-medium">
                                {company.employees.toLocaleString()}
                            </span>
                        </div>
                    )}
                    {company.list_date && (
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Listed since</span>
                            <span className="font-medium">
                                {formatEnDateTime(company.list_date, { hideTime: true })}
                            </span>
                        </div>
                    )}
                </CardContent>
            </Card>

            <CoverageCard coverage={company.coverage} />

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

/** `expand=coverage`: which data families hold rows for the company and through which day. */
function CoverageCard({ coverage }: { coverage: null | undefined | V2CompanyCoverage }) {
    const entries = coverageEntries(coverage);

    return (
        <Card className="border-border/60 md:col-span-2">
            <CardHeader>
                <CardTitle>Data available</CardTitle>
                <CardDescription>The data families that hold rows for this company</CardDescription>
            </CardHeader>
            <CardContent>
                {entries.length === 0
                    ? <div className="text-muted-foreground text-sm">No data family holds rows for this company yet.</div>
                    : (
                            <div className="flex flex-wrap gap-2">
                                {entries.map(entry => <Badge key={entry.family} variant="secondary">{entry.text}</Badge>)}
                            </div>
                        )}
            </CardContent>
        </Card>
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

const day = (value: null | string | undefined) => (value ? formatEnDateTime(value, { hideTime: true }) : null);

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

    return [`$${formatNumberEnCompact(fund.net_assets_usd)}`, fund.net_assets_as_of && `as of ${fund.net_assets_as_of}`, netAssetsScopeText(fund.net_assets_scope)]
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
    const { data: fund, error, isLoading } = useFund(ticker);

    if (error) return <SecReadinessNotice error={error} title="Failed to load the fund profile" />;

    if (isLoading || !fund) return <div className="text-muted-foreground">Loading the fund profile...</div>;

    return <FundProfileView composition={<CompositionLine instrument={instrument} ticker={ticker} />} fund={fund} />;
}

/** The fund profile (pure): `composition` is the composition line (its own request). */
export function FundProfileView({ composition, fund }: { composition: ReactNode; fund: V2Fund }) {
    const netAssets = netAssetsText(fund);

    const advisers = fund.advisers.flatMap(adviser => (adviser.name ? [adviser.name] : []));

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
                    {advisers.length > 0 && <Row label="Advisers">{advisers.join(", ")}</Row>}
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
                    {fund.market_cap != null && <Row label="Market cap">{`$${formatNumberEnCompact(fund.market_cap)}`}</Row>}
                    {fund.expense_ratio_net != null && (
                        <Row label="Expense ratio (net)">
                            {[formatFractionPercentCompact(fund.expense_ratio_net), fund.expense_ratio_as_of && `as of ${fund.expense_ratio_as_of}`].filter(Boolean).join(" · ")}
                        </Row>
                    )}
                    {fund.expense_ratio_gross != null && <Row label="Expense ratio (gross)">{formatFractionPercentCompact(fund.expense_ratio_gross)}</Row>}
                    {fund.shares_outstanding != null && <Row label="Shares outstanding">{formatNumberEn(fund.shares_outstanding)}</Row>}
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
