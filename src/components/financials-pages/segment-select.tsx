import type { SegmentedFinancialsSegmentId } from "@/lib/api/types";

import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";

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

export function SegmentSelect({
    onValueChange,
    value,
}: {
    value: "all" | SegmentedFinancialsSegmentId;
    onValueChange: (value: "all" | SegmentedFinancialsSegmentId) => void;
}) {
    return (
        <Select
            onValueChange={v => onValueChange(v as "all" | SegmentedFinancialsSegmentId)}
            value={value}
        >
            <SelectTrigger className="w-[260px]">
                {segmentOptions.find(opt => opt.value === value)?.label ?? "Select segment"}
            </SelectTrigger>
            <SelectContent>
                {segmentOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
