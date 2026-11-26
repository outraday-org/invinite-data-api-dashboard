import * as React from "react";

import type { V2NonGaapMetric } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { useV2NonGaapInfinite } from "@/lib/api/queries";
import { useAutoLoadPages } from "@/lib/api/use-auto-load-pages";
import {
    EXTRACTION_PERIOD_KIND_LABELS,
    formatNonGaapValue,
    formatSignedNonGaap,
    RECONCILIATION_LABELS,
    reconciliationState,
    sourceCellText,
} from "@/lib/earnings/extraction";
import { percent } from "@/lib/earnings/labels";
import { formatDay } from "@/lib/format";

import type { CallTabProps } from "../call-tabs";

import { MediaState, Notice } from "../media-state";

export const NON_GAAP_EMPTY_TITLE = "No non-GAAP figures for this call";

/** `reconciled` as one badge: Reconciled / Does not add up (served as printed) / Nothing to check. */
export function ReconciliationBadge({ reconciled }: { reconciled: boolean | null }) {
    const style = RECONCILIATION_LABELS[reconciliationState(reconciled)];

    return <Badge className={style.className} title={style.title} variant="outline">{style.label}</Badge>;
}

/** The release's reconciliation of one figure: the GAAP start, each adjustment line as printed, the reported figure. */
function ReconciliationLines({ figure }: { figure: V2NonGaapMetric }) {
    const format = (value: null | number) => formatNonGaapValue(value, figure.unit, figure.currency);

    if (figure.gaap === null && figure.adjustments.length === 0) {
        return <p className="text-muted-foreground">The release prints no reconciliation for this figure.</p>;
    }

    return (
        <Table aria-label={`Reconciliation of ${figure.metric}`}>
            <TableBody>
                <TableRow>
                    <TableCell className="whitespace-normal">
                        <span className="text-muted-foreground">GAAP start · </span>
                        {figure.gaap?.metric ?? "Not named"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{format(figure.gaap?.value ?? null)}</TableCell>
                </TableRow>
                {figure.adjustments.map((line, index) => (
                    // Adjustment lines have no id; their printed order is stable within one figure.
                    <TableRow key={index}>
                        <TableCell className="whitespace-normal pl-6">{line.label}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatSignedNonGaap(line.amount, figure.unit, figure.currency)}</TableCell>
                    </TableRow>
                ))}
                <TableRow>
                    <TableCell className="font-medium whitespace-normal">{`= ${figure.metric}`}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{format(figure.value)}</TableCell>
                </TableRow>
                {figure.reconciliation_gap !== null && figure.reconciliation_gap !== 0 && (
                    <TableRow>
                        <TableCell className="text-muted-foreground whitespace-normal">Gap (reported − GAAP − adjustments)</TableCell>
                        <TableCell className="text-muted-foreground text-right tabular-nums">{formatSignedNonGaap(figure.reconciliation_gap, figure.unit, figure.currency)}</TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    );
}

/** One figure: as printed, its period, value, reconciliation and the release cell it was read from. */
function NonGaapFigure({ figure }: { figure: V2NonGaapMetric }) {
    const format = (value: null | number) => formatNonGaapValue(value, figure.unit, figure.currency);

    return (
        <article aria-label={figure.metric} className="flex flex-col gap-2 border-b pb-4 last:border-b-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h4 className="font-medium">{figure.metric}</h4>
                <span className="text-muted-foreground font-mono text-xs">{figure.metric_key}</span>
                <span className="text-muted-foreground">
                    {`${EXTRACTION_PERIOD_KIND_LABELS[figure.period_kind]} ended ${formatDay(figure.period_end)}`}
                </span>
                <span className="ml-auto flex items-center gap-2">
                    <span className="text-base font-medium tabular-nums">{format(figure.value)}</span>
                    <ReconciliationBadge reconciled={figure.reconciled} />
                </span>
            </div>

            <ReconciliationLines figure={figure} />

            <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {figure.prior_year_value !== null && <span>{`Prior year ${format(figure.prior_year_value)}`}</span>}
                <span title="Calibrated confidence of the metric assignment, not a probability">{`Confidence ${percent(figure.confidence, 0)}`}</span>
                <span>
                    <a className="text-primary underline-offset-4 hover:underline" href={figure.source.url} rel="noopener noreferrer" target="_blank">
                        Results release
                    </a>
                    {` · ${sourceCellText(figure.source)}`}
                    {figure.source.accession && ` · ${figure.source.accession}`}
                </span>
            </div>
        </article>
    );
}

/** The Non-GAAP tab (pure): the plan gate / error, loading, empty, else every figure in the API's order. */
export function NonGaapView({ error, figures, isLoading }: { error: unknown; figures: ReadonlyArray<V2NonGaapMetric>; isLoading: boolean }) {
    if (error && figures.length === 0) return <MediaState error={error} notFound={NON_GAAP_EMPTY_TITLE} operationId="listNonGaapMetrics" title="Failed to load the non-GAAP figures" />;

    if (isLoading) return <Skeleton className="h-40 w-full" />;

    if (figures.length === 0) {
        return <Notice title={NON_GAAP_EMPTY_TITLE}>The results release prints no adjusted figure, or it has not been read yet.</Notice>;
    }

    return (
        <div className="flex flex-col gap-4">
            <p className="text-muted-foreground">
                Adjusted figures as the results release prints them, each with the GAAP figure and adjustment lines it reconciles from. A figure that does not add up is served as printed, never corrected.
            </p>
            {figures.map(figure => <NonGaapFigure figure={figure} key={figure.id} />)}
            {error ? <MediaState error={error} operationId="listNonGaapMetrics" title="Failed to load more non-GAAP figures" /> : null}
        </div>
    );
}

/** Non-GAAP tab (Data API 12.1): `/v1/non-gaap?event=`, every page (PRO; the plan gate is the tab's notice). */
export function NonGaapTab({ eventId }: CallTabProps) {
    const query = useV2NonGaapInfinite({ eventId });

    useAutoLoadPages({ ...query, hasNextPage: Boolean(query.hasNextPage) });

    const figures = React.useMemo(() => query.data?.pages.flatMap(page => page.data) ?? [], [query.data]);

    return <NonGaapView error={query.error} figures={figures} isLoading={query.isLoading} />;
}
