import type { ColumnDef } from "@tanstack/react-table";

import * as React from "react";

import type { MetricsListState } from "@/components/financial-metrics/metrics-list-body";
import type { SegmentedFinancialsSegmentId, V2Segment, V2SegmentsDetailedResponse } from "@/lib/api/types";

import { FinancialsStateNotice, METRICS_PENDING_TITLE } from "@/components/financial-metrics/metrics-list-body";
import { MetricCatalogLink } from "@/components/reference/metric-catalog-link";
import { DataTable } from "@/components/ui/data-table";
import { Notice } from "@/components/ui/notice";
import { edgarFolderUrl } from "@/lib/earnings/edgar";
import { dimensionsText, periodLabel, segmentFactKey, xbrlNameText } from "@/lib/financials/statements";
import { isV2GenuineEmpty } from "@/lib/sec/readiness";
import { formatMetricId, formatNumberEn, formatSegmentId } from "@/lib/utils";

/** One row of `/v1/segments/detailed` (PRO): a segment fact with its concept, filing, inline-XBRL id and caption. */
export type SegmentDetailedRow = V2SegmentsDetailedResponse["data"][number];

const ALL = "all";

/** A filter choice of the segments tab: a metric id or an XBRL axis, in words. */
export type SegmentFilterOption = { label: string; value: string };

/**
 * The metric and axis choices of the Segments tab, from the loaded rows (the API lists no company's segment metrics or
 * axes): sorted by label, the chosen value kept when the loaded rows no longer name it (it filters them).
 */
export function segmentFilterOptions(
    rows: ReadonlyArray<Pick<V2Segment, "dimensions" | "metric_id">>,
    chosen: { axis?: string; metric?: string },
): { axes: Array<SegmentFilterOption>; metrics: Array<SegmentFilterOption> } {
    const metrics = new Set(rows.map(row => row.metric_id));

    const axes = new Set(rows.flatMap(row => row.dimensions.map(dimension => dimension.axis)));

    if (chosen.metric) metrics.add(chosen.metric);

    if (chosen.axis) axes.add(chosen.axis);

    const sorted = (options: Array<SegmentFilterOption>) => options.sort((a, b) => a.label.localeCompare(b.label));

    const axisLabel = (axis: string) => xbrlNameText(axis) || axis;

    // Two taxonomies can name the same axis (srt: / us-gaap:StatementGeographicalAxis): such labels keep their prefix.
    const axisLabels = [...axes].map(axisLabel);

    const shared = new Set(axisLabels.filter((label, index) => axisLabels.indexOf(label) !== index));

    return {
        axes: sorted([...axes].map(axis => ({ label: shared.has(axisLabel(axis)) ? `${axisLabel(axis)} (${axis.split(":")[0]})` : axisLabel(axis), value: axis }))),
        metrics: sorted([...metrics].map(metric => ({ label: formatMetricId(metric) || metric, value: metric }))),
    };
}

/** The select options with "All …" first (the value `all` = the parameter is not sent). */
export function withAll(options: ReadonlyArray<SegmentFilterOption>, label: string): Array<SegmentFilterOption> {
    return [{ label, value: ALL }, ...options];
}

function columns(onOpenFiling: (accession: string) => void): Array<ColumnDef<SegmentDetailedRow>> {
    return [
        { cell: ({ row }) => periodLabel(row.original), header: "Period", id: "period" },
        {
            cell: ({ row }) => {
                const label = formatMetricId(row.original.metric_id) || row.original.metric_id;

                return (
                    <span className="flex items-center gap-1">
                        {label}
                        <MetricCatalogLink label={label} metricId={row.original.metric_id} />
                    </span>
                );
            },
            header: "Metric",
            id: "metric_id",
        },
        {
            cell: ({ row }) => {
                const details = dimensionsText(row.original.dimensions);

                const segment = formatSegmentId(row.original.segment_id) || row.original.segment_id;

                return (
                    <span className="flex flex-col" title={row.original.dimensions.map(d => `${d.axis} = ${d.member}`).join("\n")}>
                        <span>{details ? `${segment} · ${details}` : segment}</span>
                        {row.original.via_link && (
                            <span className="text-muted-foreground text-xs">
                                {`From ${row.original.source_member ?? "earlier member"}`}
                            </span>
                        )}
                    </span>
                );
            },
            header: "Segment",
            id: "segment",
        },
        {
            cell: ({ row }) => <div className="text-right tabular-nums">{formatNumberEn(row.original.value, { maximumFractionDigits: 4 })}</div>,
            header: () => <div className="text-right">Value</div>,
            id: "value",
        },
        { cell: ({ row }) => row.original.currency ?? row.original.unit?.toUpperCase() ?? "—", header: "Currency / unit", id: "unit" },
        {
            cell: ({ row }) => row.original.reconciles_to_total === true ? "Filed group reconciles" : row.original.reconciles_to_total === false ? "Group does not reconcile" : "Not compared",
            header: "Reconciliation",
            id: "reconciliation",
        },
        {
            cell: ({ row }) => <SegmentLinkEvidence onOpenFiling={onOpenFiling} row={row.original} />,
            header: "Member links",
            id: "member_links",
        },
        {
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span>{row.original.html_label ?? "—"}</span>
                    {row.original.metric && <code className="text-muted-foreground text-xs">{row.original.metric}</code>}
                </div>
            ),
            header: "As filed",
            id: "html_label",
        },
        {
            cell: ({ row }) => {
                const { accession, company, html_tag_id: tagId } = row.original;

                if (!accession) return "—";

                const edgar = edgarFolderUrl(company.cik, accession);

                return (
                    <span className="flex flex-wrap items-center gap-x-2">
                        <button className="font-medium underline-offset-4 hover:underline" onClick={() => onOpenFiling(accession)} title={tagId ? `Element ${tagId}` : undefined} type="button">
                            {accession}
                        </button>
                        {edgar && <a className="text-muted-foreground text-xs underline-offset-4 hover:underline" href={edgar} rel="noopener noreferrer" target="_blank">EDGAR</a>}
                    </span>
                );
            },
            header: "Filing",
            id: "accession",
        },
    ];
}

