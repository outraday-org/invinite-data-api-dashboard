import type { V2Event } from "@/lib/api/types";

import { formatFiscalPeriod } from "@/lib/earnings/format";

/** Saves bytes made in the browser under `filename` (an object URL clicked through a hidden anchor). */
export function saveBlob(blob: Blob, filename: string) {
    const objectUrl = URL.createObjectURL(blob);

    const anchor = document.createElement("a");

    anchor.href = objectUrl;

    anchor.download = filename;

    anchor.style.display = "none";

    document.body.append(anchor);

    anchor.click();

    anchor.remove();

    URL.revokeObjectURL(objectUrl);
}

/** Saves text as a UTF-8 file. */
export function saveTextFile(text: string, filename: string) {
    saveBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), filename);
}

/** Saves a value as indented JSON. */
export function saveJsonFile(value: unknown, filename: string) {
    saveBlob(new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: "application/json" }), filename);
}

/**
 * Saves a public `inline` file under `filename`: the `download` attribute is ignored across origins, so the bytes are
 * fetched first. Storage that sends no CORS header for this origin refuses the fetch; the file then opens in a new tab.
 */
export async function savePublicFile(url: string, filename: string) {
    let blob: Blob;

    try {
        const response = await fetch(url);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        blob = await response.blob();
    }
    catch {
        window.open(url, "_blank", "noopener");

        return;
    }

    saveBlob(blob, filename);
}

/** A call file's name without its extension: `AAPL-Q3-FY2026-<kind>` (`AAPL-<kind>` without a fiscal period). */
export function callFileStem(event: Pick<V2Event, "fiscal_quarter" | "fiscal_year" | "symbol">, kind: string) {
    const period = formatFiscalPeriod(event);

    return [event.symbol, period === "—" ? null : period.replaceAll(" ", "-"), kind].filter(Boolean).join("-");
}

/** A call file's name, e.g. `NVDA-Q3-FY2027-transcript-v3.txt`, `NVDA-Q3-FY2027-call.mp3`. */
export function callFileName(event: Pick<V2Event, "fiscal_quarter" | "fiscal_year" | "symbol">, kind: string, extension: string) {
    return `${callFileStem(event, kind)}.${extension}`;
}
