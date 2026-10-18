import { dataApiDashboardUrl } from "@/lib/app-url";
import { cn } from "@/lib/utils";

/** The one line under a key field that says where a key comes from. */
export function NoKeyYetHint({ className }: { className?: string }) {
    return (
        <p className={cn("text-muted-foreground text-sm", className)}>
            No key yet?
            {" "}
            <a
                className="text-primary underline-offset-4 hover:underline"
                href={dataApiDashboardUrl("keys")}
                rel="noreferrer"
                target="_blank"
            >
                Create one in your Data API dashboard.
            </a>
        </p>
    );
}
