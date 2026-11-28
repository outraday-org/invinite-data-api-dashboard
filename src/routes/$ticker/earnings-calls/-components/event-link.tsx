import type * as React from "react";

import { Link } from "@tanstack/react-router";

import type { V2Event } from "@/lib/api/types";

/** Link to a call's page (`/$ticker/earnings-calls/$eventId`, under the call's own symbol unless a historical subject retains its page scope). */
export function EventLink({
    children,
    className,
    event,
    ticker,
}: {
    children: React.ReactNode;
    className?: string;
    event: Pick<V2Event, "event_id" | "symbol">;
    ticker?: string;
}) {
    return (
        <Link
            className={className}
            params={{ eventId: event.event_id, ticker: ticker ?? event.symbol }}
            to="/$ticker/earnings-calls/$eventId"
        >
            {children}
        </Link>
    );
}
