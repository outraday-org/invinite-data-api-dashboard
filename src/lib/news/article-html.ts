import type { DOMPurify as Purifier } from "dompurify";

import createDOMPurify from "dompurify";

/**
 * The API's `body_html` allow-list (backend earnings tasks/inhouse-news-article-layout-2026-10-31 task 1), applied again
 * in the browser: the API sanitizes, this page does not trust that alone.
 */
const ALLOWED_TAGS = [
    "h2", "h3", "h4", "p", "ul", "ol", "li", "table", "thead", "tbody", "tr", "th", "td", "blockquote",
    "strong", "em", "b", "i", "sup", "sub", "br", "a", "figure", "figcaption", "img",
];

const ALLOWED_ATTR = ["href", "rel", "src", "alt", "width", "height", "loading", "colspan", "rowspan", "data-asset-id"];

const HTTPS = /^https:\/\//i;

// The class of the wrapper that lets a wide table scroll sideways (styled in article-body.tsx).
export const ARTICLE_TABLE_WRAP = "article-table";

let purifier: null | Purifier = null;

/** One DOMPurify instance with this page's hooks (the default instance's hooks are global); null without a DOM (SSR). */
function articlePurifier() {
    if (purifier) return purifier;

    if (typeof window === "undefined") return null;

    const instance = createDOMPurify(window);

    if (!instance.isSupported) return null;

    instance.addHook("afterSanitizeAttributes", (node) => {
        if (node.tagName === "IMG") {
            // Only the API's https view URLs are loaded; anything else is no image.
            if (!HTTPS.test(node.getAttribute("src") ?? "")) node.remove();
            else node.setAttribute("referrerpolicy", "no-referrer");
        }

        if (node.tagName === "A") {
            if (HTTPS.test(node.getAttribute("href") ?? "")) {
                node.setAttribute("target", "_blank");

                node.setAttribute("rel", "noopener noreferrer");
            }
            else {
                node.removeAttribute("href");
            }
        }
    });

    purifier = instance;

    return instance;
}

export type ArticleHtml = {
    html: string;
    /** Every `data-asset-id` the article shows: inline images and the "Image at source" links of link-only ones. */
    inlineAssetIds: ReadonlySet<string>;
};

/** `body_html` sanitized for display, each table in a sideways-scrolling wrapper; null without a DOM (SSR). */
export function prepareArticleHtml(html: string): ArticleHtml | null {
    const instance = articlePurifier();

    if (!instance) return null;

    // RETURN_DOM answers the <body> holding the sanitized nodes (typed as a plain Node).
    const body = instance.sanitize(html, { ALLOW_DATA_ATTR: false, ALLOWED_ATTR, ALLOWED_TAGS, RETURN_DOM: true }) as HTMLElement;

    for (const table of body.querySelectorAll("table")) {
        const wrap = window.document.createElement("div");

        wrap.className = ARTICLE_TABLE_WRAP;

        table.replaceWith(wrap);

        wrap.append(table);
    }

    const inlineAssetIds = new Set<string>();

    for (const node of body.querySelectorAll("[data-asset-id]")) {
        const id = node.getAttribute("data-asset-id");

        if (id) inlineAssetIds.add(id);
    }

    return { html: body.innerHTML, inlineAssetIds };
}
