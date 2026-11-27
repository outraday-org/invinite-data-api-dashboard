import { ChartLineIcon } from "lucide-react";
import * as React from "react";
import {
    Bar,
    BarChart,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SegmentedButtons } from "@/components/ui/segmented-buttons";
import { ROW_ACTION_REVEAL_CLASS } from "@/lib/layout";
import { cn, formatNumberEnCompact } from "@/lib/utils";

export type MetricChartDataPoint = {
    period: string;
    value: null | number | undefined;
};

type MetricChartDialogProps = {
    /** The points in the table's column order (newest period first); the chart reads oldest → newest. */
    data: Array<MetricChartDataPoint>;
    formatValue?: (value: number) => string;
    metricLabel: string;
    onOpenChange: (open: boolean) => void;
    open: boolean;
};

type ChartType = "bar" | "line";

const CHART_TYPE_OPTIONS: Array<{ label: string; value: ChartType }> = [
    { label: "Bar", value: "bar" },
    { label: "Line", value: "line" },
];

const formatDefaultValue = (value: number) => formatNumberEnCompact(value);

/**
 * The chart button of a metric row (the row stays clickable too): a real button, so the keyboard reaches it; from `lg`
 * it waits for row hover / focus (`ROW_ACTION_REVEAL_CLASS`), always shown on touch. It stops the click from also
 * reaching the row.
 */
export function ChartRowButton({ label, onOpen }: { label: string; onOpen: () => void }) {
    return (
        <button
            aria-label={`Chart ${label}`}
            className={cn("text-muted-foreground hover:text-foreground inline-flex size-6 shrink-0 items-center justify-center rounded transition-opacity", ROW_ACTION_REVEAL_CLASS)}
            onClick={(event) => {
                event.stopPropagation();

                onOpen();
            }}
            title={`Chart ${label}`}
            type="button"
        >
            <ChartLineIcon className="size-3.5" />
        </button>
    );
}

export function MetricChartDialog({
    data,
    formatValue,
    metricLabel,
    onOpenChange,
    open,
}: MetricChartDialogProps) {
    const [chartType, setChartType] = React.useState<ChartType>("bar");

    React.useEffect(() => {
        if (open) {
            setChartType("bar");
        }
    }, [metricLabel, open]);

    // Oldest → newest (the tables list the newest period first).
    const chartData = React.useMemo(
        () => [...data].reverse().map(point => ({
            period: point.period,
            value: point.value ?? null,
        })),
        [data],
    );

    const hasValues = React.useMemo(
        () => chartData.some(point => typeof point.value === "number"),
        [chartData],
    );

    const formatAxisValue = React.useCallback(
        (value: number) => (formatValue ? formatValue(value) : formatDefaultValue(value)),
        [formatValue],
    );

    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent className="sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>{metricLabel}</DialogTitle>
                </DialogHeader>
                <SegmentedButtons
                    aria-label="Chart type"
                    onChange={setChartType}
                    options={CHART_TYPE_OPTIONS}
                    value={chartType}
                />
                <div className="h-[320px] w-full sm:h-[360px]">
                    {hasValues
                        ? (
                                <ResponsiveContainer height="100%" width="100%">
                                    {chartType === "bar"
                                        ? (
                                                <BarChart data={chartData} margin={{ bottom: 0, left: 4, right: 20, top: 16 }}>
                                                    <XAxis
                                                        dataKey="period"
                                                        tick={{ fill: "var(--muted-foreground)" }}
                                                        tickLine={false}
                                                    />
                                                    <YAxis
                                                        tick={{ fill: "var(--muted-foreground)" }}
                                                        tickFormatter={formatAxisValue}
                                                        width={60}
                                                    />
                                                    <Tooltip
                                                        cursor={{ fill: "var(--muted)" }}
                                                        formatter={value =>
                                                            typeof value === "number"
                                                                ? formatAxisValue(value)
                                                                : value}
                                                    />
                                                    <Bar
                                                        dataKey="value"
                                                        fill="var(--color-chart-1)"
                                                        name={metricLabel}
                                                        radius={[4, 4, 0, 0]}
                                                    />
                                                </BarChart>
                                            )
                                        : (
                                                <LineChart data={chartData} margin={{ bottom: 20, left: 12, right: 20, top: 12 }}>
                                                    <XAxis
                                                        dataKey="period"
                                                        tick={{ fill: "var(--muted-foreground)" }}
                                                        tickLine={false}
                                                    />
                                                    <YAxis
                                                        tick={{ fill: "var(--muted-foreground)" }}
                                                        tickFormatter={formatAxisValue}
                                                        width={60}
                                                    />
                                                    <Tooltip
                                                        cursor={{ stroke: "var(--muted-foreground)" }}
                                                        formatter={value =>
                                                            typeof value === "number"
                                                                ? formatAxisValue(value)
                                                                : value}
                                                    />
                                                    <Line
                                                        connectNulls
                                                        dataKey="value"
                                                        dot={false}
                                                        name={metricLabel}
                                                        stroke="var(--color-chart-1)"
                                                        strokeWidth={2}
                                                        type="monotone"
                                                    />
                                                </LineChart>
                                            )}
                                </ResponsiveContainer>
                            )
                        : (
                                <div className={cn(
                                    "text-muted-foreground text-sm flex h-full items-center justify-center",
                                )}
                                >
                                    No chart data available.
                                </div>
                            )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
