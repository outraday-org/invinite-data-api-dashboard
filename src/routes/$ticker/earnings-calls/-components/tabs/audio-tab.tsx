import { Skeleton } from "@/components/ui/skeleton";

import { useCallAudio } from "../audio-context";
import { MediaState } from "../media-state";

/**
 * The Audio tab's own content: the request's state. The player itself (`AudioPlayer`) is
 * mounted by the page above the panel, so it keeps playing on other tabs.
 */
export function AudioTab() {
    const { audio } = useCallAudio();

    if (audio.error) return <MediaState error={audio.error} title="Failed to load the recording" />;

    if (!audio.data) return <Skeleton className="h-16 w-full" />;

    return (
        <div className="text-muted-foreground text-xs">
            A signed link to the recording, valid until
            {" "}
            {new Date(audio.data.expires_at).toLocaleTimeString()}
            {" "}
            and renewed before it expires. Timestamps on every tab play the recording from that point; the mini-player above the other tabs controls it.
        </div>
    );
}
