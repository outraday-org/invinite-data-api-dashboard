import { saveBlob } from "@/lib/download";

/** One CSV column: its header and how a row's cell is read. */
export type ExportColumn<TRow> = { header: string; value: (row: TRow) => unknown };

/** Leading characters a spreadsheet reads as a formula (OWASP CSV injection: = + - @, tab, carriage return). */
const FORMULA_START = /^[=+\-@\t\r]/;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A row as flat cells: nested objects become dotted keys (`meta.source.url`), an array of plain values one `; `-joined
 * cell, an array of objects its JSON.
 */
export function flattenRow(row: unknown, prefix = ""): Record<string, unknown> {
    if (!isPlainObject(row)) return { [prefix || "value"]: row };

    const out: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(row)) {
        const path = prefix ? `${prefix}.${key}` : key;

        if (isPlainObject(value)) Object.assign(out, flattenRow(value, path));
        else out[path] = value;
    }

    return out;
}

const cellText = (value: unknown): string => {
    if (value === null || value === undefined) return "";

    if (Array.isArray(value)) {
        return value.every(item => item === null || typeof item !== "object") ? value.map(item => cellText(item)).join("; ") : JSON.stringify(value);
    }

    if (typeof value === "object") return JSON.stringify(value);

    return String(value);
};

/**
 * One CSV field (RFC 4180): quoted when it holds a comma, quote or line break, quotes doubled. A TEXT cell starting
 * like a formula gets a leading `'` (a number such as -1.5 stays a number).
 */
export function csvCell(value: unknown): string {
    let text = cellText(value);

    if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;

    return /[",\r\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

/**
 * Rows as CSV (RFC 4180, CRLF line ends). Without `columns` every row is flattened (`flattenRow`) and the header is
 * the union of their keys in first-seen order.
 */
export function toCsv<TRow>(rows: ReadonlyArray<TRow>, columns?: ReadonlyArray<ExportColumn<TRow>>): string {
    if (columns) {
        const lines = [columns.map(column => csvCell(column.header)).join(",")];

        for (const row of rows) lines.push(columns.map(column => csvCell(column.value(row))).join(","));

        return `${lines.join("\r\n")}\r\n`;
    }

    const flat = rows.map(row => flattenRow(row));

    const headers: Array<string> = [];

    const seen = new Set<string>();

    for (const row of flat) {
        for (const key of Object.keys(row)) {
            if (!seen.has(key)) {
                seen.add(key);

                headers.push(key);
            }
        }
    }

    const lines = [headers.map(csvCell).join(",")];

    for (const row of flat) lines.push(headers.map(header => csvCell(row[header])).join(","));

    return `${lines.join("\r\n")}\r\n`;
}

const fileWord = (text: string) => text.trim().replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "export";

/** `<symbol-or-scope>-<dataset>-<yyyy-mm-dd>.<ext>` (the UTC day of `now`). */
export function exportFileName(scope: string, dataset: string, extension: "csv" | "json", now = new Date()): string {
    return `${fileWord(scope)}-${fileWord(dataset)}-${now.toISOString().slice(0, 10)}.${extension}`;
}

/** The UTF-8 byte-order mark: a spreadsheet then reads the file as UTF-8, not the system code page. */
const BYTE_ORDER_MARK = "\uFEFF";

/** Saves rows as a CSV file (UTF-8 with a byte-order mark, so a spreadsheet reads the encoding). */
export function downloadCsv<TRow>(rows: ReadonlyArray<TRow>, filename: string, columns?: ReadonlyArray<ExportColumn<TRow>>) {
    saveBlob(new Blob([`${BYTE_ORDER_MARK}${toCsv(rows, columns)}`], { type: "text/csv;charset=utf-8" }), filename);
}

/** Saves rows as an indented JSON array. */
export function downloadJson(rows: ReadonlyArray<unknown>, filename: string) {
    saveBlob(new Blob([`${JSON.stringify(rows, null, 2)}\n`], { type: "application/json" }), filename);
}
