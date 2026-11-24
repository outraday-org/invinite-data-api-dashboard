import type { ColumnDef } from "@tanstack/react-table";
import type * as React from "react";

import { ArrowDownIcon, ArrowUpIcon, ExternalLink } from "lucide-react";

import type { FilingListRow } from "@/lib/sec/parity";

import { Badge } from "@/components/ui/badge";
import { Copyable } from "@/components/ui/copy-button";
import { DASH, formatDay } from "@/lib/format";

/** "Q4 FY26" when the fiscal period is known, else null. */
export function fiscalPeriodLabel(period: { fiscalQuarter: null | number; fiscalYear: null | number }) {
    if (!period.fiscalQuarter || !period.fiscalYear) return null;

    return `Q${period.fiscalQuarter} FY${String(period.fiscalYear).slice(-2).padStart(2, "0")}`;
}

const linkClass = "text-primary inline-flex cursor-pointer items-center gap-1 hover:underline";

/**
 * The columns of the filings list (`DataTable`): form (+ "New" for a live row), accession, fiscal period (else the
 * period end), 8-K items, the files ("Details" = the filing page; "HTML" opens the primary document's public copy —
 * loaded only then, never prefetched per row; "Documents" the SEC document store's documents of the accession; "EDGAR"
 * the index page, an outbound link) and the filed day, whose header toggles the sort.
 */
export function filingColumns({
    onOpenHtml,
    onOpenSecDocuments,
    onSortToggle,
    renderDetailsLink,
    sortDirection,
}: {
    onOpenHtml: (filing: FilingListRow) => void;
    onOpenSecDocuments?: (filing: FilingListRow) => void;
    onSortToggle?: () => void;
    /** The filing page link (`/filings/$accession`; a router `Link`, so given by the page). */
    renderDetailsLink?: (filing: FilingListRow) => React.ReactNode;
    sortDirection?: "asc" | "desc";
}): Array<ColumnDef<FilingListRow>> {
    return [
        {
            cell: ({ row }) => (
                <span className="inline-flex items-center gap-1.5">
                    <span className="font-semibold">{row.original.formType}</span>
                    {row.original.live && <Badge title="Arrived over the live feed since this page opened" variant="secondary">New</Badge>}
                </span>
            ),
            header: "Form type",
            id: "form",
        },
        {
            cell: ({ row }) => <Copyable className="text-muted-foreground" label="Copy accession number" value={row.original.accessionNumber} />,
            header: "Accession number",
            id: "accession",
        },
        {
            cell: ({ row }) => <span className="text-muted-foreground">{fiscalPeriodLabel(row.original) ?? (row.original.periodEnd ? formatDay(row.original.periodEnd) : DASH)}</span>,
            header: "Fiscal period",
            id: "period",
        },
        {
            cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{row.original.items.join(", ") || DASH}</span>,
            header: "Items",
            id: "items",
        },
        {
            cell: ({ row }) => (
                <div className="flex items-center gap-x-3">
                    {renderDetailsLink?.(row.original)}
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
                    {row.original.edgarIndexUrl && (
                        // An outbound link to EDGAR; this app never fetches sec.gov.
                        <a className={linkClass} href={row.original.edgarIndexUrl} rel="noopener noreferrer" target="_blank" title="The filing's EDGAR index page">
                            EDGAR
                            <ExternalLink className="size-3" />
                        </a>
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
