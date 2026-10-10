import * as React from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ReferenceLine,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import type { EarningsCallsStatusResponse } from "@/lib/api/types";
import type { EarningsDayPoint } from "@/lib/status/chart-data";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { coverageRows, earningsDayPoints, windowDayList } from "@/lib/status/chart-data";
import { formatRatioPercent, formatSeconds, vendorLabel } from "@/lib/status/labels";
import { ALL_VENDORS } from "@/lib/status/search";

import {
    AXIS_TICK,
    BAR_CURSOR,
    CHART_MARGIN,
    ChartFrame,
    GRID_STROKE,
    legendText,
    LINE_CURSOR,
    StatePanel,
    TOOLTIP_CONTENT_STYLE,
} from "./chart-parts";

const dayTick = (value: unknown) => String(value).slice(5);

const secondsAxis = (value: number) => `${Math.round(value)} s`;

const percentAxis = (value: number) => `${Math.round(value)}%`;

const BREACH_LABELS = {
    final: "final transcript",
    first_segment: "first segment",
} as const;

type BreachDotProps = {
    cx?: number;
    cy?: number;
    index?: number;
    payload?: EarningsDayPoint;
};

const SERIES_DOT = { fill: "var(--series-1)", r: 2, strokeWidth: 0 };

/**
 * Every measured day gets a small dot (an isolated day between gaps stays visible); an SLO-breach
 * day gets a larger dot in the destructive colour. A gap (no value) draws nothing.
 */
function renderBreachDot({ cx, cy, index, payload }: BreachDotProps) {
    if (typeof cx !== "number" || typeof cy !== "number") return <g key={`dot-${index}`} />;

    if (!payload?.breached) return <circle cx={cx} cy={cy} key={`dot-${index}`} {...SERIES_DOT} />;

    return (
        <circle
            cx={cx}
            cy={cy}
            fill="var(--destructive)"
            key={`dot-${index}`}
            r={4.5}
            stroke="var(--background)"
            strokeWidth={1.5}
        />
    );
}

type LatencyChartProps = {
    dataKey: "finalLatencyP95S" | "firstSegmentP95S";
    description: string;
    points: Array<EarningsDayPoint>;
    targetS: number;
    title: string;
};

function LatencyChart({ dataKey, description, points, targetS, title }: LatencyChartProps) {
    return (
        <ChartFrame description={description} title={title}>
            <LineChart data={points} margin={CHART_MARGIN}>
                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                <XAxis axisLine={{ stroke: GRID_STROKE }} dataKey="day" minTickGap={16} tick={AXIS_TICK} tickFormatter={dayTick} tickLine={false} />
                <YAxis
                    axisLine={false}
                    domain={[0, (max: number) => Math.ceil(Math.max(max, targetS) * 1.1)]}
                    tick={AXIS_TICK}
                    tickFormatter={secondsAxis}
                    tickLine={false}
                    width={56}
                />
                <Tooltip
                    contentStyle={TOOLTIP_CONTENT_STYLE}
                    cursor={LINE_CURSOR}
                    formatter={value => (typeof value === "number" ? formatSeconds(value) : "—")}
                />
                <ReferenceLine
                    label={{ fill: "var(--muted-foreground)", fontSize: 11, position: "insideTopRight", value: `target ${targetS} s` }}
                    stroke="var(--destructive)"
                    strokeDasharray="4 4"
                    y={targetS}
                />
                <Line
                    activeDot={{ r: 4 }}
                    connectNulls={false}
                    dataKey={dataKey}
                    dot={renderBreachDot}
                    isAnimationActive={false}
                    name="p95"
                    stroke="var(--series-1)"
                    strokeWidth={2}
                    type="monotone"
                />
            </LineChart>
        </ChartFrame>
    );
}

function StatCard({ label, value }: { label: string; value: string }) {
    return (
        <Card size="sm">
            <CardHeader className="gap-1">
                <CardDescription>{label}</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums">{value}</CardTitle>
            </CardHeader>
        </Card>
    );
}

type VendorSelectProps = {
    onChange: (vendor: string) => void;
    vendor: string;
    vendors: ReadonlyArray<string>;
};

