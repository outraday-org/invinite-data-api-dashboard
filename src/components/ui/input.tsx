import { Input as InputPrimitive } from "@base-ui/react/input";
import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
    return (
        <InputPrimitive
            className={cn(
                "bg-input/20 dark:bg-input/30 border-input aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 h-8 rounded-md border px-2 py-0.5 text-data transition-colors max-sm:min-h-9 file:h-6 file:text-xs file:font-medium aria-invalid:ring-2 file:text-foreground placeholder:text-muted-foreground w-full min-w-0 outline-none file:inline-flex file:border-0 file:bg-transparent disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
                className,
            )}
            data-slot="input"
            type={type}
            {...props}
        />
    );
}

export { Input };
