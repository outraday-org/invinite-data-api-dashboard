import * as React from "react";

import type { MatchSpan } from "@/lib/api/types";
import type { HighlightPart } from "@/lib/earnings/labels";

import { highlightSpans, highlightTerms } from "@/lib/earnings/labels";
import { coverageReasonText } from "@/lib/sec/readiness";

/**
 * Search pieces shared by the earnings search (`ask-this-call.tsx`), the document search and the SEC filing search
 * (backend delivery-integration task 5): exact span marking and the coverage note.
 */

function MarkedText({ parts }: { parts: Array<HighlightPart> }) {
    return (
        <p className="leading-relaxed">
            {parts.map((part, index) => (part.match
                // Parts have no id; their order within one text is stable.
                ? <mark className="bg-yellow-200/70 text-inherit dark:bg-yellow-500/30" key={index}>{part.text}</mark>
                : <React.Fragment key={index}>{part.text}</React.Fragment>))}
        </p>
    );
}

/**
 * Client-side guess: the query's terms marked, for a hit without spans (the answer attached after a matched question,
 * or a keyword hit whose words `ts_headline` could not locate).
 */
export function HighlightedText({ query, text }: { query: string; text: string }) {
    return <MarkedText parts={highlightTerms(text, query)} />;
}

/** The server's match spans marked exactly (code-point offsets into `text`). */
export function SpanHighlightedText({ spans, text }: { spans: ReadonlyArray<MatchSpan>; text: string }) {
    return <MarkedText parts={highlightSpans(text, spans)} />;
}

/** The coverage of a search answer: earnings (`SearchCoverage`) and SEC (`SecSearchCoverage`) share these fields. */
export type CoverageLike = { completeness: string; reasons: ReadonlyArray<string> };

/**
 * Why an answer may be incomplete (`coverage.completeness` partial / unknown), one line per reason (an unknown reason
 * reads "Results may be incomplete"); nothing for a complete one.
 */
export function SearchCoverageNote({ coverage }: { coverage: CoverageLike }) {
    if (coverage.completeness === "complete") return null;

    const lines = [...new Set(coverage.reasons.map(coverageReasonText))];

    return (
        <div className="text-muted-foreground flex flex-col text-xs" role="status">
            {(lines.length > 0 ? lines : ["Results may be incomplete"]).map(line => <span key={line}>{line}</span>)}
        </div>
    );
}
