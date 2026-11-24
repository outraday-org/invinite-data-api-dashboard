import { Link } from "@tanstack/react-router";
import { BookOpenIcon } from "lucide-react";

import { ROW_ACTION_REVEAL_CLASS } from "@/lib/layout";
import { isCatalogMetricId } from "@/lib/reference/catalog";
import { cn } from "@/lib/utils";

/**
 * The catalog link of a financial metric label (O7 group 7): a small book icon beside the label that opens
 * `/catalog?q=<metric_id>` (the metric's definition, unit, statement and its mapping rules). It never opens the row's
 * chart (the click stays on the link). Nothing for an id that is no catalog metric (an as-reported concept). From `lg` it
 * waits for row hover / focus (`ROW_ACTION_REVEAL_CLASS`).
 */
export function MetricCatalogLink({ className, label, metricId }: { className?: string; label: string; metricId: null | string | undefined }) {
    if (!isCatalogMetricId(metricId)) return null;

    return (
        <Link
            aria-label={`${label} in the metric catalog`}
            className={cn("text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center transition-opacity", ROW_ACTION_REVEAL_CLASS, className)}
            onClick={event => event.stopPropagation()}
            search={{ q: metricId }}
            title="Open in the metric catalog"
            to="/catalog"
        >
            <BookOpenIcon className="size-3.5" />
        </Link>
    );
}
