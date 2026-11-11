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
 * history) or every reported KPI with its SEC filing link (`/v1/guidance?event=` | `/v1/kpis?event=`).
 */
export function GuidanceTab({ event, eventId }: CallTabProps) {
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
                            eventId={eventId}
                            // Only a normalized metric has a history (the table offers no click otherwise).
                            onMetricClick={item => item.metric_normalized && setHistory({
                                basis: item.basis,
                                metric: item.metric_normalized,
                                periodKind: item.period_kind,
                            })}
                        />
                    )
                : <KpiTable eventId={eventId} />}

            <GuidanceHistoryPanel company={event.symbol} onClose={() => setHistory(null)} target={history} />
        </div>
    );
}
