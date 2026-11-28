import type { V2Event, V2Slide } from "@/lib/api/types";

type HistoryEvent = Pick<V2Event, "event_id" | "event_type" | "fiscal_quarter" | "fiscal_year" | "has_slides" | "scheduled_at">;

/** Title equality is the only slide correspondence exposed by the current API contract. */
export function slideTitleKey(title: null | string) {
    const key = title?.normalize("NFKC").trim().toLocaleLowerCase("en-US").replace(/\s+/gu, " ") ?? "";

    return /^(?:untitled|cover|title|title slide|agenda|disclaimer|disclaimers|thank you|questions|q&a)$/u.test(key) ? "" : key;
}

/** Never infer a match from slide position, numbers, or an ambiguous repeated title. */
export function matchingHistoricalSlide(current: V2Slide, currentSlides: ReadonlyArray<V2Slide>, historicalSlides: ReadonlyArray<V2Slide>): null | V2Slide {
    const key = slideTitleKey(current.title);

    if (!key || currentSlides.filter(slide => slideTitleKey(slide.title) === key).length !== 1) return null;

    const matches = historicalSlides.filter(slide => slideTitleKey(slide.title) === key);

    return matches.length === 1 ? matches[0] : null;
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
