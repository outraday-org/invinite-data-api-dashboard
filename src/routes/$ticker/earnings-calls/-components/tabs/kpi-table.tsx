import { ExternalLink } from "lucide-react";

import type { EarningsKpi } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEarningsExtractionsInfinite } from "@/lib/api/queries";
import { formatDecimal, metricLabel } from "@/lib/earnings/labels";
import { LoadMoreButton } from "@/routes/$ticker/filings/-components/load-more-button";

import type { CallTabProps } from "../call-tabs";

import { Notice } from "../media-state";
import { SeekButton } from "../seek-button";
import { EXTRACTIONS_PAGE_LIMIT } from "./guidance-table";

type FilingLink = NonNullable<EarningsKpi["filing_link"]>;

const ORIGIN_LABELS = { press_release: "Press release", transcript: "Transcript" } as const;

/** "FY2026 Q3 · ends 2026-09-27" of an XBRL fact. */
function factPeriodText(period: FilingLink["fact_period"]) {
    if (!period) return null;

    const fiscal = [period.fy === null ? null : `FY${period.fy}`, period.fp].filter(Boolean).join(" ");

    const span = period.start ? `${period.start} – ${period.end}` : `ends ${period.end}`;

    return [fiscal, span].filter(Boolean).join(" · ");
}

/** A truncated text with the full text in a tooltip. */
function TruncatedText({ className, text }: { className?: string; text: string }) {
    return (
        <Tooltip>
            <TooltipTrigger className={className} render={<span />}>
                <span className="line-clamp-2">{text}</span>
            </TooltipTrigger>
            <TooltipContent className="max-w-md">{text}</TooltipContent>
        </Tooltip>
    );
}

/**
 * The SEC filing that carries the same figure: the results 8-K's press release, replaced by
 * the 10-Q / 10-K XBRL fact once that is on EDGAR. `rounded` = the filing's value rounds to the
 * figure as spoken.
 */
function FilingLinkCell({ link }: { link: EarningsKpi["filing_link"] }) {
    if (!link) return <span className="text-muted-foreground">—</span>;

    const factPeriod = factPeriodText(link.fact_period);

    return (
        <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-1">
                <Badge variant="secondary">{link.form}</Badge>
                <Badge variant="outline">{link.match_kind}</Badge>
                <span className="tabular-nums">{formatDecimal(link.matched_value, 4)}</span>
            </div>
            {link.concept && (
                <span className="text-muted-foreground break-all">
                    {link.concept}
                    {factPeriod && ` · ${factPeriod}`}
                </span>
            )}
            <div className="flex flex-wrap items-center gap-2">
                <a className="inline-flex items-center gap-1 underline-offset-4 hover:underline" href={link.document_url} rel="noopener noreferrer" target="_blank">
                    Filing
                    <ExternalLink className="size-3" />
                </a>
                <a className="text-muted-foreground inline-flex items-center gap-1 underline-offset-4 hover:underline" href={link.edgar_index_url} rel="noopener noreferrer" target="_blank">
                    EDGAR index
                    <ExternalLink className="size-3" />
                </a>
                {link.snippet && (
                    <Tooltip>
                        <TooltipTrigger className="text-muted-foreground underline decoration-dotted underline-offset-4" render={<span />}>
                            Snippet
                        </TooltipTrigger>
                        <TooltipContent className="max-w-md">{link.snippet}</TooltipContent>
                    </Tooltip>
                )}
            </div>
        </div>
    );
}

/** Every reported KPI figure of the call, with its SEC filing match. */
export function KpiTable({ selector }: Pick<CallTabProps, "selector">) {
    const {
        data,
        error,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
    } = useEarningsExtractionsInfinite({ ...selector, kind: "kpi", limit: EXTRACTIONS_PAGE_LIMIT });

    const kpis = data?.pages.flatMap(page => page.kpis ?? []) ?? [];

    if (error) return <ErrorState error={error} title="Failed to load KPIs" />;

    if (isLoading) return <Skeleton className="h-40 w-full" />;

    if (kpis.length === 0 && !hasNextPage) return <Notice title="No KPIs" />;

    return (
        <div className="flex flex-col gap-2">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Metric</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Speaker</TableHead>
                        <TableHead>Origin</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Filing link</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {kpis.map(kpi => (
                        <TableRow key={kpi.seq}>
                            <TableCell>
                                <div className="flex flex-col items-start gap-1">
                                    {kpi.metric_normalized && <Badge variant="secondary">{metricLabel(kpi.metric_normalized)}</Badge>}
                                    <span className="whitespace-normal">{kpi.metric}</span>
                                </div>
                            </TableCell>
                            <TableCell className="tabular-nums">
                                {kpi.value_text}
                                {kpi.unit && <span className="text-muted-foreground">{` ${kpi.unit}`}</span>}
                            </TableCell>
                            <TableCell>{kpi.period_label ?? "—"}</TableCell>
                            <TableCell className="whitespace-normal">
                                {kpi.speaker.name ?? <span className="text-muted-foreground">—</span>}
                                {kpi.speaker.title && <div className="text-muted-foreground">{kpi.speaker.title}</div>}
                            </TableCell>
                            <TableCell><Badge variant="outline">{ORIGIN_LABELS[kpi.origin]}</Badge></TableCell>
                            <TableCell className="max-w-xs whitespace-normal">
                                <div className="flex flex-col items-start gap-1">
                                    <TruncatedText text={kpi.source_sentence} />
                                    <SeekButton startMs={kpi.start_ms} />
                                </div>
                            </TableCell>
                            <TableCell className="min-w-48 whitespace-normal">
                                <FilingLinkCell link={kpi.filing_link} />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            <LoadMoreButton
                hasNextPage={Boolean(hasNextPage)}
                isFetchingNextPage={isFetchingNextPage}
                onLoadMore={() => fetchNextPage()}
            />
        </div>
    );
}
