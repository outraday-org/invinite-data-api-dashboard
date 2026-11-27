import type * as React from "react";

import { cn } from "@/lib/utils";

export type PageContainerWidth = "default" | "narrow" | "wide";

// Literal class names: Tailwind only sees classes written out in the source.
const WIDTH_CLASS: Record<PageContainerWidth, string> = {
    default: "max-w-[75rem]",
    narrow: "max-w-3xl",
    wide: "max-w-[90rem]",
};

/**
 * THE page frame of every route (ui-redesign task 2): centred in the content column, one width of three — `default`
 * 1200 px, `narrow` (the onboarding card, the route error, not found), `wide` (macro) —, the shell's padding
 * (`px-4 py-5` phone, `sm:px-6 sm:py-6`, `xl:px-8 xl:py-8`) and the section rhythm `gap-6`. `min-w-0`: a wide child
 * (a table) scrolls inside its own wrapper instead of stretching the page.
 */
export function PageContainer({
    children,
    className,
    width = "default",
    ...props
}: React.ComponentProps<"div"> & { width?: PageContainerWidth }) {
    return (
        <div
            className={cn(
                "mx-auto flex w-full min-w-0 flex-col gap-6 px-4 py-5 sm:px-6 sm:py-6 xl:px-8 xl:py-8",
                WIDTH_CLASS[width],
                className,
            )}
            data-slot="page-container"
            data-width={width}
            {...props}
        >
            {children}
        </div>
    );
}