/** Keep the complete proved periods available, with their actual source filings rather than an inferred alias. */
function SegmentLinkEvidence({ onOpenFiling, row }: { onOpenFiling: (accession: string) => void; row: SegmentDetailedRow }) {
    const links = [
        ...(row.predecessors ?? []).map(link => ({ direction: "From", link })),
        ...(row.successors ?? []).map(link => ({ direction: "To", link })),
    ];

    if (links.length === 0) return "—";

    return (
        <details>
            <summary className="cursor-pointer">
                {links.length}
                {" "}
                {links.length === 1 ? "link" : "links"}
            </summary>
            <ul className="flex flex-col gap-2 pt-2 text-xs">
                {links.map(({ direction, link }) => (
                    <li key={`${direction}:${link.member}:${link.kind}`}>
                        <div className="font-medium">
                            {direction}
                            {" "}
                            {xbrlNameText(link.member)}
                            {" "}
                            ·
                            {" "}
                            {link.kind}
                        </div>
                        <div>
                            {link.kind === "split" ? "Split evidence only; never followed." : `Earlier rows before ${link.first_period_end}.`}
                            {" "}
                            Proof covers these comparisons:
                        </div>
                        <ul className="flex flex-col gap-1 pt-1">
                            {link.matched_periods.map(period => (
                                <li key={JSON.stringify([period.start_date, period.end_date, period.concept, period.unit, period.qualifiers, period.from_accession, period.to_accession])}>
                                    {`${period.start_date} – ${period.end_date} · ${period.concept} (${period.unit})`}
                                    <span className="flex gap-2">
                                        <button className="underline-offset-4 hover:underline" onClick={() => onOpenFiling(period.from_accession)} type="button">Original filing</button>
                                        <button className="underline-offset-4 hover:underline" onClick={() => onOpenFiling(period.to_accession)} type="button">Restating filing</button>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </li>
                ))}
            </ul>
        </details>
    );
}

/**
 * The detailed segments list (pure, PRO `/v1/segments/detailed`): one row per segment fact with its reported concept,
 * the filing's caption, unit and filing. All selections are sent to the API. Role groups use only authoritative
 * metadata; exports retain all loaded source components and their proof. No aggregate total is invented.
 */
export function SegmentsDetailedView({ onOpenFiling, pages, segmentId, ticker, ...state }: MetricsListState & {
    onOpenFiling: (accession: string) => void;
    pages: ReadonlyArray<V2SegmentsDetailedResponse>;
    segmentId: "all" | SegmentedFinancialsSegmentId;
    ticker: string;
}) {
    const rows = React.useMemo(() => {
        const loaded = pages.flatMap(page => page.data);

        const selected = segmentId === ALL ? loaded : loaded.filter(row => row.segment_id === segmentId);

        const unique = new Map<string, SegmentDetailedRow>();

        for (const row of selected) {
            const identity = segmentFactKey(row);

            if (!unique.has(identity)) unique.set(identity, row);
        }

        return [...unique.values()].sort((a, b) => Number(a.member_role === "reconciling") - Number(b.member_role === "reconciling"));
    }, [pages, segmentId]);

    const tableColumns = React.useMemo(() => columns(onOpenFiling), [onOpenFiling]);

    if (state.error && pages.length === 0) {
        return <FinancialsStateNotice error={state.error} pendingTitle={METRICS_PENDING_TITLE} title="Failed to load detailed segments" />;
    }

    const coverage = pages.at(0)?.meta.coverage;

    return (
        <div className="flex flex-col gap-2" data-testid="segments-detailed">
            <FinancialsStateNotice coverage={coverage} pendingTitle={METRICS_PENDING_TITLE} title="Detailed segments" />
            {rows.some(row => row.reconciles_to_total === false) && <Notice title="Some filed segment groups do not reconcile">Reconciling items are shown separately. The status describes the filed metric and period, not a sum of the selected rows. No total is calculated here.</Notice>}
            <DataTable
                columns={tableColumns}
                emptyIsGenuine={isV2GenuineEmpty(coverage)}
                emptyText={segmentId === ALL ? "No segment facts." : "No loaded rows for this segment."}
                errorState={state.error ? <FinancialsStateNotice error={state.error} pendingTitle={METRICS_PENDING_TITLE} title="Failed to load more segment facts" /> : null}
                exportConfig={{ dataset: "segments-detailed", scope: ticker }}
                getRowId={segmentFactKey}
                groupOf={rows.some(row => row.member_role === "reconciling")
                    ? row => row.member_role === "reconciling" ? "Reconciling items" : "Segment values"
                    : undefined}
                hasNextPage={state.hasNextPage}
                isFetchingNextPage={state.isFetchingNextPage}
                isLoading={state.isLoading}
                onLoadMore={state.onLoadMore}
                operationId="listSegmentsDetailed"
                rows={rows}
            />
        </div>
    );
}
