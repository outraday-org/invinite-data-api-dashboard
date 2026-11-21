import { PageHeader } from "@/components/ui/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function FilingsHeader({
    availableFormTypes,
    formTypeFilter,
    loadingFormTypes,
    onFormTypeChange,
    sortDirection,
}: {
    availableFormTypes: Array<string>;
    formTypeFilter: null | string;
    loadingFormTypes: boolean;
    onFormTypeChange: (val: null | string) => void;
    sortDirection: "asc" | "desc";
}) {
    return (
        <PageHeader
            actions={(
                <Select
                    disabled={loadingFormTypes || availableFormTypes.length === 0}
                    onValueChange={val => onFormTypeChange(val === "all" ? null : val)}
                    value={formTypeFilter ?? "all"}
                >
                    <SelectTrigger className="w-[180px]">
                        {!formTypeFilter || formTypeFilter === "all" ? "All form types" : <SelectValue />}
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All form types</SelectItem>
                        {availableFormTypes.map(type => (
                            <SelectItem key={type} value={type}>
                                {type}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}
            description={`SEC filings by form type, ${sortDirection === "desc" ? "newest first" : "oldest first"}.`}
            title="Filings"
        />
    );
}
