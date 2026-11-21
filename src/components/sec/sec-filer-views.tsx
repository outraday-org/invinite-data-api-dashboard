import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";
import { FileText } from "lucide-react";

import type {
    JsonValue,
    V2FilerFundSeries,
    V2FilerHoldingsResponse,
    V2FilerPrivateOfferings,
    V2FilerResponse,
    V2FilingsResponse,
    V2Holder,
    V2Offering,
    V2OfferingsResponse,
} from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copyable } from "@/components/ui/copy-button";
import { DataTable } from "@/components/ui/data-table";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiRequestError, isTierError } from "@/lib/api/errors";
import { formatDay, formatMoneyCompact } from "@/lib/format";
import { isV2GenuineEmpty } from "@/lib/sec/readiness";
import { listOf, reviewStatusOf, scalarEntries } from "@/lib/sec/source";
import { formatFractionPercentCompact, formatNumberEn, formatNumberEnCompact } from "@/lib/utils";
import { FilterSelect } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";

import type { SecPanelTarget } from "./sec-source-panel";

import { discretionText, FilingLink, votingText } from "./holder-views";
import { SecReadinessNotice } from "./sec-readiness-notice";
import { filerCikParam, SecurityLink } from "./security-link";
import { V2MetaLine } from "./v2-meta-line";

function Facts({ entries }: { entries: Array<[string, string]> }) {
    if (entries.length === 0) return null;

    return (
        <dl className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
            {entries.map(([key, value]) => (
                <div className="flex gap-1" key={key}>
                    <dt>{`${key}:`}</dt>
                    <dd className="text-foreground">{value}</dd>
                </div>
            ))}
        </dl>
    );
}

export const PHASE_LABELS: Record<NonNullable<V2FilerResponse["phase"]>, string> = {
    former: "Former issuer",
    manager: "13F manager",
    other: "Other filer",
    pre_ipo: "Pre-IPO",
    public: "Public",
};

/**
 * A failed `/v1/filers/{cik}` request: 404 `not_covered` and 503 `unavailable` are states of their own; 403 `excluded`,
 * the plan gate (`plan_required`) and anything else go through `SecReadinessNotice`.
 */
function V2FilerErrorNotice({ error, title }: { error: unknown; title: string }) {
    if (error instanceof ApiRequestError && !isTierError(error)) {
        if (error.code === "not_covered") return <Notice badge="Not covered" title="Not covered by the Invinite API">{error.message}</Notice>;

        if (error.code === "unavailable") return <Notice badge="Unavailable" title="Temporarily unavailable — try again later">{error.message}</Notice>;
    }

    return <SecReadinessNotice error={error} title={title} />;
}

/**
 * The filer's identity (pure, `GET /v1/filers/{cik}`): name, CIK, the verified listing (or "No ticker" — a pre-IPO
 * issuer, a SPAC, a manager), phase, entity type, SIC, state of incorporation, fiscal year end.
 */
export function SecFilerHeader({ cik, data, error, isLoading }: { cik: string; data: null | V2FilerResponse; error: unknown; isLoading: boolean }) {
    // The page title renders in the error state too (task data-api-dashboard O1).
    if (error) {
        return (
            <div className="flex flex-col gap-2">
                <PageHeader title={`CIK ${cik}`} />
                <V2FilerErrorNotice error={error} title="Failed to load the filer" />
            </div>
        );
    }

    if (isLoading && !data) return <Skeleton className="h-12 w-full" />;

    const stated: Array<[string, null | string | undefined]> = [
        ["entity type", data?.entity_type],
        ["SIC", data?.sic],
        ["state of incorporation", data?.state_of_incorporation],
        ["fiscal year end", data?.fiscal_year_end],
    ];

    const facts = stated.flatMap(([key, value]): Array<[string, string]> => (value ? [[key, value]] : []));

    return (
        <PageHeader
            description={(
                <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <Copyable className="tabular-nums" label="Copy CIK" value={data?.cik ?? cik}>{`CIK ${data?.cik ?? cik}`}</Copyable>
                        {data?.listing
                            ? <Badge variant="secondary">{data.listing.exchange ? `${data.listing.ticker} · ${data.listing.exchange}` : data.listing.ticker}</Badge>
                            : <Badge variant="outline">No ticker</Badge>}
                        {data?.phase && <Badge variant="outline">{PHASE_LABELS[data.phase]}</Badge>}
                    </div>
                    <Facts entries={facts} />
                </div>
            )}
            title={data?.name || `CIK ${cik}`}
        />
    );
}

