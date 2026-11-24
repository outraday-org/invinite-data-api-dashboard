import { DropdownSelect } from "@/components/ui/dropdown-select";

/** A labelled `DropdownSelect` over fixed options (the calendar, News, financials, holders, alerts … filters). */
export function FilterSelect<T extends string>({
    "aria-label": ariaLabel,
    className,
    disabled,
    id,
    onValueChange,
    options,
    title,
    value,
}: {
    /** Required: a picker's trigger shows its value, not what it filters (F102). */
    "aria-label": string;
    "className": string;
    "disabled"?: boolean;
    /** The trigger's id: a `FilterField` label points at it (`htmlFor`). */
    "id"?: string;
    "onValueChange": (value: T) => void;
    "options": Array<{ label: string; value: T }>;
    "title"?: string;
    "value": T;
}) {
    return (
        <DropdownSelect
            aria-label={ariaLabel}
            className={className}
            disabled={disabled}
            id={id}
            onValueChange={onValueChange}
            options={options}
            title={title}
            value={value}
        />
    );
}
