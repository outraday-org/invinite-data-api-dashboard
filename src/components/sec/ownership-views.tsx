import * as React from "react";

import type { V2HolderChangeType } from "@/lib/api/types";

import { Button } from "@/components/ui/button";
import { CHANGE_TYPES } from "@/lib/sec/ownership";

/**
 * Shared bits of the ownership and offerings pages (backend tasks/data-api-dashboard O7 group 6): a label / value grid
 * for a detail view and the 13F change-type chips. Pure.
 */

/** A detail's facts as a two-column grid; a fact without a value is left out. */
export function FactGrid({ facts, testId }: { facts: ReadonlyArray<readonly [string, React.ReactNode]>; testId?: string }) {
    const shown = facts.filter(([, value]) => value !== null && value !== undefined && value !== "");

    if (shown.length === 0) return null;

    return (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5" data-testid={testId}>
            {shown.map(([label, value]) => (
                <React.Fragment key={label}>
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="min-w-0 break-words tabular-nums">{value}</dd>
                </React.Fragment>
            ))}
        </dl>
    );
}

export const CHANGE_TYPE_CHIP_LABELS: Record<V2HolderChangeType, string> = {
    added: "Added",
    new: "New",
    reduced: "Reduced",
    sold_out: "Sold out",
    unchanged: "Unchanged",
};

/**
 * The 13F change types as toggle chips (`type=` of `/v1/holder-changes` and `/v1/filers/{cik}/holding-changes`). None
 * picked = the API's default: every change but `unchanged` (said in the hint).
 */
export function ChangeTypeChips({ onChange, value }: { onChange: (types: Array<V2HolderChangeType>) => void; value: ReadonlyArray<V2HolderChangeType> }) {
    const toggle = (type: V2HolderChangeType) => onChange(value.includes(type) ? value.filter(entry => entry !== type) : [...value, type]);

    return (
        <div aria-label="Change types" className="flex flex-wrap items-center gap-1" role="group">
            {CHANGE_TYPES.map(type => (
                <Button
                    aria-pressed={value.includes(type)}
                    key={type}
                    onClick={() => toggle(type)}
                    size="xs"
                    type="button"
                    variant={value.includes(type) ? "default" : "outline"}
                >
                    {CHANGE_TYPE_CHIP_LABELS[type]}
                </Button>
            ))}
            {value.length === 0 && <span className="text-muted-foreground text-xs">Every change but unchanged</span>}
        </div>
    );
}
