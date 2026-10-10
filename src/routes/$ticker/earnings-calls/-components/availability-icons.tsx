import type { LucideIcon } from "lucide-react";

import { AudioLines, FileText, FolderOpen, Newspaper, Presentation } from "lucide-react";

import type { EarningsEvent } from "@/lib/api/types";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type AvailabilityFlags = Pick<
    EarningsEvent,
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

/** One icon per material of a call; muted when the API's `has_*` flag is false. */
export function AvailabilityIcons({ event }: { event: AvailabilityFlags }) {
    return (
        <div className="flex items-center gap-1.5">
            {ITEMS.map(({ flag, icon: Icon, label }) => {
                const available = event[flag];

                return (
                    <Tooltip key={flag}>
                        <TooltipTrigger
                            aria-label={`${label}: ${available ? "available" : "not available"}`}
                            render={<span />}
                        >
                            <Icon
                                className={cn(
                                    "size-3.5",
                                    available ? "text-foreground" : "text-muted-foreground/40",
                                )}
                            />
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
