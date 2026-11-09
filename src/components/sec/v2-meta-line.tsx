import type { V2MetaCoverage, V2MetaSource } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { formatInstant } from "@/lib/earnings/format";
import { metaSourceParts, toMetaSource } from "@/lib/sec/source";

const COVERAGE_LABELS: Record<V2MetaCoverage["state"], string> = {
    complete: "Complete",
    partial: "Partial",
    pending: "Pending",
};

/** The page metadata of a v2 SEC list worth showing (holdings add `pinned_at` / `counting`). */
export type V2SecMeta = {
    counting?: null | string;
    coverage?: V2MetaCoverage;
    pinned_at?: null | string;
    source?: V2MetaSource;
};

/**
 * One line of a v2 SEC answer's provenance: the coverage state (+ `through`), the research snapshot (`pinned_at`),
 * the documented counting rule and `meta.source`. Renders nothing when the answer states none of them.
 */
export function V2MetaLine({ meta }: { meta: undefined | V2SecMeta }) {
    if (!meta) return null;

    const sourceParts = metaSourceParts(toMetaSource(meta.source));

    const { counting, coverage } = meta;

    const pinnedAt = meta.pinned_at;

    if (!coverage && !pinnedAt && !counting && sourceParts.length === 0) return null;

    return (
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" data-testid="v2-meta-line">
            {coverage && (
                <span className="inline-flex items-center gap-1">
                    <Badge variant={coverage.state === "complete" ? "secondary" : "outline"}>{COVERAGE_LABELS[coverage.state]}</Badge>
                    {coverage.through && <span>{`through ${coverage.through}`}</span>}
                </span>
            )}
            {pinnedAt && <span>{`Snapshot ${formatInstant(pinnedAt)}`}</span>}
            {counting && <span title="How positions are counted">{counting}</span>}
            {sourceParts.map(part => <span key={part}>{part}</span>)}
        </div>
    );
}
