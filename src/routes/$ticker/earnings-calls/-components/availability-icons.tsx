import type { LucideIcon } from "lucide-react";

import { AudioLines, FileText, FolderOpen, Newspaper, Presentation } from "lucide-react";

import type { V2Event } from "@/lib/api/types";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type AvailabilityFlags = Pick<
    V2Event,
    "has_audio" | "has_documents" | "has_press_release" | "has_slides" | "has_transcript"
>;

// "Not available" never says why (`has_audio: false` can be a company opt-out).
const ITEMS: Array<{ flag: keyof AvailabilityFlags; icon: LucideIcon; label: string }> = [
    { flag: "has_transcript", icon: FileText, label: "Transcript" },
    { flag: "has_audio", icon: AudioLines, label: "Audio" },
    { flag: "has_slides", icon: Presentation, label: "Slides" },
    { flag: "has_press_release", icon: Newspaper, label: "Press release" },
    { flag: "has_documents", icon: FolderOpen, label: "Documents" },
];

/**
 * One icon per material of a call; muted when the API's `has_*` flag is false. `labelled` (the call header) adds the
 * word beside each icon from 640 px; below it, and in the lists, the icon alone carries the name (label + tooltip).
 */
export function AvailabilityIcons({ event, labelled = false }: { event: AvailabilityFlags; labelled?: boolean }) {
    return (
        <div className={cn("flex items-center", labelled ? "flex-wrap gap-x-3 gap-y-1" : "gap-1.5")}>
            {ITEMS.map(({ flag, icon: Icon, label }) => {
                const available = event[flag];

                return (
                    <Tooltip key={flag}>
                        <TooltipTrigger
                            aria-label={`${label}: ${available ? "available" : "not available"}`}
                            render={<span className={cn(labelled && "inline-flex items-center gap-1", labelled && !available && "text-muted-foreground/60")} />}
                        >
                            <Icon
                                className={cn(
                                    "size-3.5",
                                    available ? "text-foreground" : "text-muted-foreground/40",
                                )}
                            />
                            {labelled && <span aria-hidden className="max-sm:hidden">{label}</span>}
                        </TooltipTrigger>
                        <TooltipContent>
                            {available ? `${label} available` : `${label}: not available`}
                        </TooltipContent>
                    </Tooltip>
                );
            })}
        </div>
    );
}
