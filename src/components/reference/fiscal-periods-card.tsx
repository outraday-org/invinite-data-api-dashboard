import type { ColumnDef } from "@tanstack/react-table";

import * as React from "react";

import type { CompanyFiscalPeriod } from "@/lib/api/types";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { ErrorState } from "@/components/ui/error-state";
import { Section } from "@/components/ui/section";
import { useCompanyFiscalPeriods } from "@/lib/api/queries";
import { formatDay } from "@/lib/format";

/**
 * The overview's "Fiscal periods" section (O7 group 7; a `Section` since ui-redesign task 8): a company's fiscal quarters with their calendar quarter and period
 * end (`GET /v1/fiscal-periods?company=`, every page, newest first — the same request that labels the filings list).
 */

/** Rows shown before "Show all". */
export const FISCAL_PERIODS_SHOWN = 8;

const COLUMNS: Array<ColumnDef<CompanyFiscalPeriod>> = [
    { cell: ({ row }) => `FY${row.original.fiscal_year} Q${row.original.fiscal_quarter}`, header: "Fiscal period", id: "fiscal" },
    { cell: ({ row }) => `${row.original.calendar_year} Q${row.original.calendar_quarter}`, header: "Calendar quarter", id: "calendar" },
    { cell: ({ row }) => formatDay(row.original.period_end), header: "Period end", id: "period_end" },
];

/** The newest fiscal Q4's period end: the end of the latest fiscal year (pure; null without a Q4). */
export function latestFiscalYearEnd(periods: ReadonlyArray<CompanyFiscalPeriod>) {
    return periods.filter(period => period.fiscal_quarter === 4).reduce<null | string>((latest, period) => (!latest || period.period_end > latest ? period.period_end : latest), null);
}

/** The section (pure): the newest periods, "Show all N", export of every period. */
export function FiscalPeriodsView({ error, isLoading, periods, ticker }: { error: unknown; isLoading: boolean; periods: ReadonlyArray<CompanyFiscalPeriod>; ticker: string }) {
    const [showAll, setShowAll] = React.useState(false);

    const sorted = React.useMemo(() => [...periods].sort((a, b) => b.period_end.localeCompare(a.period_end)), [periods]);

    const yearEnd = latestFiscalYearEnd(sorted);

    const rows = showAll ? sorted : sorted.slice(0, FISCAL_PERIODS_SHOWN);

    return (
        <Section
            description={yearEnd
                ? `The latest fiscal year ended ${formatDay(yearEnd)}. Each fiscal quarter with the calendar quarter it falls in.`
                : "Each fiscal quarter with the calendar quarter it falls in."}
            title="Fiscal periods"
        >
            <DataTable
                columns={COLUMNS}
                emptyText="No fiscal periods for this company."
                errorState={error ? <ErrorState error={error} title="Failed to load the fiscal periods" /> : null}
                exportConfig={{ dataset: "fiscal-periods", scope: ticker }}
                isLoading={isLoading}
                operationId="listFiscalPeriods"
                rows={rows}
                toolbarMeta={rows.length < sorted.length ? `newest of ${sorted.length}` : undefined}
            />
            {sorted.length > FISCAL_PERIODS_SHOWN && (
                <Button className="self-start" onClick={() => setShowAll(value => !value)} size="sm" variant="outline">
                    {showAll ? "Show the newest" : `Show all ${sorted.length}`}
                </Button>
            )}
        </Section>
    );
}

export function FiscalPeriodsCard({ ticker }: { ticker: string }) {
    const { data, error, isLoading } = useCompanyFiscalPeriods(ticker);

    return <FiscalPeriodsView error={error} isLoading={isLoading} periods={data ?? []} ticker={ticker} />;
}
