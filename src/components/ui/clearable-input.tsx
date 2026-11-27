import { X } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * THE text input of every search and text filter: an × INSIDE the field, shown only while the text is not blank,
 * resets it (`onClear`) and puts the focus back into the field. `wrapperClassName` sizes the wrapper (the input fills
 * it); every other prop goes to the `Input`.
 */
export function ClearableInput({
    className,
    clearLabel = "Clear the search",
    onClear,
    value,
    wrapperClassName,
    ...props
}: {
    /** The × button's accessible name. */
    clearLabel?: string;
    onClear: () => void;
    value: string;
    wrapperClassName?: string;
} & Omit<React.ComponentProps<typeof Input>, "value">) {
    const clearable = value.trim() !== "";

    return (
        <div className={cn("relative w-full min-w-0", wrapperClassName)}>
            <Input
                className={cn(clearable && "pr-8", "[&::-webkit-search-cancel-button]:hidden", className)}
                value={value}
                {...props}
            />
            {clearable && (
                <Button
                    aria-label={clearLabel}
                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1 -translate-y-1/2"
                    onClick={(event) => {
                        onClear();

                        event.currentTarget.parentElement?.querySelector("input")?.focus();
                    }}
                    size="icon-xs"
                    type="button"
                    variant="ghost"
                >
                    <X />
                </Button>
            )}
        </div>
    );
}
