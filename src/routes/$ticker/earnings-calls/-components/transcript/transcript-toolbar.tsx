import { Copy, Download, FileText } from "lucide-react";
import * as React from "react";

import type { V2TranscriptVersion } from "@/lib/api/types";

import { PdfInlineViewer } from "@/components/pdf/pdf-inline-viewer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { saveJsonFile, savePublicFile, saveTextFile } from "@/lib/download";
import { formatInstant } from "@/lib/earnings/format";
import { versionKindText } from "@/lib/earnings/labels";

import { QaStart } from "../tabs/transcript-turns";

/** What the Download menu saves; each entry is absent when there is nothing to save. */
export type TranscriptDownloads = {
    /** `<SYMBOL>-<period>-transcript-v<n>` (no extension). */
    baseName: string;
    /** The branded PDF of the shown version (`/transcript/versions`' `pdf`). */
    pdf: null | { url: string };
    /** The text on screen (`transcriptPlainText`); null while nothing is shown. */
    text: null | string;
    /** The API answer on screen, as JSON; null while unanswered. */
    json: unknown;
    /** The recording: `null` = the call has none; `download: null` = not loaded yet (the player loads it). */
    audio: null | { download: null | { filename: string; url: string } };
};

/** `⤓ Download`: PDF (view in a dialog or save), plain text, JSON of the shown answer, the recording. */
function DownloadMenu({ downloads, onViewPdf }: { downloads: TranscriptDownloads; onViewPdf: () => void }) {
    const { audio, baseName, json, pdf, text } = downloads;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger render={<Button size="sm" type="button" variant="outline" />}>
                <Download />
                Download
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
                <DropdownMenuGroup>
                    <DropdownMenuLabel>Transcript</DropdownMenuLabel>
                    {pdf && (
                        <>
                            <DropdownMenuItem onClick={onViewPdf}>
                                <FileText />
                                View PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void savePublicFile(pdf.url, `${baseName}.pdf`)}>PDF (.pdf)</DropdownMenuItem>
                        </>
                    )}
                    <DropdownMenuItem disabled={text === null} onClick={() => text !== null && saveTextFile(text, `${baseName}.txt`)}>
                        Plain text (.txt)
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={json === null || json === undefined} onClick={() => saveJsonFile(json, `${baseName}.json`)}>
                        JSON of this answer (.json)
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                {audio && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            <DropdownMenuLabel>Recording</DropdownMenuLabel>
                            <DropdownMenuItem
                                disabled={audio.download === null}
                                onClick={() => audio.download && void savePublicFile(audio.download.url, audio.download.filename)}
                            >
                                {audio.download ? "Audio" : "Audio (play the recording first)"}
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/** Download and copy actions with the current transcript's publication details and Q&A start. */
export function TranscriptToolbar({
    canCopy,
    downloads,
    onCopy,
    qaStartMs,
    shownEntry,
}: {
    canCopy: boolean;
    downloads: TranscriptDownloads;
    onCopy: () => void;
    qaStartMs: null | number;
    shownEntry: Pick<V2TranscriptVersion, "change_note" | "published_at" | "version_kind" | "word_count"> | undefined;
}) {
    const [pdfOpen, setPdfOpen] = React.useState(false);

    return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {(shownEntry || qaStartMs !== null) && (
                <div className="text-muted-foreground flex min-w-0 flex-1 basis-80 flex-wrap items-baseline gap-x-1 text-xs">
                    {shownEntry && (
                        <>
                            <span>{versionKindText(shownEntry)}</span>
                            <span>{`· ${shownEntry.word_count.toLocaleString("en-US")} words`}</span>
                            <span>{`· published ${formatInstant(shownEntry.published_at)}`}</span>
                            {shownEntry.change_note && <span>{`· ${shownEntry.change_note}`}</span>}
                        </>
                    )}
                    {qaStartMs !== null && (
                        <span className="inline-flex items-baseline gap-1">
                            {shownEntry && "·"}
                            <QaStart qaStartMs={qaStartMs} />
                        </span>
                    )}
                </div>
            )}

            <div className="ml-auto flex shrink-0 items-center gap-1">
                <DownloadMenu downloads={downloads} onViewPdf={() => setPdfOpen(true)} />
                <Button disabled={!canCopy} onClick={onCopy} size="sm" type="button" variant="ghost">
                    <Copy />
                    Copy
                </Button>
            </div>

            {downloads.pdf && (
                <Dialog onOpenChange={setPdfOpen} open={pdfOpen}>
                    <DialogContent className="sm:max-w-4xl">
                        <DialogHeader>
                            <DialogTitle>{`${downloads.baseName}.pdf`}</DialogTitle>
                        </DialogHeader>
                        {pdfOpen && <PdfInlineViewer filename={`${downloads.baseName}.pdf`} url={downloads.pdf.url} />}
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
