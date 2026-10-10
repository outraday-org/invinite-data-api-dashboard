import { MonitorPlay } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Icon link to the company's webcast page (`webcast_url`, set only on an upcoming dated call). */
export function WebcastLink({ url }: { url: null | string }) {
    if (!url) return null;

    return (
        <Tooltip>
            <TooltipTrigger render={<a aria-label="Open the webcast page" href={url} rel="noopener noreferrer" target="_blank" />}>
                <MonitorPlay className="size-3.5 text-muted-foreground hover:text-foreground" />
            </TooltipTrigger>
            <TooltipContent>Webcast page</TooltipContent>
        </Tooltip>
    );
}
