import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";

import type { V2Fund, V2FundPositionsResponse, V2Instrument } from "@/lib/api/types";

import { FundAdvisersView, FundSourceBadge } from "@/components/sec/fund-views";
import { FactGrid } from "@/components/sec/ownership-views";
import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { Section } from "@/components/ui/section";
import { Stat, StatGrid } from "@/components/ui/stat";
import { useFund, useFundPositionsInfinite } from "@/lib/api/queries";
import { formatDay, formatMoneyCompact, formatShares } from "@/lib/format";
import { datasetGateText, FUND_STRUCTURE_LABELS, INSTRUMENT_TYPE_LABELS } from "@/lib/instruments";
import { fundReasonText, netAssetsScopeText } from "@/lib/sec/fund";
import { formatFractionPercentCompact, formatNumberEn } from "@/lib/utils";

import { CoverageSection, dayOrNull, ExternalLink, httpsHref, OverviewColumns, OverviewSkeleton } from "./overview-parts";

/**
 * A listed fund's overview (ui-redesign task 8; `GET /v1/funds/{fund}?expand=coverage`) and an ETN's: the same
 * building blocks as a stock's — key facts as a stat grid, the profile as a fact list beside them, sections for the
 * composition, share classes, advisers and the data families. Requests as before.
 */

/** Net assets as a value and its sub-line: "$812.4B" / "as of Aug 31, 2026 · series total, all share classes" (VOO). */
export function netAssetsParts(fund: Pick<V2Fund, "net_assets_as_of" | "net_assets_scope" | "net_assets_usd">): null | { sub: null | string; value: string } {
    if (fund.net_assets_usd == null) return null;

    const sub = [fund.net_assets_as_of && `as of ${formatDay(fund.net_assets_as_of)}`, netAssetsScopeText(fund.net_assets_scope)].filter(Boolean).join(" · ");

    return { sub: sub || null, value: formatMoneyCompact(fund.net_assets_usd) };
}

/** The composition line of the overview: its source and as-of date, or why there is none. */
function CompositionLine({ instrument, ticker }: { instrument: V2Instrument; ticker: string }) {
    const hasHoldings = instrument.datasets.includes("fund_holdings");

    // One position is enough for the source and the as-of (the Holdings page reads the rest).
    const positions = useFundPositionsInfinite({ fund: hasHoldings ? ticker : "", limit: 1 });

    if (!hasHoldings) return <div className="text-muted-foreground" data-testid="fund-no-holdings">{datasetGateText(instrument, "fund_holdings")}</div>;

    return <CompositionMeta error={positions.error} page={positions.data?.pages.at(0)} ticker={ticker} />;
}

export function CompositionMeta({ error, page, ticker }: { error: unknown; page: undefined | V2FundPositionsResponse; ticker: string }) {
    if (error) return <SecReadinessNotice error={error} title="Failed to load the composition" />;

    if (!page) return <div className="text-muted-foreground">Loading the composition...</div>;

    const reason = fundReasonText(page.meta.reason);

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
                <FundSourceBadge asOf={page.meta.as_of} source={page.meta.source} />
                <Link className="text-primary underline-offset-4 hover:underline" params={{ ticker }} to="/$ticker/holdings">
                    Holdings and weights
                </Link>
            </div>
            {reason && <div className="text-muted-foreground">{reason}</div>}
        </div>
    );
}

/** A listed fund's profile (`GET /v1/funds/{fund}`): the fund, its size and costs, its classes, its composition. */
export function FundOverview({ instrument, ticker }: { instrument: V2Instrument; ticker: string }) {
    const { data: fund, error, isLoading } = useFund(ticker, ["coverage"]);

    if (error) return <SecReadinessNotice error={error} title="Failed to load the fund profile" />;

    if (isLoading || !fund) return <OverviewSkeleton />;

    return <FundProfileView composition={<CompositionLine instrument={instrument} ticker={ticker} />} fund={fund} />;
}

function ClassLink({ symbol }: { symbol: string }) {
    return (
        <Link className="font-medium underline-offset-4 hover:underline" params={{ ticker: symbol }} to="/$ticker">
            {symbol}
        </Link>
    );
}

