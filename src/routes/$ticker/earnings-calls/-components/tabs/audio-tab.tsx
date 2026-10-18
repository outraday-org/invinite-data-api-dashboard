import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { useCallAudio } from "../audio-context";
import { MediaState, Notice } from "../media-state";
import { FollowAlong } from "./follow-along";

/**
 * The Audio tab's own content: the request's state, then the follow view (`FollowAlong`: the
 * transcript lit word by word as the recording plays). The player itself (`AudioPlayer`) is
 * mounted by the page above the panel, so it keeps playing on other tabs.
 */
export function AudioTab() {
    const { audio, preparing, recording } = useCallAudio();

    if (audio.error) return <MediaState error={audio.error} title="Failed to load the recording" />;

    if (preparing) {
        return (
            <Notice badge="Preparing" title="The recording is being prepared for your account">
                <div className="flex flex-wrap items-center gap-2">
                    <span>
                        Every account gets its own watermarked copy; the first request prepares it (not billed). Checked again automatically every
                        {" "}
                        {Math.max(2, preparing.retry_after_seconds)}
                        {" "}
                        s.
                    </span>
                    <Button disabled={audio.isFetching} onClick={() => void audio.refetch()} size="xs" type="button" variant="outline">
                        Check now
                    </Button>
                </div>
            </Notice>
        );
    }

    if (!recording) return <Skeleton className="h-16 w-full" />;

    return (
        <div className="flex flex-col gap-3">
            <div className="text-muted-foreground text-xs">
                A signed link to the recording, valid until
                {" "}
                {new Date(recording.expires_at).toLocaleTimeString()}
                {" "}
                and renewed before it expires. Timestamps on every tab play the recording from that point; the mini-player above the other tabs controls it. The text below is the words transcript (one request per call).
            </div>
            <FollowAlong />
        </div>
    );
}
