import type * as React from "react";

import { Link } from "@tanstack/react-router";

import type { EarningsEvent } from "@/lib/api/types";

/** Link to a call's page (`/$ticker/earnings-calls/$eventId`, under the call's own symbol). */
export function EventLink({
    children,
    className,
    event,
}: {
    children: React.ReactNode;
    className?: string;
    event: Pick<EarningsEvent, "event_id" | "symbol">;
}) {
    return (
        <Link
            className={className}
            params={{ eventId: event.event_id, ticker: event.symbol }}
            to="/$ticker/earnings-calls/$eventId"
        >
            {children}
        </Link>
    );
}
