import type { VariantProps } from "class-variance-authority";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

function Tabs({
    className,
    orientation = "horizontal",
    ...props
}: TabsPrimitive.Root.Props) {
    return (
        <TabsPrimitive.Root
            className={cn(
                "gap-2 group/tabs flex data-[orientation=horizontal]:flex-col",
                className,
            )}
            data-orientation={orientation}
            data-slot="tabs"
            {...props}
        />
    );
}

const tabsListVariants = cva(
    "rounded-lg p-[3px] group-data-horizontal/tabs:h-9 max-sm:group-data-horizontal/tabs:h-auto data-[variant=line]:rounded-none group/tabs-list text-muted-foreground inline-flex w-fit items-center justify-center group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col",
    {
        defaultVariants: {
            variant: "default",
        },
        variants: {
            variant: {
                default: "bg-muted",
                line: "gap-1 bg-transparent",
            },
        },
    },
);

function TabsList({
    className,
    variant = "default",
    ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
    return (
        <TabsPrimitive.List
            className={cn(tabsListVariants({ variant }), className)}
            data-slot="tabs-list"
            data-variant={variant}
            {...props}
        />
    );
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
    return (
        <TabsPrimitive.Tab
            className={cn(
                "gap-1.5 rounded-md border border-transparent px-2 py-0.5 text-data font-medium max-sm:min-h-9 group-data-vertical/tabs:py-[calc(--spacing(1.25))] [&_svg:not([class*='size-'])]:size-3.5 text-foreground/60 hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center whitespace-nowrap transition-all group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
                // A line tab sizes to its label (never stretched over a wrapped row).
                "group-data-[variant=line]/tabs-list:flex-none group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
                "data-active:bg-background dark:data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 data-active:text-foreground",
                "after:bg-brand after:absolute after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
                className,
            )}
            data-slot="tabs-trigger"
            {...props}
        />
    );
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
    return (
        <TabsPrimitive.Panel
            // The panel takes focus (Tab after the tab list): the app's one focus outline, never none.
            className={cn("flex-1 rounded-md outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary", className)}
            data-slot="tabs-content"
            {...props}
        />
    );
}

export { Tabs, TabsContent, TabsList, tabsListVariants, TabsTrigger };
