import { Link } from "@tanstack/react-router";
import * as React from "react";

import type { V2CompanyResponse, V2Dataset, V2Event, V2Filing } from "@/lib/api/types";

import { FiscalPeriodsCard } from "@/components/reference/fiscal-periods-card";
import { FactGrid } from "@/components/sec/ownership-views";
import { Button } from "@/components/ui/button";
import { Copyable } from "@/components/ui/copy-button";
import { ErrorState } from "@/components/ui/error-state";
import { Notice } from "@/components/ui/notice";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { Stat, StatGrid } from "@/components/ui/stat";
import { ApiRequestError } from "@/lib/api/errors";
import { useV2Company, useV2EventsInfinite, useV2FilingsInfinite } from "@/lib/api/queries";
import { formerTickerText } from "@/lib/api/v2";
import { eventLabel, formatCallTime } from "@/lib/earnings/format";
import { formatDay, formatMoneyCompact, formatNumber, formatShares } from "@/lib/format";
import { formatNumberEn } from "@/lib/utils";
import { EventLink } from "@/routes/$ticker/earnings-calls/-components/event-link";

import { CoverageSection, ExternalLink, httpsHref, OverviewColumns, OverviewSkeleton } from "./overview-parts";

/**
 * A stock's overview (ui-redesign task 8; `GET /v1/companies/{company}?expand=coverage,former_tickers`): the description first, key
 * facts as a stat grid, "Next up" (next call, latest filing) and "Identifiers" beside them, the data families, the
 * fiscal periods. Requests as before: the company, one upcoming event, one filing, the fiscal periods.
 */
export function CompanyOverview({ datasets, ticker }: { datasets: ReadonlyArray<V2Dataset>; ticker: string }) {
    const { data: company, error, isLoading } = useV2Company(ticker, { expand: ["coverage", "former_tickers"] });

    if (error instanceof ApiRequestError && error.code === "not_covered") {
        return <Notice badge="Not covered" title={`${ticker} is not covered by the Invinite API`}>{error.message}</Notice>;
    }

    if (error) {
        return <ErrorState error={error} title="Failed to load company details" />;
    }

    if (isLoading) {
        return <OverviewSkeleton />;
    }

    if (!company) {
        return <div className="text-muted-foreground">No company data found.</div>;
    }

    return (
        <>
            {company.description && <CompanyDescription text={company.description} />}
            <OverviewColumns
                lead={(
                    <Section title="Key facts">
                        <KeyFactsView company={company} />
                    </Section>
                )}
                rest={(
                    <>
                        <CoverageSection coverage={company.coverage} ticker={ticker} />
                        {/* O7 group 7: the fiscal calendar (asked only when the instrument has the dataset, as the filings list does). */}
                        {datasets.includes("fiscal_periods") && <FiscalPeriodsCard ticker={ticker} />}
                    </>
                )}
                side={(
                    <>
                        <NextUp datasets={datasets} ticker={ticker} />
                        <Section title="Identifiers">
                            <IdentifiersView company={company} />
                        </Section>
                    </>
                )}
            />
        </>
    );
}

/** Longer than this, the description is clamped to two lines with "More". */
const DESCRIPTION_CLAMP_CHARACTERS = 160;

/** The company description: what this is, first; two lines and "More" for a long one. */
export function CompanyDescription({ text }: { text: string }) {
    const [expanded, setExpanded] = React.useState(false);

    const long = text.length > DESCRIPTION_CLAMP_CHARACTERS;

    return (
        <div className="flex max-w-[75ch] flex-col items-start gap-1" data-testid="company-description">
            <p className={long && !expanded ? "text-muted-foreground line-clamp-2 text-sm" : "text-muted-foreground text-sm"}>{text}</p>
            {long && (
                <Button aria-expanded={expanded} className="-ml-2" onClick={() => setExpanded(value => !value)} size="sm" type="button" variant="ghost">
                    {expanded ? "Less" : "More"}
                </Button>
            )}
        </div>
    );
}