function RecordList({ empty, items, reviewed = true, title }: { empty: string; items: ReadonlyArray<JsonValue>; reviewed?: boolean; title: string }) {
    return (
        <div className="flex flex-col gap-1">
            <div className="text-sm font-medium">{title}</div>
            {items.length === 0
                ? <div className="text-muted-foreground text-xs">{empty}</div>
                : (
                        <ul className="flex flex-col gap-1">
                            {items.map((item, index) => (
                                // Free-form rows without an id of their own; their order is the API's.
                                <li className="rounded-md border p-2" key={index}>
                                    {reviewed && (
                                        <div className="mb-1">
                                            <Badge variant="outline">{`Review status: ${reviewStatusOf(item) ?? "not stated"}`}</Badge>
                                        </div>
                                    )}
                                    <Facts entries={scalarEntries(item, reviewed ? ["status", "review_status"] : [])} />
                                </li>
                            ))}
                        </ul>
                    )}
        </div>
    );
}

function TextList({ empty, items, title }: { empty: string; items: ReadonlyArray<{ key: string; text: string }>; title: string }) {
    return (
        <div className="flex flex-col gap-1">
            <div className="text-sm font-medium">{title}</div>
            {items.length === 0
                ? <div className="text-muted-foreground text-xs">{empty}</div>
                : (
                        <ul className="flex flex-col gap-0.5 text-xs">
                            {items.map(item => <li key={item.key}>{item.text}</li>)}
                        </ul>
                    )}
        </div>
    );
}

/**
 * The issuer lifecycle (pure, `GET /v1/filers/{cik}?expand=lifecycle,proposed_symbols,former_names,successors`): phase,
 * kind, first public sighting, registration tracks (each with its review status stated, never assumed), pending
 * actions, proposed symbols of a pending IPO, successors, former names and warnings. A filer without lifecycle
 * evidence (`lifecycle: null`) says so; a refused request is its notice.
 */
export function SecLifecycleView({ data, error, isLoading }: { data: null | V2FilerResponse; error: unknown; isLoading: boolean }) {
    if (error) return <V2FilerErrorNotice error={error} title="Failed to load the issuer lifecycle" />;

    if (isLoading && !data) return <Skeleton className="h-24 w-full" />;

    if (!data) return null;

    const lifecycle = data.lifecycle ?? null;

    const warnings = listOf(lifecycle?.warnings).filter(item => typeof item === "string");

    // Keys carry the index: one symbol / CIK can appear twice (another class, another succession kind).
    const symbols = (data.proposed_symbols ?? []).map((symbol, index) => ({
        key: `${index}-${symbol.symbol}`,
        text: [
            symbol.symbol,
            symbol.exchange,
            symbol.security_class,
            symbol.ipo_calendar_match ? "on the IPO calendar" : null,
        ].filter(Boolean).join(" · "),
    }));

    const successors = (data.successors ?? []).map((successor, index) => ({
        key: `${index}-${successor.cik}`,
        text: [successor.name ?? `CIK ${successor.cik}`, `CIK ${successor.cik}`, successor.kind?.replaceAll("_", " ")].filter(Boolean).join(" · "),
    }));

    const formerNames = (data.former_names ?? []).map(former => ({
        key: `${former.name}-${former.until ?? ""}`,
        text: former.until ? `${former.name} (until ${former.until})` : former.name,
    }));

    return (
        <section aria-label="Issuer lifecycle" className="flex flex-col gap-3">
            {lifecycle
                ? (
                        <>
                            <Facts entries={scalarEntries(lifecycle)} />
                            <RecordList empty="No registration track." items={listOf(lifecycle.registration_tracks)} title="Registration tracks" />
                            <RecordList empty="No pending action." items={listOf(lifecycle.pending_actions)} reviewed={false} title="Pending actions" />
                        </>
                    )
                : <div className="text-muted-foreground text-xs">No lifecycle evidence for this filer.</div>}
            {symbols.length > 0 && <TextList empty="" items={symbols} title="Proposed symbols" />}
            <TextList empty="No successor." items={successors} title="Successors" />
            {formerNames.length > 0 && <TextList empty="" items={formerNames} title="Former names" />}
            {warnings.length > 0 && (
                <div className="text-muted-foreground flex flex-col text-xs" role="status">
                    {warnings.map(warning => <span key={warning}>{warning.replaceAll("_", " ")}</span>)}
                </div>
            )}
        </section>
    );
}

