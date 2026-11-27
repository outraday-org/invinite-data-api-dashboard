import type { SegmentedFinancialsSegmentId } from "@/lib/api/types";

import { DropdownSelect } from "@/components/ui/dropdown-select";
import { SEGMENT_METRICS } from "@/lib/financials/segment-metrics";

const segmentOptions: Array<{ label: string; value: "all" | SegmentedFinancialsSegmentId }> = [
    { label: "All Segments", value: "all" },
    ...SEGMENT_METRICS,
];

/** `?segment=` as a segment id of the picker ("all" for none or an unknown value). */
export function toSegmentId(value: string | undefined): "all" | SegmentedFinancialsSegmentId {
    return segmentOptions.find(option => option.value === value)?.value ?? "all";
}

export function SegmentSelect({
    onValueChange,
    value,
}: {
    value: "all" | SegmentedFinancialsSegmentId;
    onValueChange: (value: "all" | SegmentedFinancialsSegmentId) => void;
}) {
    return (
        <DropdownSelect
            aria-label="Segment"
            className="w-full"
            onValueChange={onValueChange}
            options={segmentOptions}
            placeholder="Select segment"
            value={value}
        />
    );
}
