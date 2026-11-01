/**
 * Starts the browser's download of a news file at once (the "Download" buttons of the item panel): the API's ≤ 60-s
 * URL is an `attachment` (`purpose: "download"`), so following it saves the file and the page stays. A detached anchor
 * is clicked and removed: the URL, a bearer credential, is never rendered, cached or stored.
 */
export function startDownload(url: string) {
    const anchor = document.createElement("a");

    anchor.href = url;

    anchor.rel = "noopener noreferrer";

    anchor.style.display = "none";

    document.body.append(anchor);

    anchor.click();

    anchor.remove();
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
