import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A raised surface: 1 px border, no shadow. `variant="plain"` keeps only the header / title typography (no border, no
 * padding, no fill) for a section that needs no box.
 */
function Card({
    className,
    size = "default",
    variant = "default",
    ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm"; variant?: "default" | "plain" }) {
    return (
        <div
            className={cn("border-border bg-card text-card-foreground gap-4 overflow-hidden rounded-lg border py-4 sm:py-5 has-[>img:first-child]:pt-0 data-[size=sm]:gap-3 data-[size=sm]:py-3 data-[variant=plain]:border-0 data-[variant=plain]:bg-transparent data-[variant=plain]:py-0 data-[variant=plain]:rounded-none *:[img:first-child]:rounded-t-lg *:[img:last-child]:rounded-b-lg group/card flex flex-col", className)}
            data-size={size}
            data-slot="card"
            data-variant={variant}
            {...props}
        />
    );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            className={cn(
                "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
                className,
            )}
            data-slot="card-action"
            {...props}
        />
    );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            className={cn("px-4 sm:px-5 group-data-[size=sm]/card:px-3 group-data-[variant=plain]/card:px-0", className)}
            data-slot="card-content"
            {...props}
        />
    );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            className={cn("text-muted-foreground max-w-[68ch] text-sm", className)}
            data-slot="card-description"
            {...props}
        />
    );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            className={cn("rounded-b-lg px-4 sm:px-5 group-data-[size=sm]/card:px-3 group-data-[variant=plain]/card:px-0 [.border-t]:pt-4 group-data-[size=sm]/card:[.border-t]:pt-3 flex items-center", className)}
            data-slot="card-footer"
            {...props}
        />
    );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            className={cn(
                "gap-1 rounded-t-lg px-4 sm:px-5 group-data-[size=sm]/card:px-3 group-data-[variant=plain]/card:px-0 [.border-b]:pb-4 group-data-[size=sm]/card:[.border-b]:pb-3 group/card-header @container/card-header grid auto-rows-min items-start has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto]",
                className,
            )}
            data-slot="card-header"
            {...props}
        />
    );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            className={cn("text-section", className)}
            data-slot="card-title"
            {...props}
        />
    );
}

export {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
};
