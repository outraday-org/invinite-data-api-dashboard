import type { StatementType } from "@/lib/api/types";

import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";

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
        <Select
            onValueChange={v => onValueChange(v as StatementType)}
            value={value}
        >
            <SelectTrigger className="w-[180px]">
                {statementOptions.find(opt => opt.value === value)?.label ?? "Select statement"}
            </SelectTrigger>
            <SelectContent>
                {statementOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
