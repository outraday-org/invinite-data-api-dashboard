import type { Filing } from "@/lib/api/types";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import { FilingItem } from "./filing-item";
import { FilingsTableHeader } from "./filings-table-header";
import { LoadMoreButton } from "./load-more-button";

export function FilingsList({
    displayFilings,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    onFetchNextPage,
    onOpenHtml,
    onOpenSecDocuments,
    onSortToggle,
    sortDirection,
}: {
    displayFilings: Array<Filing>;
    isLoading: boolean;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    onFetchNextPage: () => void;
    onOpenHtml: (filing: Filing, url: string) => void;
    onOpenSecDocuments?: (filing: Filing) => void;
    sortDirection: "asc" | "desc";
    onSortToggle: () => void;
}) {
    return (
        <div className="flex flex-col h-0 grow">
            <FilingsTableHeader onSortToggle={onSortToggle} sortDirection={sortDirection} />
            <Separator />
            <ScrollArea className="h-0 grow">
                <div className="space-y-4 pt-4">
                    {displayFilings.map(filing => (
                        <FilingItem
                            filing={filing}
                            key={filing.accession_number}
                            onOpenHtml={url => onOpenHtml(filing, url)}
                            onOpenSecDocuments={onOpenSecDocuments ? () => onOpenSecDocuments(filing) : undefined}
                        />
                    ))}
                </div>

                <LoadMoreButton
                    hasNextPage={hasNextPage}
                    isFetchingNextPage={isFetchingNextPage}
                    onLoadMore={onFetchNextPage}
                />

                {!isLoading && displayFilings.length === 0 && (
                    <div className="text-muted-foreground w-full text-center text-xs p-2">No filings found.</div>
                )}

                {isLoading && displayFilings.length === 0 && (
                    <div className="text-muted-foreground w-full text-center text-xs p-2">Loading...</div>
                )}
            </ScrollArea>
        </div>
    );
}
