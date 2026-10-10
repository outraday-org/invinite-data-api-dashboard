import * as React from "react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { CallTabProps } from "../call-tabs";
import type { GuidanceHistoryTarget } from "./guidance-history-panel";

import { GuidanceHistoryPanel } from "./guidance-history-panel";
import { GuidanceTable } from "./guidance-table";
import { KpiTable } from "./kpi-table";

type Kind = "guidance" | "kpi";

/**
 * Guidance & KPIs tab: forward guidance (consolidated items with citations and a per-metric
 * history) or every reported KPI with its SEC filing link (`kind=guidance | kpi`).
 */
export function GuidanceTab({ event, selector }: CallTabProps) {
    const [kind, setKind] = React.useState<Kind>("guidance");

    const [history, setHistory] = React.useState<GuidanceHistoryTarget | null>(null);

    return (
        <div className="flex flex-col gap-3">
            <Tabs onValueChange={value => setKind(value as Kind)} value={kind}>
                <TabsList>
                    <TabsTrigger value="guidance">Guidance</TabsTrigger>
                    <TabsTrigger value="kpi">KPIs</TabsTrigger>
                </TabsList>
            </Tabs>

            {kind === "guidance"
                ? (
                        <GuidanceTable
                            onMetricClick={item => setHistory({
                                basis: item.basis,
                                metric: item.metric_normalized,
                                periodKind: item.period_kind,
                            })}
                            selector={selector}
                        />
                    )
                : <KpiTable selector={selector} />}

            <GuidanceHistoryPanel identifier={event.symbol} onClose={() => setHistory(null)} target={history} />
        </div>
    );
}
