import { CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";

import type { ProductFamily } from "@/lib/api/types";
import type { ChartRow } from "@/lib/status/chart-data";

import { dayTickLabel, familyLabel, familySeriesStyle } from "@/lib/status/labels";

import {
    AXIS_TICK,
    CHART_MARGIN,
    ChartFrame,
    GRID_STROKE,
    legendText,
    LINE_CURSOR,
    TOOLTIP_CONTENT_STYLE,
} from "./chart-parts";

type FamilyLineChartProps = {
    description?: string;
    families: ReadonlyArray<ProductFamily>;
    formatValue: (value: number) => string;
    rows: Array<ChartRow>;
    title: string;
    todayUtc: null | string;
    yDomain?: ["auto" | "dataMin" | number, "auto" | "dataMax" | number];
};

/** One line per family over the days of the window; a missing day is a gap, never a zero. */
export function FamilyLineChart({ description, families, formatValue, rows, title, todayUtc, yDomain }: FamilyLineChartProps) {
    const tickLabel = (value: unknown) => dayTickLabel(String(value), todayUtc);

    return (
        <ChartFrame description={description} title={title}>
            <LineChart data={rows} margin={CHART_MARGIN}>
                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                <XAxis
                    axisLine={{ stroke: GRID_STROKE }}
                    dataKey="day"
                    minTickGap={16}
                    tick={AXIS_TICK}
                    tickFormatter={tickLabel}
                    tickLine={false}
                />
                <YAxis
                    axisLine={false}
                    domain={yDomain}
                    tick={AXIS_TICK}
                    tickFormatter={formatValue}
                    tickLine={false}
                    width={72}
                />
                <Tooltip
                    contentStyle={TOOLTIP_CONTENT_STYLE}
                    cursor={LINE_CURSOR}
                    formatter={value => (typeof value === "number" ? formatValue(value) : "—")}
                    labelFormatter={tickLabel}
                />
                {families.length >= 2 && <Legend formatter={legendText} iconType="plainline" />}
                {families.map((family) => {
                    const style = familySeriesStyle(family);

                    return (
                        <Line
                            connectNulls={false}
                            dataKey={family}
                            dot={{ fill: style.color, r: 2, strokeWidth: 0 }}
                            isAnimationActive={false}
                            key={family}
                            name={familyLabel(family)}
                            stroke={style.color}
                            strokeDasharray={style.dashed ? "5 4" : undefined}
                            strokeWidth={2}
                            type="monotone"
                        />
                    );
                })}
            </LineChart>
        </ChartFrame>
    );
}
