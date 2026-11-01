import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Previous / page number / Next, centred under the News table (owner 2026-11-01); hidden while there is one page. */
export function NewsPager({
    hasNext,
    isFetching,
    onNext,
    onPrevious,
    page,
}: {
    hasNext: boolean;
    isFetching: boolean;
    onNext: () => void;
    onPrevious: () => void;
    page: number;
}) {
    if (page === 1 && !hasNext) return null;

    return (
        <nav aria-label="News pages" className="flex shrink-0 items-center justify-center gap-2 pt-2" data-testid="news-pager">
            <Button disabled={page === 1} onClick={onPrevious} type="button" variant="outline">
                <ChevronLeft />
                Previous
            </Button>
            <span aria-live="polite" className="text-muted-foreground min-w-16 text-center text-xs tabular-nums">
                {`Page ${page}`}
            </span>
            <Button disabled={!hasNext || isFetching} onClick={onNext} type="button" variant="outline">
                Next
                <ChevronRight />
            </Button>
        </nav>
    );
}
