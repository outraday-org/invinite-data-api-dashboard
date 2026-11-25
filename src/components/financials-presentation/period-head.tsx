import { Badge } from "@/components/ui/badge";

/** The note of a preliminary period (`source.is_preliminary`, Data API 11.2): the badge's tooltip and its words. */
export const PRELIMINARY_TITLE = "Preliminary: figures from the earnings release (8-K) before the 10-Q / 10-K states them; the report's values replace them";

/**
 * A statement table's period header: the label, and a "Preliminary" badge on a period whose values come from the
 * earnings release before the quarterly or annual report.
 */
export function PeriodHeadLabel({ label, preliminary }: { label: string; preliminary?: boolean }) {
    if (!preliminary) return label;

    return (
        <span className="inline-flex items-center gap-1">
            {label}
            <Badge data-testid="preliminary-badge" title={PRELIMINARY_TITLE} variant="outline">Preliminary</Badge>
        </span>
    );
}
