import { ChevronDownIcon } from "lucide-react";
import * as React from "react";

import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface DropdownSelectOption<T extends string = string> {
    disabled?: boolean;
    label: string;
    value: T;
}

export interface DropdownSelectGroup<T extends string = string> {
    label: string;
    options: ReadonlyArray<DropdownSelectOption<T>>;
}

/**
 * The trigger of every picker: an outlined button whose label truncates (`min-w-0 truncate`) and whose chevron never
 * shrinks (`shrink-0`), so at any width or label length the chevron stays inside the trigger's padding. 32 px, ≥ 36 px
 * below 640 px (`sm` = 28 px). The trigger has no width of its own (`w-fit`): a caller's width class sets it.
 */
export const DROPDOWN_SELECT_TRIGGER_CLASS = "border-input bg-input/20 dark:bg-input/30 hover:bg-input/40 dark:hover:bg-input/50 aria-expanded:bg-input/40 focus-visible:border-ring focus-visible:ring-ring/30 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 inline-flex w-fit max-w-full min-w-0 items-center justify-between gap-1.5 rounded-md border px-2.5 text-left text-data whitespace-nowrap transition-colors outline-none focus-visible:ring-[2px] aria-invalid:ring-[2px] data-[size=default]:h-8 data-[size=sm]:h-7 max-sm:min-h-9 disabled:cursor-not-allowed disabled:opacity-50 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50";

const ITEM_CLASS = "text-data";

/**
 * A trigger named by `aria-label` or a `<label htmlFor>` takes that name instead of its content, so the value span
 * (`valueId`) is the trigger's accessible description (`aria-describedby`): "Statement, button, Balance Sheet".
 */
function TriggerContent({ label, placeholder, valueId }: { label: string | undefined; placeholder: boolean; valueId: string }) {
    return (
        <>
            <span className={cn("min-w-0 truncate", placeholder && "text-muted-foreground")} data-slot="dropdown-select-value" id={valueId}>
                {label}
            </span>
            <ChevronDownIcon aria-hidden className="text-muted-foreground pointer-events-none size-3.5 shrink-0" data-slot="dropdown-select-chevron" />
        </>
    );
}

/**
 * THE single-choice picker (never a native `<select>`, never the `Select` primitive): a `DropdownMenu` whose trigger
 * shows the chosen option's label (else `placeholder`) and whose menu lists the options as radio items, the chosen one
 * checked. Arrows, Enter, Escape and typeahead come from the menu primitive; a long list scrolls inside the menu.
 * Choosing the shown value again calls nothing (as a native select). `name` adds a hidden input, so a `<form>` submits
 * the value.
 */
