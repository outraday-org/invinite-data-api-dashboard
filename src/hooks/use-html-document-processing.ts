import * as React from "react";

import { useGetHtmlStorageContent } from "@/hooks/use-get-html-storage-content";

type UseHtmlDocumentProcessingParams = {
    /**
     * An element whose TABLE is shown (a computed value the filing does not state: the table of a value it does): the
     * table outlined, no cell marked.
     */
    anchorId?: null | string;
    /** An element id to mark (an inline-XBRL value's `html_tag_id`): a green ring drawn by box-shadow, no layout shift. */
    highlightId?: null | string;
    url: string;
};

/**
 * Invinite's brand green: the light `--brand` (#218635) of `src/styles.css`. A literal on purpose — it is written into
 * the framed document's `srcDoc`, where `var(--brand)` does not exist; change it with the token.
 */
export const HIGHLIGHT_GREEN = "oklch(0.545 0.149 146.3)";

/** The style marking `id`: an attribute selector with the id as a CSS string (any character is safe inside it). */
export function highlightStyle(id: string) {
    const quoted = JSON.stringify(id);

    return `[id=${quoted}]{box-shadow:0 0 0 2px ${HIGHLIGHT_GREEN},0 0 0 6px color-mix(in oklch, ${HIGHLIGHT_GREEN} 25%, transparent);border-radius:2px;scroll-margin:40vh}`;
}

/** The style outlining the table that holds `id` (`:has`, no layout shift). */
export function anchorTableStyle(id: string) {
    const quoted = JSON.stringify(id);

    return `table:has([id=${quoted}]){outline:2px solid ${HIGHLIGHT_GREEN};outline-offset:6px;border-radius:2px;scroll-margin-top:24px}`;
}

export const useHtmlDocumentProcessing = ({ anchorId = null, highlightId = null, url }: UseHtmlDocumentProcessingParams) => {
    const [srcDoc, setSrcDoc] = React.useState<null | string>(null);

    const [failed, setFailed] = React.useState<boolean>(false);

    const { isError, text: html } = useGetHtmlStorageContent(url);

    const baseHref = React.useMemo(() => {
        try {
            return new URL(url).toString();
        }
        catch {
            return url;
        }
    }, [url]);

    React.useEffect(() => {
        setFailed(false);

        setSrcDoc(null);

        if (!url) return;

        if (isError) {
            setFailed(true);

            return;
        }

        if (!html) return;

        try {
            const parser = new DOMParser();

            const doc = parser.parseFromString(html, "text/html");

            // Remove script tags
            doc.querySelectorAll("script").forEach(el => el.remove());

            // Remove inline event handlers (on*)
            doc.querySelectorAll("*").forEach((el) => {
                for (const attr of Array.from(el.attributes)) {
                    if (attr.name.toLowerCase().startsWith("on")) {
                        el.removeAttribute(attr.name);
                    }
                }
            });

            // Inject <base> for resolving relative URLs
            const base = doc.createElement("base");

            base.setAttribute("href", baseHref);

            doc.head.insertBefore(base, doc.head.firstChild);

            const marks = [highlightId ? highlightStyle(highlightId) : null, anchorId ? anchorTableStyle(anchorId) : null].filter(Boolean);

            if (marks.length > 0) {
                const style = doc.createElement("style");

                style.textContent = marks.join("");

                doc.head.append(style);
            }

            const finalHtml = doc.documentElement.outerHTML;

            setSrcDoc(finalHtml);
        }
        catch {
            setFailed(true);
        }
    }, [url, html, isError, baseHref, highlightId, anchorId]);

    return {
        baseHref,
        failed,
        srcDoc,
    };
};
