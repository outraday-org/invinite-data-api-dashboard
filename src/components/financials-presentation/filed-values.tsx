import type { ColumnDef } from "@tanstack/react-table";

import { Link } from "@tanstack/react-router";
import * as React from "react";

import type { FinancialVintagesTarget } from "@/lib/api/queries";
import type { V2AsReportedMemberFact, V2FinancialVintage, V2FinancialVintagesResponse } from "@/lib/api/types";

import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlanBadge } from "@/components/ui/credit-hint";
import { DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useFinancialVintages } from "@/lib/api/queries";
import { formatDay } from "@/lib/format";

import { fullNumber } from "./explain-parts";

/**
 * "Filed values" (Data API 11.2, `GET /v1/financials/vintages`): every filing that stated a value for one as-reported
 * concept and period, oldest first — the original and each later filing that repeated or restated it. The row whose
 * value the statements serve today is marked "Served"; a value that differs from the filing before it is "Restated".
 */

export function filedValuesTarget(company: null | string | undefined, concept: string, periodEnd: string | undefined, periodStart: null | string, dimensions?: V2AsReportedMemberFact["dimensions"]): FinancialVintagesTarget | null {
    if (!company || !periodEnd || (dimensions?.length ?? 0) > 1) return null;

    return { company, concept, ...(dimensions?.length ? { member: dimensions[0].member } : {}), periodEnd, periodStart };
}

export const filedValuesTitle = (member?: string) => member ? `Filed values for ${member} (all axes)` : "Filed values";

/** A vintage's period: "Jun 29, 2025 – Sep 27, 2025", or the instant ("Sep 27, 2025"). */
const periodText = (row: V2FinancialVintage) => (row.period_start ? `${formatDay(row.period_start)} – ${formatDay(row.period_end)}` : formatDay(row.period_end));

/** Whether a row restates the filing before it (a different value; the first row is the original). */
export function isRestatement(rows: ReadonlyArray<V2FinancialVintage>, index: number) {
    const previous = index > 0 ? rows[index - 1] : undefined;

    return previous !== undefined && previous.value !== null && rows[index].value !== null && previous.value !== rows[index].value;
}

function vintageColumns(rows: ReadonlyArray<V2FinancialVintage>, member?: string): Array<ColumnDef<V2FinancialVintage>> {
    return [
        { cell: ({ row }) => formatDay(row.original.filing_date), header: "Filed", id: "filing_date" },
        { cell: ({ row }) => row.original.form ?? "—", header: "Form", id: "form" },
        {
            cell: ({ row }) => (
                <Link className="font-mono text-xs underline-offset-4 hover:underline" params={{ accession: row.original.accession }} to="/filings/$accession">
                    {row.original.accession}
                </Link>
            ),
            header: "Filing",
            id: "accession",
        },
        { cell: ({ row }) => periodText(row.original), header: "Period", id: "period" },
        {
            cell: ({ row }) => (
                <div className="text-right tabular-nums">
                    {fullNumber(row.original.value)}
                    {row.original.unit ? <span className="text-muted-foreground">{` ${row.original.unit}`}</span> : null}
                </div>
            ),
            header: () => <div className="text-right">Value</div>,
            id: "value",
        },
        {
            cell: ({ row }) => (
                <span className="flex gap-1">
                    {row.original.is_current && <Badge title="The value the financial statements serve today" variant="secondary">Served</Badge>}
                    {!member && isRestatement(rows, row.index) && <Badge title="A different value than the filing before it" variant="outline">Restated</Badge>}
                </span>
            ),
            header: "",
            id: "flags",
        },
    ];
}

/** The filed values of one concept and period (pure): the request's state, the rows oldest first, a cut-off note. */
export function FiledValuesView({ data, error, isLoading, member }: { data: null | V2FinancialVintagesResponse; error: unknown; isLoading: boolean; member?: string }) {
    const rows = React.useMemo(() => data?.data ?? [], [data]);

    const columns = React.useMemo(() => vintageColumns(rows, member), [member, rows]);

    if (error) return <SecReadinessNotice error={error} operationId="listFinancialVintages" tierTitle="Your plan does not include filed values" title="Failed to load the filed values" />;

    return (
        <div className="flex flex-col gap-2" data-testid="filed-values">
            <DataTable
                columns={columns}
                emptyIsGenuine={Boolean(data)}
                emptyText={member ? "No filing stated a value for this concept, member and period." : "No filing stated a value for this concept and period."}
                isLoading={isLoading}
                operationId="listFinancialVintages"
                rows={rows}
            />
            {data?.has_more && <span className="text-muted-foreground text-xs">The first 200 filings are shown.</span>}
        </div>
    );
}

export type FiledValuesRequest = Pick<ReturnType<typeof useFinancialVintages>, "data" | "error" | "isLoading">;

/** The in-dialog entry point for the separately billed vintage history. */
export function FiledValuesPanel({ onShow, request, target }: { onShow: () => void; request: FiledValuesRequest | null; target: FinancialVintagesTarget }) {
    if (!request) {
        return (
            <div className="flex flex-wrap items-center gap-3">
                <span className="text-muted-foreground">{target.member ? "Every filing that stated this concept and member across all axes." : "Every filing that stated this value, and what each one said."}</span>
                <Button onClick={onShow} size="sm" type="button" variant="outline">Show filed values</Button>
                <PlanBadge operationId="listFinancialVintages" />
            </div>
        );
    }

    return <FiledValuesView data={request.data} error={request.error} isLoading={request.isLoading} member={target.member} />;
}

/** A clicked as-reported value's filed values: `title` names the line and the period. */
export type FiledValuesDialogTarget = FinancialVintagesTarget & { title: string };

/** The "Filed values" dialog of a summary as-reported value (the detailed view shows them in "Explain this number"). */
export function FiledValuesDialog({ onClose, open, target }: { onClose: () => void; open: boolean; target: FiledValuesDialogTarget | null }) {
    const { data, error, isLoading } = useFinancialVintages(target);

    return (
        <Dialog onOpenChange={next => !next && onClose()} open={open}>
            <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>{filedValuesTitle(target?.member)}</DialogTitle>
                    <DialogDescription className="[overflow-wrap:anywhere]">
                        {target ? `${target.title} · ${target.member ? "filings oldest first" : "every filing that stated it, oldest first"} (${target.concept})` : null}
                    </DialogDescription>
                </DialogHeader>
                {target && <FiledValuesView data={data} error={error} isLoading={isLoading} member={target.member} />}
            </DialogContent>
        </Dialog>
    );
}