/** The fund profile (pure): `composition` is the composition line (its own request). */
export function FundProfileView({ composition, fund }: { composition: ReactNode; fund: V2Fund }) {
    const netAssets = netAssetsParts(fund);

    const homepage = httpsHref(fund.homepage_url);

    const expenseAsOf = fund.expense_ratio_as_of ? `as of ${formatDay(fund.expense_ratio_as_of)}` : null;

    const sizeCells = [
        netAssets && <Stat key="net_assets" label="Net assets" sub={netAssets.sub} value={<span data-testid="fund-net-assets">{netAssets.value}</span>} />,
        fund.market_cap != null && <Stat key="market_cap" label="Market cap" value={formatMoneyCompact(fund.market_cap)} />,
        fund.expense_ratio_net != null && <Stat key="expense_net" label="Expense ratio (net)" sub={expenseAsOf} value={formatFractionPercentCompact(fund.expense_ratio_net)} />,
        fund.expense_ratio_gross != null && <Stat key="expense_gross" label="Expense ratio (gross)" value={formatFractionPercentCompact(fund.expense_ratio_gross)} />,
        fund.shares_outstanding != null && <Stat key="shares" label="Shares outstanding" value={formatShares(fund.shares_outstanding)} />,
        fund.short_float_pct != null && <Stat key="short" label="Short interest" value={`${formatNumberEn(fund.short_float_pct, { maximumFractionDigits: 2 })}% of float`} />,
    ];

    return (
        <div data-testid="fund-overview">
            <OverviewColumns
                lead={(
                    // An exchange-traded trust files no N-PORT report: no "N-PORT net assets" promised (UI walk F091).
                    <Section
                        description={fund.structure === "exchange_traded_trust" ? "Shares and short interest; a trust files no N-PORT report" : "N-PORT net assets, prospectus expense ratio"}
                        title="Key facts"
                    >
                        {sizeCells.some(Boolean) ? <StatGrid>{sizeCells}</StatGrid> : <div className="text-muted-foreground">No size or cost figures stated.</div>}
                    </Section>
                )}
                rest={(
                    <>
                        <Section description="What the fund holds, from its freshest source" title="Composition">
                            {composition}
                        </Section>
                        <Section description="Listed classes open their own page" title="Share classes">
                            {fund.share_classes.length === 0
                                ? <div className="flex flex-wrap gap-3">{fund.symbols.map(symbol => <ClassLink key={symbol} symbol={symbol} />)}</div>
                                : (
                                        <ul className="grid gap-x-8 sm:grid-cols-2">
                                            {fund.share_classes.map(entry => (
                                                <li className="flex min-h-9 items-baseline justify-between gap-4 border-b py-2" key={entry.class_id}>
                                                    <span className="text-muted-foreground truncate">{entry.class_name ?? entry.class_id}</span>
                                                    {entry.is_listed && entry.ticker ? <ClassLink symbol={entry.ticker} /> : <span>{entry.ticker ?? "Not listed"}</span>}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                        </Section>
                        {fund.advisers.length > 0 && (
                            <Section description="Advisers and sub-advisers as reported on Form N-CEN" title="Advisers">
                                <FundAdvisersView advisers={fund.advisers} />
                            </Section>
                        )}
                        <CoverageSection coverage={fund.coverage} noun="fund" ticker={fund.symbol} />
                    </>
                )}
                side={(
                    <Section title="Profile">
                        <FactGrid
                            facts={[
                                // The fund's own name: a share class lists under the series' name (VOO: "Vanguard 500 Index Fund").
                                ["Fund", fund.name],
                                ["Type", INSTRUMENT_TYPE_LABELS[fund.type]],
                                ["Structure", fund.structure ? FUND_STRUCTURE_LABELS[fund.structure] : null],
                                [
                                    "Issuer / trust",
                                    fund.registrant_cik
                                        ? (
                                                <Link className="underline-offset-4 hover:underline" params={{ cik: String(Number(fund.registrant_cik)) }} title="SEC filer: identity, lifecycle and filings" to="/sec/$cik">
                                                    {fund.registrant_name ?? fund.registrant_cik}
                                                </Link>
                                            )
                                        : fund.registrant_name,
                                ],
                                ["Series", fund.series_id],
                                ["Registration", fund.investment_company_type],
                                ["Index fund", fund.is_index == null ? null : fund.is_index ? "Yes" : "No"],
                                ["Exchange", fund.exchange],
                                ["Listed since", dayOrNull(fund.list_date)],
                                [
                                    "Website",
                                    homepage
                                        ? <ExternalLink href={homepage}>{homepage.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "")}</ExternalLink>
                                        : null,
                                ],
                            ]}
                            testId="fund-profile"
                        />
                    </Section>
                )}
            />
        </div>
    );
}

/** The listing facts every instrument has (`GET /v1/instruments/{symbol}`); an ETN's whole overview. */
export function InstrumentOverview({ instrument }: { instrument: V2Instrument }) {
    const listed = dayOrNull(instrument.list_date);

    return (
        <Section
            description={instrument.type === "etn" ? "An exchange-traded note: a debt security of its issuing bank, neither a company nor a fund." : "The listing"}
            title="Instrument"
        >
            <StatGrid>
                <Stat label="Type" value={INSTRUMENT_TYPE_LABELS[instrument.type]} />
                {instrument.exchange && <Stat label="Exchange" value={instrument.exchange} />}
                {instrument.currency && <Stat label="Currency" value={instrument.currency} />}
                {listed && <Stat label="Listed since" value={listed} />}
                <Stat label="Status" value={instrument.is_active ? "Active" : "Delisted"} />
            </StatGrid>
        </Section>
    );
}
