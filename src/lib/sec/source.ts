/**
 * View models of the SEC document store answers (`/v1/sec/*`). The spec types most nested objects as free JSON
 * (`additionalProperties`), so every field is read through a guard here — never cast — and a missing or
 * differently-typed field reads as absent, never as a made-up value. Shapes: the live answers of 2026-11-05 (backend
 * delivery-integration task 5 plan) and secdoors' `as_json` (block `page {ordinal, printed}`, `neighbors`,
 * `footnote_refs` = block ids of the same version, `citation`, figure `image_status` / `caption` / `alt`).
 */
import type { JsonValue } from "@/lib/api/types";

type JsonRecord = { [key: string]: JsonValue };

export function isRecord(value: JsonValue | undefined): value is JsonRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function recordOf(value: JsonValue | undefined): JsonRecord {
    return isRecord(value) ? value : {};
}

export function textOf(record: JsonRecord, key: string): null | string {
    const value = record[key];

    return typeof value === "string" && value.length > 0 ? value : null;
}

export function numberOf(record: JsonRecord, key: string): null | number {
    const value = record[key];

    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function boolOf(record: JsonRecord, key: string): boolean | null {
    const value = record[key];

    return typeof value === "boolean" ? value : null;
}

export function listOf(value: JsonValue | undefined): Array<JsonValue> {
    return Array.isArray(value) ? value : [];
}

function stringsOf(value: JsonValue | undefined): Array<string> {
    return listOf(value).filter(item => typeof item === "string");
}

/** A permanent public copy (`{ url }`) or null; only an `https:` URL counts. */
export function publicUrlOf(value: JsonValue | undefined): null | string {
    const url = textOf(recordOf(value), "url");

    return url?.startsWith("https://") ? url : null;
}

export type SecCanonical = {
    reason: null | string;
    status: null | string;
    textReady: boolean;
    versionId: null | string;
    visualReady: boolean;
};

/** One document of a filing manifest (`documents[]` of `/v1/sec/filings/{accession}`). */
export type SecManifestDocument = {
    availability: null | string;
    canonical: null | SecCanonical;
    description: null | string;
    docType: null | string;
    filename: string;
    mimeType: null | string;
    /** The permanent public copy; null = none yet (never a fabricated link, never a sec.gov fetch). */
    publicUrl: null | string;
    role: null | string;
    sequence: null | number;
    /** The document's true size (`size_bytes`), not the stored (compressed) size. */
    sizeBytes: null | number;
    tooLarge: boolean;
};

function toCanonical(value: JsonValue | undefined): null | SecCanonical {
    if (!isRecord(value)) return null;

    return {
        reason: textOf(value, "reason"),
        status: textOf(value, "status"),
        textReady: boolOf(value, "text_ready") === true,
        versionId: textOf(value, "version_id"),
        visualReady: boolOf(value, "visual_ready") === true,
    };
}

export function toManifestDocuments(documents: ReadonlyArray<JsonValue> | undefined): Array<SecManifestDocument> {
    return (documents ?? []).filter(isRecord).flatMap((doc) => {
        const filename = textOf(doc, "filename");

        if (!filename) return [];

        return [{
            availability: textOf(doc, "availability"),
            canonical: toCanonical(doc.canonical),
            description: textOf(doc, "description"),
            docType: textOf(doc, "doc_type"),
            filename,
            mimeType: textOf(doc, "mime_type"),
            publicUrl: publicUrlOf(doc.source),
            role: textOf(doc, "role"),
            sequence: numberOf(doc, "sequence"),
            sizeBytes: numberOf(doc, "size_bytes"),
            tooLarge: boolOf(doc, "too_large") === true,
        }];
    });
}

/** A readable document of the manifest = one with a canonical version. */
export function hasCanonicalVersion(doc: SecManifestDocument) {
    return Boolean(doc.canonical?.versionId);
}

export type SecPage = { ordinal: number; printed: null | string };

export type SecCitation = { blockId: string; page: null | number; printed: null | string; versionId: string };

export type SecFigure = { alt: null | string; caption: null | string; imageStatus: null | string };

export type SecBlock = {
    citation: null | SecCitation;
    figure: null | SecFigure;
    footnoteRefs: Array<string>;
    headingLevel: null | number;
    id: string;
    kind: string;
    next: null | string;
    page: null | SecPage;
    prev: null | string;
    text: string;
};

function toPage(value: JsonValue | undefined): null | SecPage {
    if (!isRecord(value)) return null;

    const ordinal = numberOf(value, "ordinal");

    return ordinal === null ? null : { ordinal, printed: textOf(value, "printed") };
}

function toCitation(value: JsonValue | undefined): null | SecCitation {
    if (!isRecord(value)) return null;

    const versionId = textOf(value, "version_id");

    const blockId = textOf(value, "block_id");

    if (!versionId || !blockId) return null;

    return { blockId, page: numberOf(value, "page"), printed: textOf(value, "printed"), versionId };
}

function toFigure(value: JsonValue | undefined): null | SecFigure {
    if (!isRecord(value)) return null;

    return { alt: textOf(value, "alt"), caption: textOf(value, "caption"), imageStatus: textOf(value, "image_status") };
}

export function toBlocks(blocks: ReadonlyArray<JsonValue> | undefined): Array<SecBlock> {
    return (blocks ?? []).filter(isRecord).flatMap((block) => {
        const id = textOf(block, "id");

        if (!id) return [];

        const neighbors = recordOf(block.neighbors);

        return [{
            citation: toCitation(block.citation),
            figure: toFigure(block.figure),
            footnoteRefs: stringsOf(block.footnote_refs),
            headingLevel: numberOf(block, "heading_level"),
            id,
            kind: textOf(block, "kind") ?? "block",
            next: textOf(neighbors, "next"),
            page: toPage(block.page),
            prev: textOf(neighbors, "prev"),
            text: typeof block.text === "string" ? block.text : "",
        }];
    });
}

export type SecSelection = { nextBlock: null | string; truncated: boolean };

export function toSelection(value: JsonValue | undefined): SecSelection {
    const selection = recordOf(value);

    return { nextBlock: textOf(selection, "next_block"), truncated: boolOf(selection, "truncated") === true };
}

/** `quality.printed_labels_trusted`; absent = not trusted (a printed label is then never shown as the page). */
export function printedLabelsTrusted(quality: JsonValue | undefined) {
    return boolOf(recordOf(quality), "printed_labels_trusted") === true;
}

/**
 * The page a block sits on: the printed label exactly as printed when present AND trusted, else the physical
 * ordinal marked as such. Never an invented label; no page at all → null.
 */
export function pageLabel(page: null | SecPage, trusted: boolean): null | string {
    if (!page) return null;

    if (page.printed && trusted) return `p. ${page.printed}`;

    return `p. ${page.ordinal} (ordinal)`;
}

/** A citation as text: the immutable version + block (+ page), never a URL. */
export function citationText(citation: SecCitation, trusted: boolean) {
    const page = citation.page === null ? null : pageLabel({ ordinal: citation.page, printed: citation.printed }, trusted);

    return [`version ${citation.versionId}`, `block ${citation.blockId}`, page].filter(Boolean).join(" · ");
}

/** The pinned version of a document answer (`version.version_id`). */
export function versionIdOf(version: JsonValue | undefined) {
    return textOf(recordOf(version), "version_id");
}

/** The EDGAR page of the document (`source.sec_url`) — an outbound link only, never fetched by this app. */
export function secUrlOf(source: JsonValue | undefined) {
    const url = textOf(recordOf(source), "sec_url");

    return url?.startsWith("https://www.sec.gov/") ? url : null;
}

const ROLE_LABELS: Partial<Record<string, string>> = {
    exhibit: "Exhibit",
    graphic: "Graphic",
    primary: "Primary document",
    rendering: "Rendering",
    xbrl: "XBRL",
};

export function roleLabel(role: null | string) {
    if (!role) return "—";

    return ROLE_LABELS[role] ?? role.replaceAll("_", " ");
}

const BLOCK_ID = /^b(\d+)$/;

/** An open-ended block range from `blockId` (the store clamps the end to the version's last block). */
export function blocksFrom(blockId: string) {
    return `${blockId}-b9999999`;
}

/** The `limit` blocks before `blockId` as a range (`b00001-b00006`), null for the first block or a foreign id. */
export function blocksBefore(blockId: string, limit: number): null | string {
    const match = BLOCK_ID.exec(blockId);

    if (!match) return null;

    const ordinal = Number(match[1]);

    if (ordinal <= 1) return null;

    const width = match[1].length;

    const id = (n: number) => `b${String(n).padStart(width, "0")}`;

    return `${id(Math.max(1, ordinal - limit))}-${id(ordinal - 1)}`;
}

/** An open-ended range starting `context` blocks before `blockId` (a citation opened with a little lead-in). */
export function blocksLeadingTo(blockId: string, context: number) {
    const before = blocksBefore(blockId, context);

    return blocksFrom(before ? before.slice(0, before.indexOf("-")) : blockId);
}

/** One SEC search hit as the views need it; `blockId` / `page` = its first cited block (the passage's place). */
export type SecHitView = {
    accession: null | string;
    blockId: null | string;
    filename: null | string;
    filerCik: null | string;
    filerName: null | string;
    filingDate: null | string;
    form: null | string;
    page: null | SecPage;
    publicUrl: null | string;
    versionId: null | string;
};

export function toSecHitView(hit: { [key: string]: JsonValue | undefined }): SecHitView {
    const record: JsonRecord = {};

    for (const [key, value] of Object.entries(hit)) if (value !== undefined) record[key] = value;

    const citation = recordOf(record.citation);

    const firstCited = toBlocks(listOf(record.cited)).at(0);

    const filer = recordOf(record.filer);

    return {
        accession: textOf(record, "accession") ?? textOf(citation, "accession"),
        blockId: firstCited?.citation?.blockId ?? firstCited?.id ?? null,
        filename: textOf(record, "filename") ?? textOf(citation, "filename"),
        filerCik: textOf(filer, "cik"),
        filerName: textOf(filer, "name") ?? textOf(filer, "name_as_filed"),
        filingDate: textOf(record, "filing_date"),
        form: textOf(record, "form"),
        page: firstCited?.page ?? null,
        publicUrl: publicUrlOf(citation.source),
        versionId: textOf(record, "version_id") ?? textOf(citation, "version_id"),
    };
}

/** The scalar fields of a free-form record (string / number / boolean), for a compact "key: value" rendering. */
export function scalarEntries(value: JsonValue | undefined, skip: ReadonlyArray<string> = []): Array<[string, string]> {
    return Object.entries(recordOf(value)).flatMap(([key, item]) => {
        if (skip.includes(key) || item === null || typeof item === "object") return [];

        return [[key.replaceAll("_", " "), String(item)]];
    });
}

/** A review status stated by a lifecycle relation / track (`review_status`, else `status`), never assumed. */
export function reviewStatusOf(value: JsonValue | undefined) {
    const record = recordOf(value);

    return textOf(record, "review_status") ?? textOf(record, "status");
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** 13F reports are due 45 days after the quarter: the newest quarter end whose reports are due by `now` (UTC). */
export function latest13fPeriodEnd(now: Date) {
    const due = new Date(now.getTime() - 45 * DAY_MS);

    const quarterStartMonth = Math.floor(due.getUTCMonth() / 3) * 3;

    // The day before the due date's quarter starts = the previous quarter's last day.
    const end = new Date(Date.UTC(due.getUTCFullYear(), quarterStartMonth, 1) - DAY_MS);

    return end.toISOString().slice(0, 10);
}
