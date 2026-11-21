import { Copy, Download, FileText, GitCompare } from "lucide-react";
import * as React from "react";

import type { V2TranscriptVersion } from "@/lib/api/types";
import type { TranscriptFormat } from "@/lib/earnings/transcript";

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
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { saveJsonFile, savePublicFile, saveTextFile } from "@/lib/download";
import { formatInstant } from "@/lib/earnings/format";
import { versionKindText } from "@/lib/earnings/labels";

import { QaStart } from "../tabs/transcript-turns";

export const TRANSCRIPT_FORMATS: Array<{ label: string; value: TranscriptFormat }> = [
    { label: "Speakers", value: "speakers" },
    { label: "Sections", value: "sections" },
    { label: "Cleaned", value: "cleaned" },
    { label: "Plain text", value: "text" },
];

export function versionLabel(version: V2TranscriptVersion) {
    return [
        `Version ${version.version}`,
        versionKindText(version),
        formatInstant(version.published_at),
        version.change_note,
    ].filter(Boolean).join(" · ");
}

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

/**
 * The Transcript tab's toolbar, ONE row (task O3): format switch · version select · compare · `⤓ Download` · Copy;
 * under it one muted stats line (`final · 6,798 words · published … · Q&A starts at ▷ 20:54`). The PDF opens from the
 * Download menu in a dialog instead of a permanent row.
 */
export function TranscriptToolbar({
    canCopy,
    downloads,
    format,
    onCompare,
    onCopy,
    onFormatChange,
    onVersionChange,
    qaStartMs,
    shownVersion,
    versions,
}: {
    canCopy: boolean;
    downloads: TranscriptDownloads;
    format: TranscriptFormat;
    /** null = nothing to compare (one version). */
    onCompare: (() => void) | null;
    onCopy: () => void;
    onFormatChange: (format: TranscriptFormat) => void;
    onVersionChange: (version: number) => void;
    qaStartMs: null | number;
    shownVersion: null | number;
    /** Newest first. */
    versions: ReadonlyArray<V2TranscriptVersion>;
}) {
    const [pdfOpen, setPdfOpen] = React.useState(false);

    const shownEntry = versions.find(version => version.version === shownVersion);

    return (
        <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
                <Tabs onValueChange={value => onFormatChange(value as TranscriptFormat)} value={format}>
                    <TabsList>
                        {TRANSCRIPT_FORMATS.map(option => (
                            <TabsTrigger key={option.value} value={option.value}>
                                {option.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>

                {versions.length > 0 && (
                    <Select onValueChange={value => onVersionChange(Number(value))} value={shownVersion === null ? "" : String(shownVersion)}>
                        <SelectTrigger aria-label="Transcript version" className="max-w-64" size="sm">
                            <span className="truncate">{shownEntry ? versionLabel(shownEntry) : "Version"}</span>
                        </SelectTrigger>
                        <SelectContent>
                            {versions.map(version => (
                                <SelectItem key={version.version} value={String(version.version)}>
                                    {versionLabel(version)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}

                {onCompare && (
                    <Button onClick={onCompare} size="sm" type="button" variant="outline">
                        <GitCompare />
                        Compare
                    </Button>
                )}

                <div className="ml-auto flex items-center gap-1">
                    <DownloadMenu downloads={downloads} onViewPdf={() => setPdfOpen(true)} />
                    <Button disabled={!canCopy} onClick={onCopy} size="sm" type="button" variant="ghost">
                        <Copy />
                        Copy
                    </Button>
                </div>
            </div>

            {shownEntry && (
                <div className="text-muted-foreground flex flex-wrap items-baseline gap-x-1">
                    <span>{versionKindText(shownEntry)}</span>
                    <span>{`· ${shownEntry.word_count.toLocaleString("en-US")} words`}</span>
                    <span>{`· published ${formatInstant(shownEntry.published_at)}`}</span>
                    {qaStartMs !== null && (
                        <span className="inline-flex items-baseline gap-1">
                            ·
                            <QaStart qaStartMs={qaStartMs} />
                        </span>
                    )}
                </div>
            )}

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