const fraction = (value: null | number) => (value === null ? "—" : formatFractionPercentCompact(value));

const NET_ASSETS_SCOPE_LABELS: Record<NonNullable<V2FilerFundSeries["net_assets_scope"]>, string> = {
    fund: "fund",
    series: "series total, all classes",
};

/** Net assets with their scope and report date (`series` = a multi-class fund's total, never one class's assets). */
function netAssetsText(series: V2FilerFundSeries) {
    if (series.net_assets_usd === null) return "—";

    const scope = series.net_assets_scope ? NET_ASSETS_SCOPE_LABELS[series.net_assets_scope] : null;

    return [formatMoneyCompact(series.net_assets_usd), scope, series.net_assets_as_of && `as of ${formatDay(series.net_assets_as_of)}`]
        .filter(Boolean)
        .join(" · ");
}

/** The class whose returns a row shows: the expense ratio's class, else the first class with returns. */
function returnsOf(series: V2FilerFundSeries) {
    return series.returns.find(entry => entry.class_id === series.expense_ratio_class_id) ?? series.returns.at(0) ?? null;
}

/**
 * A fund registrant's series (pure, `GET /v1/filers/{cik}?expand=fund`): name, ETF flag, exchange (MIC), class tickers,
 * net expense ratio, net assets with their scope and date, 1 / 5 / 10-year returns (the expense ratio's class). Ratios
 * and returns are fractions (0.0003 = 0.03 %). `fund: null` (not a fund, or fund data not served) renders nothing.
 */
