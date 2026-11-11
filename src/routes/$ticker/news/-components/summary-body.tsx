import type { V2NewsBlock } from "@/lib/api/types";

// @tailwindcss/typography for the summary (headings, paragraphs, lists).
const PROSE = "prose prose-sm prose-neutral dark:prose-invert max-w-none";

/** The items of a `list` block: one per line, its leading bullet dropped. */
export function listItems(text: string): Array<string> {
    return text
        .split("\n")
        .map(line => line.replace(/^\s*(?:[•\-*]|\d+[.)])\s*/u, "").trim())
        .filter(line => line.length > 0);
}

/**
 * Invinite's summary of the publication from its blocks (`GET /v1/news/{id}/text`, in order): a `heading` block as a
 * heading, a `list` block as a list (one item per line), anything else as a paragraph. Rendered as React elements —
 * no HTML is ever injected.
 */
export function SummaryBody({ blocks }: { blocks: ReadonlyArray<V2NewsBlock> }) {
    return (
        <div className={PROSE} data-testid="news-summary">
            {blocks.map((block) => {
                if (block.kind === "heading") return <h2 key={block.block_id}>{block.text}</h2>;

                if (block.kind === "list") {
                    return (
                        <ul key={block.block_id}>
                            {listItems(block.text).map((item, index) => (
                                // List lines have no id; their order within one block is stable.
                                <li key={index}>{item}</li>
                            ))}
                        </ul>
                    );
                }

                return <p className="whitespace-pre-line" key={block.block_id}>{block.text}</p>;
            })}
        </div>
    );
}
