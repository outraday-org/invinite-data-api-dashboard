import type { SegmentedFinancialsSegmentId } from "@/lib/api/types";

import { DropdownSelect } from "@/components/ui/dropdown-select";

const segmentOptions: Array<{ label: string; value: "all" | SegmentedFinancialsSegmentId }> = [
    { label: "All Segments", value: "all" },
    { label: "Revenue (Product)", value: "seg_revenue_product" },
    { label: "Revenue (Geographic)", value: "seg_revenue_geographic" },
    { label: "Revenue (Business Segment)", value: "seg_revenue_business_segment" },
    { label: "Cost of Revenue (Business Segment)", value: "seg_cost_of_revenue_business_segment" },
    {
        label: "R&D Expenses (Business Segment)",
        value: "seg_research_and_development_expenses_business_segment",
    },
    {
        label: "Selling & Marketing Expenses (Business Segment)",
        value: "seg_selling_and_marketing_expenses_business_segment",
    },
    {
        label: "G&A Expenses (Business Segment)",
        value: "seg_general_and_administrative_expenses_business_segment",
    },
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
