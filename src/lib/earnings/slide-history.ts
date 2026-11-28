import type { V2Event, V2Slide } from "@/lib/api/types";

type HistoryEvent = Pick<V2Event, "event_id" | "event_type" | "fiscal_quarter" | "fiscal_year" | "has_slides" | "scheduled_at">;

/** Exact correspondence preserves accounting and fiscal qualifiers. */
export function slideTitleKey(title: null | string) {
    const key = title?.normalize("NFKC").trim().toLocaleLowerCase("en-US").replace(/\s+/gu, " ") ?? "";

    return /^(?:untitled|cover|title|title slide|agenda|disclaimer|disclaimers|thank you|questions|q&a)$/u.test(key) ? "" : key;
}

export type SlideMatch = { reason: "conflict" | "insufficient" | "non_unique"; slide: null } | { reason: "match"; slide: V2Slide };

const cleanHeadline = (text: string) => text.replace(/\*\*|[_`]/gu, "").trim();

/** PDF markdown can contain literal code examples; their syntax proves no page heading. */
function headlineLines(markdown: string) {
    let fence = "";

    const lines: Array<string> = [];

    for (const raw of markdown.split(/\r?\n/u)) {
        const marker = /^\s*(`{3,}|~{3,})/u.exec(raw);

        if (marker) {
            if (!fence) fence = marker[1];
            else if (marker[1][0] === fence[0] && marker[1].length >= fence.length && raw.trim() === marker[1]) fence = "";

            continue;
        }

        if (fence || /^(?: {4}|\t)/u.test(raw)) continue;

        if (raw.trim()) lines.push(raw.trim());
    }

    return lines;
}

/** Conservative evidence subset: a unique strongest heading, or a concise leading title.
 * Body keywords never establish subject identity. Unlike the ingestion parser, this guard
 * accepts the standalone heading as evidence even when a plain subtitle follows it.
 */
export function slideHeadlineEvidence(slide: V2Slide): "conflict" | "insufficient" | "verified" {
    if (!slide.markdown?.trim()) return "insufficient";

    const lines = headlineLines(slide.markdown);

    const usable = (line: string) => line.length <= 200
        && /\p{L}/u.test(line)
        && !/^(?:\[…\]|\[\.\.\.\]|copyright|©|all rights reserved|\||[-*•]\s)/iu.test(line)
        && !/(?:https?:\/\/|www\.|\.com\b)/iu.test(line)
        && !/^[\d$€£]/u.test(line.replace(/^(?:Q\d|\dQ\d)/u, "Period"));

    const headings = lines.flatMap((line, index) => {
        const match = /^(#{1,6})\s+(.+)$/u.exec(line);

        const text = match ? cleanHeadline(match[2]) : "";

        return match && usable(text) ? [{ index, level: match[1].length, text }] : [];
    });

    const priority = Math.min(...headings.map(heading => heading.level));

    if (headings.length === 0 && lines.some(line => /^#{1,6}\s/u.test(line))) return "insufficient";

    const strongest = headings.filter(heading => heading.level === priority);

    if (new Set(strongest.map(heading => slideTitleKey(heading.text))).size > 1) return "conflict";

    const first = strongest[0] ?? { index: 0, text: cleanHeadline(lines[0] ?? "") };

    if (!usable(first.text) || /[.!?:]$/u.test(first.text) || first.text.split(/\s/u).length > 12) return "insufficient";

    const next = lines.at(first.index + 1);

    const roleLine = cleanHeadline(next ?? "");

    if (/^(?:[A-Z][a-z]+\s){1,3}[A-Z][a-z]+$/u.test(first.text)
        && /^(?:chief|ceo|cfo|president|vice president|investor relations)\b/iu.test(roleLine)
        && !/[.!?]$/u.test(roleLine)) return "insufficient";

    const key = slideTitleKey(slide.title);

    const plainContinuation = next && !/^[#*$€£|\d]/u.test(next) && usable(next)
        && next.length <= 120 && first.text.length <= 80;

    if (key && slideTitleKey(first.text) === key) {
        // Two concise unstyled lines give no layout proof which is the headline.
        if (headings.length === 0 && !lines[0].startsWith("**") && plainContinuation && !/[.!?]$/u.test(next)) return "insufficient";

        return "verified";
    }

    // Legacy multi-line titles may include a short ordinary subtitle. Never append a table,
    // numeric forecast or a different styled heading to manufacture agreement.
    if (strongest.length <= 1 && plainContinuation
        && slideTitleKey(`${first.text} ${cleanHeadline(next)}`) === key) return "verified";

    return "conflict";
}

/** Whole-deck uniqueness precedes evidence checks on BOTH pages. No fuzzy/position matching. */
export function historicalSlideMatch(current: V2Slide, currentSlides: ReadonlyArray<V2Slide>, historicalSlides: ReadonlyArray<V2Slide>): SlideMatch {
    const key = slideTitleKey(current.title);

    if (!key || currentSlides.filter(slide => slideTitleKey(slide.title) === key).length !== 1) return { reason: "non_unique", slide: null };

    const matches = historicalSlides.filter(slide => slideTitleKey(slide.title) === key);

    if (matches.length !== 1) return { reason: "non_unique", slide: null };

    const evidence = [slideHeadlineEvidence(current), slideHeadlineEvidence(matches[0])];

    if (evidence.includes("conflict")) return { reason: "conflict", slide: null };

    if (evidence.includes("insufficient")) return { reason: "insufficient", slide: null };

    return { reason: "match", slide: matches[0] };
}

export function matchingHistoricalSlide(current: V2Slide, currentSlides: ReadonlyArray<V2Slide>, historicalSlides: ReadonlyArray<V2Slide>): null | V2Slide {
    return historicalSlideMatch(current, currentSlides, historicalSlides).slide;
}

/** One deck per earlier year, newest first; earnings comparisons keep the fiscal quarter. */
export function historicalSlideEvents<T extends HistoryEvent>(current: HistoryEvent, candidates: ReadonlyArray<T>, limit = 4) {
    const currentYear = current.fiscal_year ?? Number(current.scheduled_at.slice(0, 4));

    const seenYears = new Set<number>();

    return candidates
        .filter(candidate => candidate.event_id !== current.event_id
            && candidate.has_slides
            && candidate.event_type === current.event_type
            && candidate.scheduled_at < current.scheduled_at
            && (current.event_type !== "earnings_call" || current.fiscal_quarter === null || candidate.fiscal_quarter === current.fiscal_quarter))
        .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at))
        .filter((candidate) => {
            const year = candidate.fiscal_year ?? Number(candidate.scheduled_at.slice(0, 4));

            if (!Number.isFinite(year) || year >= currentYear || seenYears.has(year) || seenYears.size >= limit) return false;

            seenYears.add(year);

            return true;
        });
}
