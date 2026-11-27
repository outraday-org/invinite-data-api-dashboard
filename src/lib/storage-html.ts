import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** The public storage hosts whose filed HTML the server may read for the browser (never any other host: no open proxy). */
const STORAGE_HOSTS = new Set(["storage-prod.invinite.com", "storage.invinite.com"]);

/** A filed document is a few MB; anything far above is not one. */
const MAX_HTML_BYTES = 40 * 1024 * 1024;

/** True for an https URL on a public storage host (`STORAGE_HOSTS`). */
export function isStorageUrl(url: string) {
    try {
        const parsed = new URL(url);

        return parsed.protocol === "https:" && STORAGE_HOSTS.has(parsed.hostname);
    }
    catch {
        return false;
    }
}

/**
 * A public storage HTML file read by the server: the fallback of `useGetHtmlStorageContent` where the storage sends no
 * CORS header for the page's origin (localhost), so the viewer can still mark a value instead of framing the bare URL.
 * Only `STORAGE_HOSTS`, only HTML, no key, no credentials.
 */
export const getStorageHtml = createServerFn({ method: "POST" })
    .inputValidator(z.object({ url: z.string().url().refine(isStorageUrl, "Not a storage URL") }))
    .handler(async ({ data }): Promise<{ text: string }> => {
        const response = await fetch(data.url, { redirect: "error" });

        if (!response.ok) throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);

        const type = response.headers.get("content-type") ?? "";

        if (!/^text\/html|^application\/xhtml\+xml/iu.test(type)) throw new Error("Not an HTML file");

        const text = await response.text();

        if (text.length > MAX_HTML_BYTES) throw new Error("File too large");

        return { text };
    });
