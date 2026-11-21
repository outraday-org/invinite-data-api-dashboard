import { ArrowDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";

/**
 * The one "Load more" of every cursor list: hidden on the last page; `loadedCount` adds "N loaded" beside it (lists
 * whose API has no total say how far they got).
 */
export function LoadMoreButton({
    hasNextPage,
    isFetchingNextPage,
    loadedCount,
    onLoadMore,
}: {
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    loadedCount?: number;
    onLoadMore: () => void;
}) {
    if (!hasNextPage) return null;

    return (
        <div className="flex items-center justify-center gap-3 pt-2">
            <Button
                disabled={isFetchingNextPage}
                onClick={onLoadMore}
                type="button"
                variant="outline"
            >
                <ArrowDown className="size-4" />
                {isFetchingNextPage
                    ? "Loading..."
                    : "Load more"}
            </Button>
            {loadedCount !== undefined && (
                <span className="text-muted-foreground tabular-nums">{`${formatNumber(loadedCount)} loaded`}</span>
            )}
        </div>
    );
}
