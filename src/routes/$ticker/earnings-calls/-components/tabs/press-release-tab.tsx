import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useEarningsPressRelease } from "@/lib/api/queries";
import { formatEnDateTime } from "@/lib/date";
import { edgarFolderUrl } from "@/lib/earnings/edgar";

import type { CallTabProps } from "../call-tabs";

import { MediaState, Notice } from "../media-state";

/** Paragraphs of a plain-text release: blank lines split paragraphs, single newlines stay. */
function paragraphs(text: string) {
    return text.split(/\n\s*\n/).map(part => part.trim()).filter(Boolean);
}

/** Press release tab: title, provenance (origin, trust tier, EDGAR folder), participants and the body text. */
export function PressReleaseTab({ event, selector }: CallTabProps) {
    const { data, error } = useEarningsPressRelease({ ...selector, include: "body" });

    const notFound = "No press release stored for this call";

    if (error) return <MediaState error={error} notFound={notFound} title="Failed to load the press release" />;

    if (!data) return <Skeleton className="h-40 w-full" />;

    const edgarUrl = edgarFolderUrl(event.cik, data.accession_number);

    const body = data.body_text ? paragraphs(data.body_text) : [];

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
                <div className="text-sm font-medium">{data.title ?? "Press release"}</div>
                <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                    {data.published_at && <span>{formatEnDateTime(data.published_at, { hideTime: false })}</span>}
                    <Badge variant="outline">{data.origin}</Badge>
                    {data.trust_tier && <Badge variant="secondary">{data.trust_tier}</Badge>}
                    {edgarUrl && (
                        <a className="underline underline-offset-4" href={edgarUrl} rel="noopener noreferrer" target="_blank">
                            EDGAR filing
                            {" "}
                            {data.accession_number}
                        </a>
                    )}
                    <a className="underline underline-offset-4" href={data.url} rel="noopener noreferrer" target="_blank">
                        Source
                    </a>
                </div>
            </div>

            {data.participants && data.participants.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {data.participants.map(participant => (
                        <Badge key={`${participant.name}:${participant.title ?? ""}`} variant="outline">
                            {[participant.name, participant.title, participant.role].filter(Boolean).join(" · ")}
                        </Badge>
                    ))}
                </div>
            )}

            {body.length === 0
                ? <Notice title="No body text stored for this release" />
                : (
                        <ScrollArea className="h-[65vh] rounded-md border">
                            <div className="flex flex-col gap-3 p-3 leading-relaxed">
                                {body.map((paragraph, index) => (
                                    // Paragraphs have no id; their order within one release is stable.
                                    <p className="whitespace-pre-wrap" key={index}>{paragraph}</p>
                                ))}
                            </div>
                        </ScrollArea>
                    )}
        </div>
    );
}
