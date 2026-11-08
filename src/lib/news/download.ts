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
