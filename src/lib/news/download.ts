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
