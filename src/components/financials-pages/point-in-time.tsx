import * as React from "react";

import type { V2FilingSource, V2StatementsResponse } from "@/lib/api/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { formatDay } from "@/lib/format";
import { FilterSelect } from "@/routes/$ticker/earnings-calls/-components/calendar-filters";

/** `meta.point_in_time` of a statement page: the selector it was answered for (null = the current renderings). */
export type PointInTime = NonNullable<V2StatementsResponse["meta"]["point_in_time"]>;

const LATEST = "latest";

/** One choice of the "From filing" picker: an accession and its form + filing day. */
export type FilingChoice = { accession: string; label: string };

const choiceLabel = (source: Pick<V2FilingSource, "accession" | "filed_at" | "form">) => `${source.form} · ${formatDay(source.filed_at)}`;

/**
 * The filings the loaded periods were rendered from (newest filing first, one per accession) plus the pinned one when
 * the loaded pages do not name it: the "From filing" picker's options (the API has no list of a company's renderings).
 */
export function filingChoices(pages: ReadonlyArray<V2StatementsResponse>, pinned: null | string): Array<FilingChoice> {
    const sources = new Map<string, V2FilingSource>();

    for (const page of pages) {
        for (const row of page.data) {
            if (!sources.has(row.source.accession)) sources.set(row.source.accession, row.source);
        }
    }

    const choices = [...sources.values()]
        .sort((a, b) => b.filed_at.localeCompare(a.filed_at))
        .map(source => ({ accession: source.accession, label: choiceLabel(source) }));

    return pinned && !sources.has(pinned) ? [{ accession: pinned, label: pinned }, ...choices] : choices;
}

/** The URL patch of a point-in-time change: an as-of day and a pinned filing exclude each other. */
export type PointInTimePatch = { asOf?: string; filing?: string };

/**
 * The point-in-time pickers of the statement tabs (`as_of`, `filing`; ratios and growth have neither): "As of" = the
 * newest rendering of each period filed on or before that day; "From filing" = the rendering of one filing. Picking one
 * clears the other.
 */
export function PointInTimeControls({ asOf, choices, filing, onChange }: {
    asOf: string | undefined;
    choices: ReadonlyArray<FilingChoice>;
    filing: string | undefined;
    onChange: (patch: PointInTimePatch) => void;
}) {
    const options = React.useMemo(
        () => [{ label: "Latest filings", value: LATEST }, ...choices.map(choice => ({ label: choice.label, value: choice.accession }))],
        [choices],
    );

    return (
        <div aria-label="Point in time" className="flex flex-wrap items-center gap-2" role="group">
            <Input
                aria-label="As of"
                className="w-[150px]"
                onChange={event => onChange({ asOf: event.target.value || undefined, filing: undefined })}
                title="As filed on or before this day"
                type="date"
                value={asOf ?? ""}
            />
            <FilterSelect
                aria-label="From filing"
                className="w-[190px]"
                onValueChange={value => onChange({ asOf: undefined, filing: value === LATEST ? undefined : value })}
                options={options}
                title="The rendering of one filing"
                value={filing ?? LATEST}
            />
        </div>
    );
}

/** The banner of a point-in-time answer (`meta.point_in_time`), with the way back to the current renderings. */
export function PointInTimeBanner({ onClear, pointInTime }: { onClear: () => void; pointInTime: null | PointInTime | undefined }) {
    if (!pointInTime || (!pointInTime.as_of && !pointInTime.filing)) return null;

    const title = pointInTime.filing
        ? `Point in time: as rendered by filing ${pointInTime.filing}`
        : `Point in time: as filed on or before ${formatDay(pointInTime.as_of)}`;

    return (
        <div data-testid="point-in-time-banner">
            <Notice badge="Point in time" title={title}>
                <div className="flex flex-wrap items-center gap-3">
                    <span>Values as they were known then; later restatements are not applied.</span>
                    <Button onClick={onClear} size="sm" variant="outline">Back to current</Button>
                </div>
            </Notice>
        </div>
    );
}
