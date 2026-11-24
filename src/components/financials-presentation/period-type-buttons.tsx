import type { FiscalPeriodType } from "@/lib/api/types";

import { SegmentedButtons } from "@/components/ui/segmented-buttons";

const periodOptions: Array<{ label: string; value: FiscalPeriodType }> = [
    { label: "Quarterly", value: "quarterly" },
    { label: "Annual", value: "annual" },
    { label: "YTD", value: "ytd" },
    { label: "TTM", value: "ttm" },
];

/** The period switch of every Financials tab (`?period=`): a segmented control. */
export function PeriodTypeButtons({
    onValueChange,
    value,
}: {
    value: FiscalPeriodType;
    onValueChange: (value: FiscalPeriodType) => void;
}) {
    return <SegmentedButtons aria-label="Period" onChange={onValueChange} options={periodOptions} value={value} />;
}
