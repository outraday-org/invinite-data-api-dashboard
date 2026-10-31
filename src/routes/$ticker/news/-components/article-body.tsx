import * as React from "react";

import type { ArticleHtml } from "@/lib/news/article-html";

import { paragraphs } from "@/lib/utils";

// @tailwindcss/typography for the article; tables scroll sideways in their wrapper (`ARTICLE_TABLE_WRAP`) with
// readable cell borders; images never wider than the panel; captions small and muted.
const PROSE = [
    "prose prose-sm prose-neutral dark:prose-invert max-w-none",
    "prose-img:my-2 prose-img:h-auto prose-img:max-w-full prose-img:rounded",
    "prose-figcaption:text-xs prose-figcaption:text-muted-foreground",
    "prose-a:underline-offset-4",
    "[&_.article-table]:my-4 [&_.article-table]:overflow-x-auto [&_table]:my-0",
    "[&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:bg-muted/50 [&_th]:px-2 [&_th]:py-1",
].join(" ");

/**
 * The article: the sanitized `body_html` (`prepareArticleHtml`) when the item has one, else `text` split into
 * paragraphs. An image that fails to load (an expired view URL) calls `onImageError`: the event does not bubble, so it
 * is caught on the container in the capture phase.
 */
export function ArticleBody({ article, onImageError, text }: { article: ArticleHtml | null; onImageError?: () => void; text: string }) {
    const container = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const node = container.current;

        if (!node || !onImageError) return;

        const onError = (event: Event) => {
            if (event.target instanceof HTMLImageElement) onImageError();
        };

        node.addEventListener("error", onError, true);

        return () => node.removeEventListener("error", onError, true);
    }, [article, onImageError]);

    if (!article) {
        return (
            <div className={PROSE} data-testid="news-body">
                {paragraphs(text).map((paragraph, index) => (
                    // Paragraphs have no id; their order within one text is stable.
                    <p className="whitespace-pre-line" key={index}>{paragraph}</p>
                ))}
            </div>
        );
    }

    return (
        <article
            className={PROSE}
            // Sanitized by DOMPurify with the API's allow-list (prepareArticleHtml).
            dangerouslySetInnerHTML={{ __html: article.html }}
            data-testid="news-body"
            ref={container}
        />
    );
}
