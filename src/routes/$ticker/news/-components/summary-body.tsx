import { paragraphs } from "@/lib/utils";

// @tailwindcss/typography for the summary (headings, paragraphs, lists).
const PROSE = "prose prose-sm prose-neutral dark:prose-invert max-w-none";

/**
 * Invinite's summary of the publication: the sanitized `summary_html` (`prepareSummaryHtml`) when there is one, else
 * `text` (`summary_text`) split into paragraphs.
 */
export function SummaryBody({ html, text }: { html: null | string; text: string }) {
    if (html === null) {
        return (
            <div className={PROSE} data-testid="news-summary">
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
            // Sanitized by DOMPurify with the summary's allow-list (prepareSummaryHtml).
            dangerouslySetInnerHTML={{ __html: html }}
            data-testid="news-summary"
        />
    );
}