export function DropdownSelect<T extends string>({
    "aria-label": ariaLabel,
    "aria-required": ariaRequired,
    children,
    className,
    disabled,
    groups,
    id,
    label,
    name,
    onOpenChange,
    onValueChange,
    options = [],
    placeholder,
    size = "default",
    title,
    value,
}: {
    /** The picker's accessible name (a `FilterField` label may name it instead, through `id`). */
    "aria-label"?: string;
    "aria-required"?: boolean;
    /** More menu content after the options (a loading or failure line). */
    "children"?: React.ReactNode;
    "className"?: string;
    "disabled"?: boolean;
    /** Labelled option groups, shown after `options`. */
    "groups"?: ReadonlyArray<DropdownSelectGroup<T>>;
    /** The trigger's id: a `<label htmlFor>` points at it. */
    "id"?: string;
    /** The trigger's text instead of the chosen option's label. */
    "label"?: string;
    "name"?: string;
    "onOpenChange"?: (open: boolean) => void;
    "onValueChange": (value: T) => void;
    "options"?: ReadonlyArray<DropdownSelectOption<T>>;
    "placeholder"?: string;
    "size"?: "default" | "sm";
    "title"?: string;
    "value": T | undefined;
}) {
    const valueId = React.useId();

    const all = [...options, ...(groups ?? []).flatMap(group => group.options)];

    const chosen = all.find(option => option.value === value);

    const shown = label ?? chosen?.label;

    const item = (option: DropdownSelectOption<T>) => (
        <DropdownMenuRadioItem className={ITEM_CLASS} closeOnClick disabled={option.disabled} key={option.value} label={option.label} value={option.value}>
            {option.label}
        </DropdownMenuRadioItem>
    );

    return (
        <>
            <DropdownMenu disabled={disabled} modal={false} onOpenChange={open => onOpenChange?.(open)}>
                <DropdownMenuTrigger
                    aria-describedby={valueId}
                    aria-label={ariaLabel}
                    aria-required={ariaRequired}
                    className={cn(DROPDOWN_SELECT_TRIGGER_CLASS, className)}
                    data-size={size}
                    data-slot="dropdown-select-trigger"
                    disabled={disabled}
                    id={id}
                    title={title}
                >
                    <TriggerContent label={shown ?? placeholder} placeholder={shown === undefined} valueId={valueId} />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-auto max-w-[min(32rem,calc(100vw-2rem))] min-w-(--anchor-width)">
                    <DropdownMenuRadioGroup
                        onValueChange={(next: T) => {
                            if (next !== value) onValueChange(next);
                        }}
                        value={value ?? null}
                    >
                        {options.map(item)}
                        {groups?.map(group => (
                            <DropdownMenuGroup key={group.label}>
                                <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
                                {group.options.map(item)}
                            </DropdownMenuGroup>
                        ))}
                    </DropdownMenuRadioGroup>
                    {children}
                </DropdownMenuContent>
            </DropdownMenu>
            {name !== undefined && <input name={name} type="hidden" value={value ?? ""} />}
        </>
    );
}

/**
 * The several-choice picker on the same trigger: checkbox items that keep the menu open; the trigger names the one
 * choice, else "N selected", else `placeholder`.
 */
export function DropdownMultiSelect<T extends string>({
    "aria-label": ariaLabel,
    "aria-required": ariaRequired,
    className,
    disabled,
    id,
    onValueChange,
    options,
    placeholder,
    value,
}: {
    "aria-label"?: string;
    "aria-required"?: boolean;
    "className"?: string;
    "disabled"?: boolean;
    "id"?: string;
    "onValueChange": (value: Array<T>) => void;
    "options": ReadonlyArray<DropdownSelectOption<T>>;
    "placeholder": string;
    "value": ReadonlyArray<T>;
}) {
    const valueId = React.useId();

    const picked = options.filter(option => value.includes(option.value));

    const shown = picked.length === 0 ? undefined : picked.length === 1 ? picked[0].label : `${picked.length} selected`;

    return (
        <DropdownMenu disabled={disabled} modal={false}>
            <DropdownMenuTrigger
                aria-describedby={valueId}
                aria-label={ariaLabel}
                aria-required={ariaRequired}
                className={cn(DROPDOWN_SELECT_TRIGGER_CLASS, className)}
                data-size="default"
                data-slot="dropdown-select-trigger"
                disabled={disabled}
                id={id}
            >
                <TriggerContent label={shown ?? placeholder} placeholder={shown === undefined} valueId={valueId} />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-auto max-w-[min(32rem,calc(100vw-2rem))] min-w-(--anchor-width)">
                {options.map(option => (
                    <DropdownMenuCheckboxItem
                        checked={value.includes(option.value)}
                        className={ITEM_CLASS}
                        closeOnClick={false}
                        disabled={option.disabled}
                        key={option.value}
                        label={option.label}
                        onCheckedChange={checked => onValueChange(checked
                            ? options.filter(o => o.value === option.value || value.includes(o.value)).map(o => o.value)
                            : value.filter(v => v !== option.value))}
                    >
                        {option.label}
                    </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
