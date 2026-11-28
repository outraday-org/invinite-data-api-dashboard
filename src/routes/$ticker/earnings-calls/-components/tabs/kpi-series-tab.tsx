import * as React from "react";
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";

import type { V2KpiSeriesPoint } from "@/lib/api/types";
import type { KpiSeriesGroup } from "@/lib/earnings/extraction";

import { AXIS_TICK, CHART_MARGIN, ChartFrame, GRID_STROKE, LINE_CURSOR, TOOLTIP_CONTENT_STYLE } from "@/components/charts/chart-parts";
import { Badge } from "@/components/ui/badge";
import { FilterSelect } from "@/components/ui/filter-select";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useV2KpiSeriesInfinite } from "@/lib/api/queries";
import { useAutoLoadPages } from "@/lib/api/use-auto-load-pages";
import {
    EXTRACTION_PERIOD_KIND_LABELS,
    formatKpiValue,
    formatYoyChange,
    kpiSeriesGroups,
    kpiSeriesSegments,
    kpiUnitLabel,
    XBRL_CHECK_LABELS,
} from "@/lib/earnings/extraction";
import { formatDay } from "@/lib/format";

import type { CallTabProps } from "../call-tabs";

import { MediaState, Notice } from "../media-state";

export const KPI_SERIES_EMPTY_TITLE = "No KPI series for this company";

/** The segment picker's value of the company-wide rows (`segment: null`). */
const COMPANY_WIDE = "__company__";

/** One KPI: a line of its plotted period kind over `period_end`, then every point with its financial checks. */
function KpiSeriesCard({ group }: { group: KpiSeriesGroup }) {
    const plotted = group.points.filter(point => point.period_kind === group.plottedKind);

    const others = group.points.length - plotted.length;

    const format = (value: number) => formatKpiValue(value, group.unit);

    const description = [
        kpiUnitLabel(group.unit),
        EXTRACTION_PERIOD_KIND_LABELS[group.plottedKind],
        others > 0 ? `${others} ${others === 1 ? "value" : "values"} of other periods in the table only` : null,
    ].filter(Boolean).join(" · ");

    return (
        <Section aria-label={group.label} title={group.label}>
            <ChartFrame description={description} height={200} title={<span className="text-muted-foreground font-mono text-xs">{group.kpiKey}</span>}>
                <LineChart data={plotted} margin={CHART_MARGIN}>
                    <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                    <XAxis axisLine={{ stroke: GRID_STROKE }} dataKey="period_end" minTickGap={24} tick={AXIS_TICK} tickFormatter={(value: string) => formatDay(value)} tickLine={false} />
                    <YAxis axisLine={false} domain={["auto", "auto"]} tick={AXIS_TICK} tickFormatter={format} tickLine={false} width={72} />
                    <Tooltip
                        contentStyle={TOOLTIP_CONTENT_STYLE}
                        cursor={LINE_CURSOR}
                        formatter={value => (typeof value === "number" ? format(value) : "—")}
                        labelFormatter={label => (typeof label === "string" ? formatDay(label) : "")}
                    />
                    <Line dataKey="value" isAnimationActive={false} name={group.label} stroke="var(--color-chart-1)" strokeWidth={2} type="monotone" />
                </LineChart>
            </ChartFrame>
            <Table aria-label={`${group.label} values`}>
                <TableHeader>
                    <TableRow>
                        <TableHead>Period end</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                        <TableHead className="text-right">YoY</TableHead>
                        <TableHead>10-Q / 10-K</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {[...group.points].reverse().map((point) => {
                        const check = XBRL_CHECK_LABELS[point.xbrl_check];

                        return (
                            <TableRow key={point.id}>
                                <TableCell className="whitespace-nowrap">{formatDay(point.period_end)}</TableCell>
                                <TableCell>{EXTRACTION_PERIOD_KIND_LABELS[point.period_kind]}</TableCell>
                                <TableCell className="text-right tabular-nums">{formatKpiValue(point.value, point.unit)}</TableCell>
                                <TableCell className="text-right tabular-nums">{formatYoyChange(point.yoy_change, point.unit)}</TableCell>
                                <TableCell><Badge className={check.className} variant="outline">{check.label}</Badge></TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </Section>
    );
}

/**
 * The KPI series tab (pure): the plan gate / error, loading, empty, else one chart + table per KPI of the chosen
 * segment (company-wide by default; a picker when the company reports segments).
 */
export function KpiSeriesView({
    error,
    isLoading,
    onSegmentChange,
    points,
    segment,
}: {
    error: unknown;
    isLoading: boolean;
    onSegmentChange: (segment: null | string) => void;
    points: ReadonlyArray<V2KpiSeriesPoint>;
    segment: null | string;
}) {
    const groups = React.useMemo(() => kpiSeriesGroups(points, segment), [points, segment]);

    const segments = React.useMemo(() => kpiSeriesSegments(points), [points]);

    if (error && points.length === 0) return <MediaState error={error} notFound={KPI_SERIES_EMPTY_TITLE} operationId="listKpiSeries" title="Failed to load the KPI series" />;

    if (isLoading) return <Skeleton className="h-64 w-full" />;

    if (points.length === 0) {
        return <Notice title={KPI_SERIES_EMPTY_TITLE}>A series exists where the KPI catalog of the company’s sector names the KPI.</Notice>;
    }

    const options = [
        { label: "Company-wide", value: COMPANY_WIDE },
        ...segments.map(name => ({ label: name, value: name })),
    ];

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-2">
                <p className="text-muted-foreground">
                    The company’s operating KPIs across periods: release tables first, then the release text, then the call. A later release that restates a period replaces its value.
                </p>
                {segments.length > 0 && (
                    <FilterSelect
                        aria-label="Segment"
                        className="ml-auto w-56"
                        onValueChange={value => onSegmentChange(value === COMPANY_WIDE ? null : value)}
                        options={options}
                        value={segment ?? COMPANY_WIDE}
                    />
                )}
            </div>
            {groups.length === 0
                ? <Notice title="No KPI series for this segment" />
                : groups.map(group => <KpiSeriesCard group={group} key={group.kpiKey} />)}
            {error ? <MediaState error={error} operationId="listKpiSeries" title="Failed to load more KPI values" /> : null}
        </div>
    );
}

/** KPI series tab (Data API 12.1): `/v1/kpi-series?company=<the event's company>`, every page (PRO). */
export function KpiSeriesTab({ event }: CallTabProps) {
    const [segment, setSegment] = React.useState<null | string>(null);

    const query = useV2KpiSeriesInfinite({ company: event.cik });

    useAutoLoadPages({ ...query, hasNextPage: Boolean(query.hasNextPage) });

    const points = React.useMemo(() => query.data?.pages.flatMap(page => page.data) ?? [], [query.data]);

    return <KpiSeriesView error={query.error} isLoading={query.isLoading} onSegmentChange={setSegment} points={points} segment={segment} />;
}
