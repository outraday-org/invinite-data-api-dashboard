import { useQueryClient } from "@tanstack/react-query";
import { DownloadIcon } from "lucide-react";
import { toast } from "sonner";

import type { BulkDownload } from "@/lib/api/types";

import { Button } from "@/components/ui/button";
import { ApiRequestError } from "@/lib/api/errors";
import { useApiMutation } from "@/lib/api/mutations";
import { BULK_QUERY_KEYS } from "@/lib/api/queries";
import { saveSignedUrl } from "@/lib/download";
import { bulkRefusalText, takeDownloadUrl } from "@/lib/sec/bulk";

/** What a Download button fetches: a bulk file or a company export, by id. */
export type BulkDownloadTarget = { exportId: string; kind: "export" } | { fileId: string; kind: "file" };

/** Starts the file of a download answer: the URL leaves the answer first (`takeDownloadUrl`), then the anchor click. */
function saveAnswer(answer: BulkDownload) {
    const url = takeDownloadUrl(answer);

    if (url) saveSignedUrl(url, answer.filename);
    else toast.error("Download refused", { description: "The answer named no download link; try again." });
}

/**
 * The Download button of a bulk file or a ready export (sec-bulk-downloads task 8). The download operation runs ON
 * CLICK only (never on render, never prefetched; each call counts against the daily download cap) as a write with
 * `gcTime: 0`: its signed URL is taken out of the answer, handed to one hidden anchor click and reset at once, so it
 * is kept in no cache, URL, toast or request panel. "Preparing…" while pending; a refusal toasts once (a 429 names the
 * daily cap and its reset). A refused export download (409 not ready, 404 expired) refreshes the exports list and the
 * open export's detail.
 */
export function BulkDownloadButton({ filename, target }: { filename: null | string; target: BulkDownloadTarget }) {
    const queryClient = useQueryClient();

    const fileDownload = useApiMutation("getBulkFileDownload", { gcTime: 0, invalidates: [] });

    const exportDownload = useApiMutation("getBulkExportDownload", { gcTime: 0, invalidates: [] });

    const isPending = fileDownload.isPending || exportDownload.isPending;

    const onClick = async () => {
        try {
            if (target.kind === "file") saveAnswer(await fileDownload.mutateAsync({ fileId: target.fileId }));
            else saveAnswer(await exportDownload.mutateAsync({ exportId: target.exportId }));
        }
        catch (error) {
            toast.error("Download refused", { description: bulkRefusalText(error) });

            if (target.kind === "export" && error instanceof ApiRequestError && (error.status === 404 || error.status === 409)) {
                void queryClient.invalidateQueries({ queryKey: BULK_QUERY_KEYS.exports });

                void queryClient.invalidateQueries({ queryKey: BULK_QUERY_KEYS.export });
            }
        }
        finally {
            fileDownload.reset();

            exportDownload.reset();
        }
    };

    return (
        <Button
            aria-label={filename ? `Download ${filename}` : "Download"}
            disabled={isPending}
            onClick={() => void onClick()}
            size="sm"
            type="button"
            variant="outline"
        >
            <DownloadIcon />
            {isPending ? "Preparing…" : "Download"}
        </Button>
    );
}
