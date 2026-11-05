import type { Filing } from "@/lib/api/types";

import { Separator } from "@/components/ui/separator";
import { formatEnDateTime } from "@/lib/date";

export function FilingItem({
    filing,
    onOpenHtml,
    onOpenSecDocuments,
}: {
    filing: Filing;
    onOpenHtml: (url: string) => void;
    /** Opens the SEC document store's documents of this accession (the source panel); the HTML link stays. */
    onOpenSecDocuments?: () => void;
}) {
    return (
        <>
            <div className="grid gap-x-6 gap-y-1 sm:grid-cols-5 sm:items-center">
                <div className="text-sm font-semibold">{filing.form_type}</div>

                <div className="text-muted-foreground text-xs min-w-0 truncate">
                    {filing.accession_number}
                </div>

                <div className="text-muted-foreground text-xs min-w-0 truncate">
                    {filing.fiscal_quarter && filing.fiscal_year
                        ? (
                                <>
                                    Q
                                    {filing.fiscal_quarter}
                                    {" "}
                                    FY
                                    {String(filing.fiscal_year).slice(-2).padStart(2, "0")}
                                </>
                            )
                        : (
                                "—"
                            )}
                </div>

                <div className="flex items-center justify-start gap-x-3 text-xs">
                    {filing.html_url
                        ? (
                                <button
                                    className="text-primary cursor-pointer hover:underline inline-flex w-12 justify-start leading-none"
                                    onClick={() => onOpenHtml(filing.html_url!)}
                                    type="button"
                                >
                                    HTML
                                </button>
                            )
                        : (
                                <span className="w-12" />
                            )}
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
                    {formatEnDateTime(filing.filing_date, { hideTime: true })}
                </div>
            </div>
            <Separator />
        </>
    );
}
