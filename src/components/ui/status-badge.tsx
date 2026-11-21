import type { StatusTone } from "@/lib/alerts/labels";

import { Badge } from "./badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

/**
 * THE status badge with its meaning in a tooltip (alerts, destinations, deliveries): the badge reads `label` in `tone`,
 * the trigger's accessible name is "`prefix` `label`" plus ": `reason`" when one is given, the tooltip says `tooltip`.
 * Each caller decides its words (an alert appends the disabled reason to the status meaning; a destination shows the
 * reason INSTEAD of its meaning).
 */
export function StatusBadge({
    label,
    prefix = "Status",
    reason,
    tone,
    tooltip,
}: {
    label: string;
    prefix?: string;
    reason?: null | string;
    tone: StatusTone;
    tooltip: string;
}) {
    return (
        <Tooltip>
            <TooltipTrigger aria-label={`${prefix} ${label}${reason ? `: ${reason}` : ""}`} render={<span />}>
                <Badge variant={tone}>{label}</Badge>
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
    );
}