/** The company fields the key facts and identifiers read (all from `/v1/companies/{company}`, already fetched). */
export type CompanyFactFields = Pick<
    V2CompanyResponse,
    | "cik"
    | "city"
    | "composite_figi"
    | "country_code"
    | "currency"
    | "employees"
    | "exchange"
    | "filer_cik"
    | "former_tickers"
    | "homepage_url"
    | "industry"
    | "insider_own_pct"
    | "insider_own_shares"
    | "inst_own_pct"
    | "inst_own_shares"
    | "investor_relations_url"
    | "list_date"
    | "market_cap"
    | "sector"
    | "shares_outstanding"
    | "short_float_pct"
    | "short_float_shares"
    | "state"
    | "street"
    | "zip_code"
>;

/** A percent value of the API (`*_pct`: 63.65 = 63.65 %), else null. */
export const percentText = (pct: null | number | undefined, of?: string) => (pct == null ? null : `${formatNumberEn(pct, { maximumFractionDigits: 2 })}%${of ? ` ${of}` : ""}`);

/** A share count as a sub-line ("9,250,375,827 shares"), else null. */
export const sharesSubText = (shares: null | number | undefined) => (shares == null ? null : `${formatShares(shares)} shares`);

/** The postal address in two lines ("ONE APPLE PARK WAY" / "CUPERTINO, California 95014 · US"); none stated = []. */
export function addressLines(company: Pick<CompanyFactFields, "city" | "country_code" | "state" | "street" | "zip_code">): Array<string> {
    const place = [[company.city, [company.state, company.zip_code].filter(Boolean).join(" ")].filter(Boolean).join(", "), company.country_code]
        .filter(Boolean)
        .join(" · ");

    return [company.street, place].filter((line): line is string => Boolean(line && line.trim()));
}

/** One ownership cell: the percent as the value, the share count as the sub-line; neither stated = null (left out). */
function ownershipStat(label: string, pct: null | number | undefined, shares: null | number | undefined, of?: string) {
    const value = percentText(pct, of);

    const sub = sharesSubText(shares);

    if (!value && !sub) return null;

    return <Stat key={label} label={label} sub={value ? sub : null} value={value ?? sub} />;
}

/**
 * The key facts (pure): size, listing, classification, ownership. A value the API leaves null is left out (no "—"
 * cell); the grid's last cell fills its row instead of standing alone.
 */
export function KeyFactsView({ company }: { company: Omit<CompanyFactFields, "cik" | "composite_figi" | "filer_cik" | "former_tickers" | "homepage_url" | "investor_relations_url"> }) {
    const cells = [
        company.market_cap != null && <Stat key="market_cap" label="Market cap" value={formatMoneyCompact(company.market_cap)} />,
        company.shares_outstanding != null && <Stat key="shares" label="Shares outstanding" value={formatShares(company.shares_outstanding)} />,
        company.exchange && <Stat key="exchange" label="Exchange" value={company.exchange} />,
        company.list_date && <Stat key="listed" label="Listed since" value={formatDay(company.list_date)} />,
        company.sector && <Stat key="sector" label="Sector" value={company.sector} />,
        company.industry && <Stat key="industry" label="Industry" value={company.industry} />,
        company.employees != null && <Stat key="employees" label="Employees" value={formatNumber(company.employees)} />,
        company.currency && <Stat key="currency" label="Currency" value={company.currency} />,
        ownershipStat("Institutional", company.inst_own_pct, company.inst_own_shares),
        ownershipStat("Insider", company.insider_own_pct, company.insider_own_shares),
        ownershipStat("Short float", company.short_float_pct, company.short_float_shares, "of float"),
    ];

    if (!cells.some(Boolean)) return <div className="text-muted-foreground">No key facts stated.</div>;

    return <div data-testid="company-key-facts"><StatGrid>{cells}</StatGrid></div>;
}

/**
 * The identifiers (pure): CIK (copy, → `/sec/$cik`), FIGI (copy), former tickers (`expand=former_tickers`, newest first,
 * each with where it was seen), the website and IR site (http(s) only), address.
 */
