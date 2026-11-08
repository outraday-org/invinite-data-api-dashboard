import type { DOMPurify as Purifier } from "dompurify";

import createDOMPurify from "dompurify";

/**
 * The API's `summary_html` allow-list, applied again in the browser: the API renders the summary from its blocks with
 * escaped text only (`h2` headings, `p` paragraphs, `ul` / `li` lists; no links, images or attributes), and this page
 * does not trust that alone. `strong` / `em` are allowed for inline emphasis; every attribute is dropped.
 */
const ALLOWED_TAGS = ["h2", "p", "ul", "li", "strong", "em"];

let purifier: null | Purifier = null;

/** One DOMPurify instance of this page (no hooks, no shared global config); null without a DOM (SSR). */
function summaryPurifier() {
    if (purifier) return purifier;

    if (typeof window === "undefined") return null;

    const instance = createDOMPurify(window);

    if (!instance.isSupported) return null;

    purifier = instance;

    return instance;
}

/** `summary_html` sanitized for display; null without a DOM (SSR: the caller renders `summary_text`). */
export function prepareSummaryHtml(html: string): null | string {
    const instance = summaryPurifier();

    if (!instance) return null;

    return instance.sanitize(html, { ALLOW_ARIA_ATTR: false, ALLOW_DATA_ATTR: false, ALLOWED_ATTR: [], ALLOWED_TAGS });
}