export function SecFundView({ data }: { data: null | V2FilerResponse }) {
    const fund = data?.fund ?? null;

    if (!fund) return null;

    return (
        <section aria-label="Fund" className="flex flex-col gap-2">
            <Facts
                entries={[
                    ...(fund.investment_company_type ? [["registration", fund.investment_company_type] as [string, string]] : []),
                    ["series", String(fund.series_count)],
                ]}
            />
            {fund.series.length === 0
                ? <div className="text-muted-foreground text-xs">No fund series.</div>
                : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead className="text-muted-foreground text-left">
                                    <tr>
                                        <th className="p-1 font-normal">Series</th>
                                        <th className="p-1 font-normal">Exchange</th>
                                        <th className="p-1 font-normal">Class tickers</th>
                                        <th className="p-1 text-right font-normal">Expense ratio</th>
                                        <th className="p-1 font-normal">Net assets</th>
                                        <th className="p-1 text-right font-normal">1y</th>
                                        <th className="p-1 text-right font-normal">5y</th>
                                        <th className="p-1 text-right font-normal">10y</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {fund.series.map((series) => {
                                        const returns = returnsOf(series);

                                        const tickers = series.share_classes.flatMap(entry => (entry.ticker ? [entry.ticker] : []));

                                        return (
                                            <tr key={series.fund_key}>
                                                <td className="p-1">
                                                    <span className="font-medium" title={series.fund_key}>{series.series_name ?? series.fund_key}</span>
                                                    {series.is_etf && <Badge className="ml-1" variant="outline">ETF</Badge>}
                                                </td>
                                                <td className="p-1">{series.exchange ?? "—"}</td>
                                                <td className="p-1">{tickers.length > 0 ? tickers.join(", ") : "—"}</td>
                                                <td className="p-1 text-right tabular-nums">{fraction(series.expense_ratio_net)}</td>
                                                <td className="p-1 tabular-nums">{netAssetsText(series)}</td>
                                                <td className="p-1 text-right tabular-nums">{fraction(returns?.one_year ?? null)}</td>
                                                <td className="p-1 text-right tabular-nums">{fraction(returns?.five_year ?? null)}</td>
                                                <td className="p-1 text-right tabular-nums">{fraction(returns?.ten_year ?? null)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
        </section>
    );
}

const EXEMPTION_LABELS: Record<string, string> = {
    "3C": "ICA 3(c)",
    "04": "Rule 504",
    "4a5": "Sec. 4(a)(5)",
    "06b": "Rule 506(b)",
    "06c": "Rule 506(c)",
};

/** A Form D exemption as filed (`06b`, `3C.7`, …) → a short label; an unknown code stays as filed. */
export function exemptionLabel(code: string) {
    if (EXEMPTION_LABELS[code]) return EXEMPTION_LABELS[code];

    const ica = /^3C\.(\d+)$/.exec(code);

    return ica ? `ICA 3(c)(${ica[1]})` : code;
}

const offeringUsd = (value: null | number) => (value === null ? "—" : `$${formatNumberEnCompact(value)}`);

/** The offering size: "Indefinite" when stated so, else the amount (USD). */
export function offeringAmountText(offering: Pick<V2Offering, "indefinite_amount" | "total_offering_amount">) {
    return offering.indefinite_amount ? "Indefinite" : offeringUsd(offering.total_offering_amount);
}

/** The issuer of an offering: its filer page (any Form D issuer has one, listed or not). */
function IssuerCell({ offering }: { offering: Pick<V2Offering, "issuer_name" | "primary_issuer_cik"> }) {
    const cik = filerCikParam(offering.primary_issuer_cik);

    const name = offering.issuer_name ?? (cik ? `CIK ${cik}` : "—");

    return cik
        ? <Link className="truncate font-medium underline-offset-4 hover:underline" params={{ cik }} title={`SEC filer · CIK ${cik}`} to="/sec/$cik">{name}</Link>
        : <span className="truncate">{name}</span>;
}

/** The columns of an offerings list; `issuer` adds the issuer (the market-wide list; a filer's page knows it). */
export function offeringColumns({ issuer }: { issuer: boolean }): Array<ColumnDef<V2Offering>> {
    const columns: Array<ColumnDef<V2Offering>> = [
        { cell: ({ row }) => <span className="tabular-nums">{formatDay(row.original.filed_latest)}</span>, header: "Latest filing", id: "filed_latest" },
        {
            cell: ({ row }) => (
                <div className="flex items-center gap-1">
                    <Link
                        className="font-medium tabular-nums underline-offset-4 hover:underline"
                        params={{ offeringId: row.original.offering_id }}
                        title={`Latest accession ${row.original.latest_accession}`}
                        to="/offerings/$offeringId"
                    >
                        {row.original.offering_id}
                    </Link>
                    {row.original.amendment_count > 0 && (
                        <Badge variant="outline">
                            {`${row.original.amendment_count} amendment${row.original.amendment_count === 1 ? "" : "s"}`}
                        </Badge>
                    )}
                </div>
            ),
            header: "Offering",
            id: "offering_id",
        },
    ];

    if (issuer) columns.push({ cell: ({ row }) => <div className="max-w-[260px] truncate"><IssuerCell offering={row.original} /></div>, header: "Issuer", id: "issuer_name" });

    columns.push(
        { cell: ({ row }) => row.original.industry_group ?? "—", header: "Industry", id: "industry_group" },
        {
            cell: ({ row }) => (
                <span title={row.original.exemptions.join(", ")}>
                    {row.original.exemptions.length > 0 ? row.original.exemptions.map(exemptionLabel).join(", ") : "—"}
                </span>
            ),
            header: "Exemptions",
            id: "exemptions",
        },
        { cell: ({ row }) => <div className="text-right tabular-nums">{offeringAmountText(row.original)}</div>, header: () => <div className="text-right">Offering size</div>, id: "total_offering_amount" },
        { cell: ({ row }) => <div className="text-right tabular-nums">{offeringUsd(row.original.total_sold)}</div>, header: () => <div className="text-right">Sold</div>, id: "total_sold" },
        {
            cell: ({ row }) => <div className="text-right tabular-nums">{row.original.investor_count === null ? "—" : formatNumberEn(row.original.investor_count)}</div>,
            header: () => <div className="text-right">Investors</div>,
            id: "investor_count",
        },
    );

    return columns;
}

const FILER_OFFERING_COLUMNS = offeringColumns({ issuer: false });

/**
 * A filer's Form D private offerings (pure): the summary of `GET /v1/filers/{cik}?expand=private_offerings` and the
 * offerings of `GET /v1/offerings?company=<cik>` (newest latest filing first, "Load more" by cursor; an offering opens
 * `/offerings/$offeringId`). Amounts are USD; exemptions as filed with a short label. `summary: null` (no Form D, or
 * Form D data not served) renders nothing.
 */
export function SecPrivateOfferingsView({
    error,
    exportScope,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    onMore,
    pages,
    summary,
}: {
    error: unknown;
    /** The export's file-name scope (the filer's CIK). */
    exportScope?: string;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    onMore: () => void;
    pages: ReadonlyArray<V2OfferingsResponse>;
    summary: null | V2FilerPrivateOfferings;
}) {
    if (!summary) return null;

    const facts: Array<[string, string]> = [["offerings", String(summary.count)]];

    if (summary.first_filed) facts.push(["first filed", summary.first_filed]);

    if (summary.latest_filed) facts.push(["latest filed", summary.latest_filed]);

    if (summary.total_sold !== null) facts.push(["total sold", offeringUsd(summary.total_sold)]);

    if (summary.latest_exemptions.length > 0) facts.push(["latest exemptions", summary.latest_exemptions.map(exemptionLabel).join(", ")]);

    let body: ReactNode = null;

    if (summary.count > 0) {
        body = error && pages.length === 0
            ? <SecReadinessNotice error={error} title="Failed to load the private offerings" />
            : (
                    <DataTable
                        columns={FILER_OFFERING_COLUMNS}
                        emptyIsGenuine={isV2GenuineEmpty(pages.at(0)?.meta.coverage)}
                        emptyText="No offerings."
                        exportConfig={exportScope ? { dataset: "offerings", scope: exportScope } : undefined}
                        hasNextPage={hasNextPage}
                        isFetchingNextPage={isFetchingNextPage}
                        isLoading={isLoading}
                        onLoadMore={onMore}
                        operationId="listOfferings"
                        rows={pages.flatMap(page => page.data)}
                    />
                );
    }

    return (
        <section aria-label="Private offerings" className="flex flex-col gap-2">
            <Facts entries={facts} />
            {body}
            {error && pages.length > 0 ? <SecReadinessNotice error={error} title="Failed to load more offerings" /> : null}
        </section>
    );
}

/**
 * A filer's filings (pure, `GET /v1/filings?symbol=<cik>`): every loaded cursor page, the `meta.form_facet` filter, a
 * row opens the accession's documents in the source panel; "No filings" only for a complete answer.
 */
export function SecFilingsView({
    error,
    form,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    onFormChange,
    onMore,
    onOpen,
    pages,
}: {
    error: unknown;
    form: null | string;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    onFormChange: (form: null | string) => void;
    onMore: () => void;
    onOpen: (target: SecPanelTarget) => void;
    pages: ReadonlyArray<V2FilingsResponse>;
}) {
    if (error && pages.length === 0) return <SecReadinessNotice error={error} title="Failed to load the filings" />;

    if (isLoading && pages.length === 0) return <Skeleton className="h-40 w-full" />;

    const first = pages.at(0);

    if (!first) return null;

    const filings = pages.flatMap(page => page.data);

    const facet = first.meta.form_facet ?? [];

    const options = [
        { label: "All forms", value: "all" },
        ...facet.map(entry => ({ label: `${entry.form} (${entry.count})`, value: entry.form })),
    ];

    return (
        <section aria-label="Filings" className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
                <FilterSelect className="w-[200px]" onValueChange={value => onFormChange(value === "all" ? null : value)} options={options} value={form ?? "all"} />
            </div>
            <SecReadinessNotice coverage={pages.at(-1)?.meta.coverage} />
            {filings.length === 0
                ? (isV2GenuineEmpty(first.meta.coverage) && <div className="text-muted-foreground text-xs">No filings.</div>)
                : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead className="text-muted-foreground text-left">
                                    <tr>
                                        <th className="p-1 font-normal">Form</th>
                                        <th className="p-1 font-normal">Filed</th>
                                        <th className="p-1 font-normal">Period</th>
                                        <th className="p-1 font-normal">Accession</th>
                                        <th className="p-1 font-normal">Roles</th>
                                        <th className="p-1" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {filings.map(filing => (
                                        <tr key={filing.accession}>
                                            <td className="p-1 font-medium">{filing.form}</td>
                                            <td className="p-1">{filing.filing_date}</td>
                                            <td className="p-1">{filing.report_date ?? "—"}</td>
                                            <td className="p-1 tabular-nums"><Copyable label="Copy accession number" value={filing.accession} /></td>
                                            <td className="p-1">{filing.roles.join(", ") || "—"}</td>
                                            <td className="flex items-center justify-end gap-2 p-1">
                                                {filing.edgar_index_url.startsWith("https://www.sec.gov/") && (
                                                    <a className="underline-offset-4 hover:underline" href={filing.edgar_index_url} rel="noopener noreferrer" target="_blank">
                                                        EDGAR
                                                    </a>
                                                )}
                                                <Button
                                                    onClick={() => onOpen({ accession: filing.accession, kind: "filing", title: `${filing.form} · ${filing.accession}` })}
                                                    size="xs"
                                                    type="button"
                                                    variant="outline"
                                                >
                                                    <FileText />
                                                    Documents
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
            {error ? <SecReadinessNotice error={error} title="Failed to load more filings" /> : null}
            {hasNextPage && (
                <Button className="self-center" disabled={isFetchingNextPage} onClick={onMore} size="sm" type="button" variant="outline">
                    {isFetchingNextPage ? "Loading…" : "More filings"}
                </Button>
            )}
        </section>
    );
}

const usd = new Intl.NumberFormat("en", { currency: "USD", maximumFractionDigits: 0, style: "currency" });

const PORTFOLIO_COLUMNS: Array<ColumnDef<V2Holder>> = [
    {
        cell: ({ row }) => (
            <div className="max-w-[280px] truncate">
                <SecurityLink className="font-medium" security={row.original.security}>{row.original.security.symbol ?? row.original.security.name ?? "—"}</SecurityLink>
                {row.original.security.symbol && row.original.security.name && <span className="text-muted-foreground">{` · ${row.original.security.name}`}</span>}
            </div>
        ),
        header: "Company",
        id: "security",
    },
    {
        cell: ({ row }) => (row.original.security.cusip ? <Copyable className="tabular-nums" label="Copy CUSIP" value={row.original.security.cusip} /> : "—"),
        header: "CUSIP",
        id: "cusip",
    },
    {
        cell: ({ row }) => <div className="text-right tabular-nums">{row.original.shares == null ? "—" : formatNumberEn(row.original.shares)}</div>,
        header: () => <div className="text-right">Shares / principal</div>,
        id: "shares",
    },
    { cell: ({ row }) => [row.original.shares_type, row.original.put_call].filter(Boolean).join(" · ") || "—", header: "Unit", id: "shares_type" },
    {
        cell: ({ row }) => <div className="text-right tabular-nums">{row.original.value_usd == null ? "—" : usd.format(row.original.value_usd)}</div>,
        header: () => <div className="text-right">Value</div>,
        id: "value_usd",
    },
    { cell: ({ row }) => discretionText(row.original.investment_discretion), header: "Discretion", id: "investment_discretion" },
    {
        cell: ({ row }) => <div className="tabular-nums whitespace-nowrap">{votingText(row.original.voting_authority)}</div>,
        header: "Voting authority",
        id: "voting_authority",
    },
];

/**
 * A 13F manager's portfolio for one quarter (pure, `GET /v1/filers/{cik}/holdings?period_end=`, the `Holder` row): the provenance line
 * (`meta.coverage`, `pinned_at`, `counting`), the quarter's 13F filing (EDGAR) once, the positions by dollar value with
 * their investment discretion and voting authority, "Load more" by cursor, export.
 */
export function SecPortfolioView({
    error,
    exportScope,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    onMore,
    pages,
}: {
    error: unknown;
    /** The export's file-name scope (the manager's CIK). */
    exportScope?: string;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    onMore: () => void;
    pages: ReadonlyArray<V2FilerHoldingsResponse>;
}) {
    if (error && pages.length === 0) return <SecReadinessNotice error={error} title="Failed to load the 13F portfolio" />;

    const first = pages.at(0);

    const rows = pages.flatMap(page => page.data);

    // One 13F report per quarter: its filing is the same on every row.
    const filing = rows.find(row => row.filing_url);

    return (
        <section aria-label="13F portfolio" className="flex flex-col gap-2">
            <SecReadinessNotice coverage={pages.at(-1)?.meta.coverage} />
            {first && <V2MetaLine meta={first.meta} />}
            {filing && (
                <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs" data-testid="portfolio-filing">
                    <span>{`13F filed ${formatDay(filing.filing_date)}`}</span>
                    {filing.accession_number && <Copyable className="tabular-nums" label="Copy accession number" value={filing.accession_number} />}
                    <FilingLink url={filing.filing_url} />
                </div>
            )}
            <DataTable
                columns={PORTFOLIO_COLUMNS}
                emptyIsGenuine={isV2GenuineEmpty(first?.meta.coverage)}
                emptyText="The manager reported no positions for this quarter."
                exportConfig={exportScope ? { dataset: "13f-portfolio", scope: exportScope } : undefined}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoading}
                onLoadMore={onMore}
                operationId="listFilerHoldings"
                rows={rows}
            />
            {error ? <SecReadinessNotice error={error} title="Failed to load more positions" /> : null}
        </section>
    );
}
