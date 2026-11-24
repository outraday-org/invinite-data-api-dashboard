import { ArrowDown, ArrowRight } from "lucide-react";
import * as React from "react";

import type { OperationId } from "@/lib/api/operations.gen";

import { Button } from "@/components/ui/button";
import { CreditHint } from "@/components/ui/credit-hint";
import { formatNumber } from "@/lib/format";

/**
 * The one "Load more" of every cursor list: hidden on the last page; `loadedCount` adds "N loaded" beside it (lists
 * whose API has no total say how far they got); `operationId` puts the page's cost in a tooltip (O6). `direction`
 * "right" = the next page adds columns (a statement's older periods): "Load older periods" with a right arrow.
 */
export function LoadMoreButton({
    direction = "down",
    hasNextPage,
    isFetchingNextPage,
    loadedCount,
    onLoadMore,
    operationId,
}: {
    direction?: "down" | "right";
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    loadedCount?: number;
    onLoadMore: () => void;
    operationId?: OperationId;
}) {
    if (!hasNextPage) return null;

    const button = <Button disabled={isFetchingNextPage} onClick={onLoadMore} type="button" variant="outline" />;

    const label = (
        <>
            {direction === "right" ? <ArrowRight className="size-4" /> : <ArrowDown className="size-4" />}
            {isFetchingNextPage ? "Loading..." : direction === "right" ? "Load older periods" : "Load more"}
        </>
    );

    return (
        <div className="flex items-center justify-center gap-3 pt-2">
            {operationId
                ? <CreditHint operationId={operationId} render={button}>{label}</CreditHint>
                : React.cloneElement(button, undefined, label)}
            {loadedCount !== undefined && (
                <span className="text-muted-foreground tabular-nums">{`${formatNumber(loadedCount)} loaded`}</span>
            )}
        </div>
    );
}
