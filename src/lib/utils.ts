import type { ClassValue } from "clsx";

import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: Array<ClassValue>) {
    return twMerge(clsx(inputs));
}

/** Paragraphs of a plain text (a release, a news body): blank lines split paragraphs, single newlines stay. */
export function paragraphs(text: string) {
    return text.split(/\n\s*\n/).map(part => part.trim()).filter(Boolean);
}

export function formatNumberEn(value: number, options?: Intl.NumberFormatOptions) {
    return new Intl.NumberFormat("en", options).format(value);
}

export function formatNumberEnCompact(
    value: number,
    options: Intl.NumberFormatOptions = {},
) {
    const formatted = new Intl.NumberFormat("en", {
        compactDisplay: "short",
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
        notation: "compact",
        ...options,
    }).format(value);

    return formatted.replace(/(\d)([A-Za-z])/g, "$1 $2");
}

export function formatPercentCompact(value: number) {
    return `${formatNumberEnCompact(value)}%`;
}

const metricUpperWords = new Set(["ebit", "ebitda", "ebt", "eps"]);

function titleCaseWords(value: string) {
    return value
        .split(" ")
        .filter(Boolean)
        .map((part) => {
            const lower = part.toLowerCase();

            if (lower.length === 0) return "";

            if (metricUpperWords.has(lower)) return lower.toUpperCase();

            return `${lower[0].toUpperCase()}${lower.slice(1)}`;
        })
        .filter(Boolean)
        .join(" ");
}

export function formatMetricId(metricId: string) {
    const words = titleCaseWords(metricId.replace(/_/g, " "));

    if (!words) return "";

    const parts = words.split(" ");

    const label = parts.length <= 1 ? (parts[0] ?? "") : parts.slice(1).join(" ");

    return label
        .replace(/\bYear Over Year\b/g, "YoY")
        .replace(/\bQuarter Over Quarter\b/g, "QoQ");
}

export function formatSegmentId(segmentId: string) {
    const normalized = segmentId.replace(/_/g, " ").trim();

    const withoutPrefix = normalized.replace(/^seg\b/i, "").trim();

    if (!withoutPrefix) return "";

    return titleCaseWords(withoutPrefix);
}