export function IdentifiersView({ company }: {
    company: Partial<Pick<CompanyFactFields, "former_tickers">>
        & Pick<CompanyFactFields, "cik" | "city" | "composite_figi" | "country_code" | "filer_cik" | "homepage_url" | "investor_relations_url" | "state" | "street" | "zip_code">;
}) {
    const homepage = httpsHref(company.homepage_url);

    const investorRelations = httpsHref(company.investor_relations_url);

    const address = addressLines(company);

    return (
        <FactGrid
            facts={[
                [
                    "CIK",
                    company.cik
                        ? (
                                <Copyable label="Copy CIK" value={company.cik}>
                                    {company.filer_cik
                                        ? <Link className="underline-offset-4 hover:underline" params={{ cik: company.filer_cik }} title="SEC filer: identity, lifecycle and filings" to="/sec/$cik">{company.cik}</Link>
                                        : company.cik}
                                </Copyable>
                            )
                        : null,
                ],
                ["FIGI", company.composite_figi ? <Copyable label="Copy composite FIGI" value={company.composite_figi} /> : null],
                [
                    "Former tickers",
                    company.former_tickers?.length
                        ? (
                                <ul data-testid="former-tickers">
                                    {company.former_tickers.map((former, index) => <li key={`${index}-${former.ticker}`}>{formerTickerText(former)}</li>)}
                                </ul>
                            )
                        : null,
                ],
                [
                    "Links",
                    homepage || investorRelations
                        ? (
                                <span className="flex flex-wrap gap-x-3">
                                    {homepage && <ExternalLink href={homepage}>Website</ExternalLink>}
                                    {investorRelations && <ExternalLink href={investorRelations}>Investor relations</ExternalLink>}
                                </span>
                            )
                        : null,
                ],
                ["Address", address.length > 0 ? <address className="not-italic">{address.map(line => <div key={line}>{line}</div>)}</address> : null],
            ]}
            testId="company-identifiers"
        />
    );
}

/** "Next up": the next call and the latest filing (one `limit=1` request each, only with the dataset). */
function NextUp({ datasets, ticker }: { datasets: ReadonlyArray<V2Dataset>; ticker: string }) {
    const hasEvents = datasets.includes("events");

    const hasFilings = datasets.includes("filings");

    const next = useV2EventsInfinite({ company: ticker, enabled: hasEvents, limit: 1, sort: "scheduled_at", status: ["upcoming"], toastErrors: false, type: "all" });

    const filings = useV2FilingsInfinite({ limit: 1, sort: "-filed_at", symbol: hasFilings ? ticker : "" });

    return (
        <NextUpView
            filing={filings.data?.pages.at(0)?.data.at(0) ?? null}
            filingLoading={hasFilings && filings.isLoading}
            nextCall={next.data?.pages.at(0)?.data.at(0) ?? null}
            nextLoading={hasEvents && next.isLoading}
            ticker={ticker}
        />
    );
}

/** "Next up" (pure): two link rows. */
export function NextUpView({ filing, filingLoading, nextCall, nextLoading, ticker }: {
    filing: null | Pick<V2Filing, "accession" | "filed_at" | "form">;
    filingLoading: boolean;
    nextCall: null | V2Event;
    nextLoading: boolean;
    ticker: string;
}) {
    const loading = <Skeleton className="h-5 w-40" />;

    return (
        <Section title="Next up">
            <FactGrid
                facts={[
                    [
                        "Next call",
                        nextLoading
                            ? loading
                            : nextCall
                                ? <EventLink className="font-medium hover:underline" event={nextCall}>{`${eventLabel(nextCall)} · ${formatCallTime(nextCall)}`}</EventLink>
                                : <span className="text-muted-foreground">None scheduled</span>,
                    ],
                    [
                        "Latest filing",
                        filingLoading
                            ? loading
                            : filing
                                ? <Link className="font-medium hover:underline" params={{ ticker }} to="/$ticker/filings">{`${filing.form} · ${formatDay(filing.filed_at)}`}</Link>
                                : <span className="text-muted-foreground">None</span>,
                    ],
                ]}
                testId="overview-next-up"
            />
        </Section>
    );
}
