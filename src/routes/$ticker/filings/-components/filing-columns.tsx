import type { ColumnDef } from "@tanstack/react-table";

import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";

import type { FilingListRow } from "@/lib/sec/parity";

import { Copyable } from "@/components/ui/copy-button";
import { DASH, formatDay } from "@/lib/format";

/** "Q4 FY26" when the fiscal period is known, else null. */
export function fiscalPeriodLabel(period: { fiscalQuarter: null | number; fiscalYear: null | number }) {
    if (!period.fiscalQuarter || !period.fiscalYear) return null;

    return `Q${period.fiscalQuarter} FY${String(period.fiscalYear).slice(-2).padStart(2, "0")}`;
}

/**
 * The columns of the filings list (`DataTable`): form, accession, fiscal period (else the period end), the files
 * ("HTML" opens the primary document's public copy — loaded only then, never prefetched per row; "Documents" the SEC
 * document store's documents of the accession) and the filed day, whose header toggles the sort.
 */
export function filingColumns({
    onOpenHtml,
    onOpenSecDocuments,
    onSortToggle,
    sortDirection,
}: {
    onOpenHtml: (filing: FilingListRow) => void;
    onOpenSecDocuments?: (filing: FilingListRow) => void;
    onSortToggle?: () => void;
    sortDirection?: "asc" | "desc";
}): Array<ColumnDef<FilingListRow>> {
    return [
        { cell: ({ row }) => <span className="font-semibold">{row.original.formType}</span>, header: "Form Type", id: "form" },
        {
            cell: ({ row }) => <Copyable className="text-muted-foreground" label="Copy accession number" value={row.original.accessionNumber} />,
            header: "Accession Number",
            id: "accession",
        },
        {
            cell: ({ row }) => <span className="text-muted-foreground">{fiscalPeriodLabel(row.original) ?? row.original.periodEnd ?? DASH}</span>,
            header: "Fiscal Period",
            id: "period",
        },
        {
            cell: ({ row }) => (
                <div className="flex items-center gap-x-3">
                    <button className="text-primary cursor-pointer hover:underline" onClick={() => onOpenHtml(row.original)} type="button">
                        HTML
                    </button>
                    {onOpenSecDocuments && (
                        <button
                            className="text-primary cursor-pointer hover:underline"
                            onClick={() => onOpenSecDocuments(row.original)}
                            title="Documents of this filing in the SEC document store"
                            type="button"
                        >
                            Documents
                        </button>
                    )}
                </div>
            ),
            header: "Files",
            id: "files",
        },
        {
            cell: ({ row }) => <div className="text-muted-foreground text-right tabular-nums">{formatDay(row.original.filingDate)}</div>,
            header: () => (onSortToggle
                ? (
                        <button
                            className="hover:text-foreground inline-flex w-full cursor-pointer items-center justify-end gap-1 transition-colors"
                            onClick={onSortToggle}
                            title={sortDirection === "desc" ? "Sort ascending" : "Sort descending"}
                            type="button"
                        >
                            <span>Filed</span>
                            {sortDirection === "desc" ? <ArrowDownIcon className="size-4" /> : <ArrowUpIcon className="size-4" />}
                        </button>
                    )
                : <div className="text-right">Filed</div>),
            id: "filed",
        },
    ];
}
