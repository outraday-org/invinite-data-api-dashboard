/**
 * A speaker's initials badge text, the rule of the transcript PDF (backend earnings `pdf/transcript-document.ts`
 * `initialsOf` over `derive/people/name-key.ts` `nameKey`): honorifics, suffixes / credentials and middle initials off,
 * accents folded, apostrophes dropped, hyphens split; then the first letter of the first and of the last token, upper
 * case. One token = one letter; null = nothing left (no badge).
 */
const HONORIFICS: ReadonlySet<string> = new Set(["dr", "miss", "mr", "mrs", "ms", "prof", "sir"]);

const SUFFIXES: ReadonlySet<string> = new Set(["cfa", "ii", "iii", "iv", "jr", "mba", "phd", "sr"]);

export function initialsOf(name: string): null | string {
    const tokens = name
        .toLowerCase()
        .normalize("NFKD")
        .replace(/\p{M}/gu, "")
        .replace(/['’]/g, "")
        .replace(/[-,.]/g, " ")
        .split(/\s+/)
        .filter(Boolean);

    const firstKept = tokens.findIndex(token => !HONORIFICS.has(token));

    const kept = firstKept === -1 ? [] : tokens.slice(firstKept);

    while (kept.length > 1 && SUFFIXES.has(kept.at(-1) ?? "")) kept.pop();

    // Middle initials ("Timothy D. Cook") are off; a lone initial as first or last token stays.
    const words = kept.filter((token, index) => index === 0 || index === kept.length - 1 || token.length > 1);

    const letters = words
        .map(token => /\p{L}/u.exec(token)?.[0])
        .filter((letter): letter is string => letter !== undefined);

    if (letters.length === 0) return null;

    return (letters.length === 1 ? letters[0] : `${letters[0]}${letters.at(-1) ?? ""}`).toUpperCase();
}