function VendorSelect({ onChange, vendor, vendors }: VendorSelectProps) {
    const options = [...new Set([ALL_VENDORS, vendor, ...vendors])];

    return (
        <Select onValueChange={value => onChange(String(value ?? ALL_VENDORS))} value={vendor}>
            <SelectTrigger aria-label="Webcast vendor" className="w-[180px]">
                {vendorLabel(vendor)}
            </SelectTrigger>
            <SelectContent>
                {options.map(option => (
                    <SelectItem key={option} value={option}>
                        {vendorLabel(option)}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

function EarningsDayTable({ points, rows }: { points: Array<EarningsDayPoint>; rows: EarningsCallsStatusResponse["days"] }) {
    const byDay = new Map(points.map(point => [point.day, point]));

    const newestFirst = [...rows].sort((a, b) => b.day.localeCompare(a.day));

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Day</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead className="text-right">Live</TableHead>
                    <TableHead className="text-right">Capture success</TableHead>
                    <TableHead className="text-right">First segment p95</TableHead>
                    <TableHead className="text-right">Final p95</TableHead>
                    <TableHead>Breaches</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {newestFirst.map(row => (
                    <TableRow key={`${row.day}|${row.vendor}`}>
                        <TableCell className="tabular-nums">{row.day}</TableCell>
                        <TableCell>{vendorLabel(row.vendor)}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.callsTotal}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.callsLive}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatRatioPercent(row.captureSuccessRate, 1)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatSeconds(byDay.get(row.day)?.firstSegmentP95S)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatSeconds(row.finalLatencyP95S)}</TableCell>
                        <TableCell className={row.breaches.length > 0 ? "text-destructive" : "text-muted-foreground"}>
                            {row.breaches.length > 0 ? row.breaches.map(breach => BREACH_LABELS[breach]).join(", ") : "none"}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

type EarningsSectionProps = {
    earnings: EarningsCallsStatusResponse;
    onVendorChange: (vendor: string) => void;
    vendor: string;
};

/** Daily capture SLOs (per vendor) and coverage of the earnings-call pipeline. */
export function EarningsSection({ earnings, onVendorChange, vendor }: EarningsSectionProps) {
    const { last7d } = earnings.summary;

    const firstSegmentTargetS = earnings.slo.firstSegmentP95Ms / 1000;

    const vendorRows = React.useMemo(() => earnings.days.filter(row => row.vendor === vendor), [earnings.days, vendor]);

    const windowDays = React.useMemo(
        () => windowDayList(earnings.generatedAt, earnings.windowDays, { endsYesterday: true }),
        [earnings.generatedAt, earnings.windowDays],
    );

    const points = React.useMemo(() => earningsDayPoints(earnings.days, vendor, windowDays), [earnings.days, vendor, windowDays]);

    const coverage = React.useMemo(() => coverageRows(earnings.coverageDays, windowDays), [earnings.coverageDays, windowDays]);

    return (
        <div className="space-y-6">
            <ul className="text-muted-foreground list-disc space-y-0.5 pl-5 text-sm">
                <li>{`First live segment p95 ≤ ${firstSegmentTargetS} s after call start`}</li>
                <li>{`Final transcript p95 ≤ ${earnings.slo.finalP95S} s after call end`}</li>
            </ul>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="First segment p95 (7 d)" value={formatSeconds(last7d.firstSegmentP95Ms === null ? null : last7d.firstSegmentP95Ms / 1000)} />
                <StatCard label="Final transcript p95 (7 d)" value={formatSeconds(last7d.finalLatencyP95S)} />
                <StatCard label="Capture success (7 d)" value={formatRatioPercent(last7d.captureSuccessRate, 1)} />
                <StatCard label="Covered live (7 d)" value={formatRatioPercent(last7d.coveredLiveRate, 1)} />
            </div>
            {earnings.days.length === 0
                ? <StatePanel>No measurements yet</StatePanel>
                : (
                        <>
                            <div className="flex items-center gap-3">
                                <span className="text-muted-foreground text-sm">Vendor</span>
                                <VendorSelect onChange={onVendorChange} vendor={vendor} vendors={earnings.vendors} />
                            </div>
                            <div className="grid gap-6 lg:grid-cols-2">
                                <LatencyChart
                                    dataKey="firstSegmentP95S"
                                    description="Daily p95 from call start; red dots mark SLO-breach days"
                                    points={points}
                                    targetS={firstSegmentTargetS}
                                    title="First live segment p95"
                                />
                                <LatencyChart
                                    dataKey="finalLatencyP95S"
                                    description="Daily p95 from call end; red dots mark SLO-breach days"
                                    points={points}
                                    targetS={earnings.slo.finalP95S}
                                    title="Final transcript p95"
                                />
                                <ChartFrame description="Calls per day by how they were covered (all vendors)" title="Coverage">
                                    <BarChart data={coverage} margin={CHART_MARGIN}>
                                        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                                        <XAxis axisLine={{ stroke: GRID_STROKE }} dataKey="day" minTickGap={16} tick={AXIS_TICK} tickFormatter={dayTick} tickLine={false} />
                                        <YAxis allowDecimals={false} axisLine={false} tick={AXIS_TICK} tickLine={false} width={40} />
                                        <Tooltip contentStyle={TOOLTIP_CONTENT_STYLE} cursor={BAR_CURSOR} />
                                        <Legend formatter={legendText} iconType="square" />
                                        <Bar dataKey="coveredLive" fill="var(--series-1)" isAnimationActive={false} name="Live" stackId="coverage" stroke="var(--background)" strokeWidth={2} />
                                        <Bar dataKey="coveredReplay24h" fill="var(--series-2)" isAnimationActive={false} name="Replay ≤ 24 h" stackId="coverage" stroke="var(--background)" strokeWidth={2} />
                                        <Bar dataKey="notCovered" fill="var(--muted-foreground)" isAnimationActive={false} name="Not covered" stackId="coverage" stroke="var(--background)" strokeWidth={2} />
                                    </BarChart>
                                </ChartFrame>
                                <ChartFrame description="Live captures / calls per day" title="Capture success">
                                    <LineChart data={points} margin={CHART_MARGIN}>
                                        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                                        <XAxis axisLine={{ stroke: GRID_STROKE }} dataKey="day" minTickGap={16} tick={AXIS_TICK} tickFormatter={dayTick} tickLine={false} />
                                        <YAxis axisLine={false} domain={[0, 100]} tick={AXIS_TICK} tickFormatter={percentAxis} tickLine={false} width={48} />
                                        <Tooltip
                                            contentStyle={TOOLTIP_CONTENT_STYLE}
                                            cursor={LINE_CURSOR}
                                            formatter={value => (typeof value === "number" ? `${value.toFixed(1)}%` : "—")}
                                        />
                                        <Line
                                            connectNulls={false}
                                            dataKey="captureSuccessPct"
                                            dot={SERIES_DOT}
                                            isAnimationActive={false}
                                            name="Capture success"
                                            stroke="var(--series-1)"
                                            strokeWidth={2}
                                            type="monotone"
                                        />
                                    </LineChart>
                                </ChartFrame>
                            </div>
                            {vendorRows.length > 0
                                ? <EarningsDayTable points={points} rows={vendorRows} />
                                : <StatePanel>{`No measurements for ${vendorLabel(vendor)} in this window`}</StatePanel>}
                            {earnings.coverageDays.length > 0 && <CoverageTable rows={earnings.coverageDays} />}
                        </>
                    )}
        </div>
    );
}

/** The coverage chart's numbers (all vendors), newest day first. */
function CoverageTable({ rows }: { rows: EarningsCallsStatusResponse["coverageDays"] }) {
    const newestFirst = [...rows].sort((a, b) => b.day.localeCompare(a.day));

    return (
        <Table aria-label="Coverage per day">
            <TableHeader>
                <TableRow>
                    <TableHead>Day</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead className="text-right">Live</TableHead>
                    <TableHead className="text-right">Replay ≤ 24 h</TableHead>
                    <TableHead className="text-right">Not covered</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {newestFirst.map(row => (
                    <TableRow key={row.day}>
                        <TableCell className="tabular-nums">{row.day}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.total}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.coveredLive}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.coveredReplay24h}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.notCovered}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
