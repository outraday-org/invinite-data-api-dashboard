import type { StatementType } from "@/lib/api/types";

import { DropdownSelect } from "@/components/ui/dropdown-select";

const statementOptions: Array<{ label: string; value: StatementType }> = [
    { label: "Income Statement", value: "income-statement" },
    { label: "Balance Sheet", value: "balance-sheet" },
    { label: "Cash Flow Statement", value: "cash-flow" },
];

export function StatementSelect({
    onValueChange,
    value,
}: {
    value: StatementType;
    onValueChange: (value: StatementType) => void;
}) {
    return (
        <DropdownSelect
            aria-label="Statement"
            className="w-[170px]"
            onValueChange={onValueChange}
            options={statementOptions}
            placeholder="Select statement"
            value={value}
        />
    );
}
