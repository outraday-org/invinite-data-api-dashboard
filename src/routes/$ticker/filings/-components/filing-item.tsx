import type { FilingListRow } from "@/lib/sec/parity";

import { Separator } from "@/components/ui/separator";
import { formatEnDateTime } from "@/lib/date";

/** "Q4 FY26" when the fiscal period is known, else null. */
export function fiscalPeriodLabel(period: { fiscalQuarter: null | number; fiscalYear: null | number }) {
    if (!period.fiscalQuarter || !period.fiscalYear) return null;

    return `Q${period.fiscalQuarter} FY${String(period.fiscalYear).slice(-2).padStart(2, "0")}`;
}

export function FilingItem({
    filing,
    onOpenHtml,
    onOpenSecDocuments,
}: {
    filing: FilingListRow;
    /** Opens the HTML view; the primary document's public URL is loaded then (never prefetched per row). */
    onOpenHtml: () => void;
    /** Opens the SEC document store's documents of this accession (the source panel); the HTML link stays. */
    onOpenSecDocuments?: () => void;
}) {
    return (
        <>
            <div className="grid gap-x-6 gap-y-1 sm:grid-cols-5 sm:items-center">
                <div className="text-sm font-semibold">{filing.formType}</div>

                <div className="text-muted-foreground text-xs min-w-0 truncate">
                    {filing.accessionNumber}
                </div>

                <div className="text-muted-foreground text-xs min-w-0 truncate">
                    {fiscalPeriodLabel(filing) ?? filing.periodEnd ?? "—"}
                </div>

                <div className="flex items-center justify-start gap-x-3 text-xs">
                    <button
                        className="text-primary cursor-pointer hover:underline inline-flex w-12 justify-start leading-none"
                        onClick={onOpenHtml}
                        type="button"
                    >
                        HTML
                    </button>
                    {onOpenSecDocuments && (
                        <button
                            className="text-primary cursor-pointer hover:underline inline-flex justify-start leading-none"
                            onClick={onOpenSecDocuments}
                            title="Documents of this filing in the SEC document store"
                            type="button"
                        >
                            Documents
                        </button>
                    )}
                </div>

                <div className="text-muted-foreground text-xs sm:text-right pr-2">
                    {formatEnDateTime(filing.filingDate, { hideTime: true })}
                </div>
            </div>
            <Separator />
        </>
    );
}
