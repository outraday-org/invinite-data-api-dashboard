import type { ColumnDef } from "@tanstack/react-table";

import { Link } from "@tanstack/react-router";

import type { V2AlertTypeCatalogEntry, V2DividendTypeCatalogEntry, V2HaltReasonCatalogEntry, V2NewsKindCatalogEntry } from "@/lib/api/types";

import { ALERT_TYPES } from "@/lib/alerts/labels";

const linkClass = "text-primary underline-offset-4 hover:underline";

/** Event-level plans stay available without making one long vocabulary dominate the catalog. */
function EventPlans({ events }: { events: V2AlertTypeCatalogEntry["events"] }) {
    if (events.length === 0) return "—";

    return (
        <details>
            <summary className="text-primary cursor-pointer">{`${events.length} event plans`}</summary>
            <dl className="mt-1 max-w-64 space-y-1 text-xs">
                {events.map(event => (
                    <div key={event.event}>
                        <dt className="font-mono break-words">{event.event}</dt>
                        <dd>{event.minimum_tier}</dd>
                    </div>
                ))}
            </dl>
        </details>
    );
}

export const ALERT_TYPE_CATALOG_COLUMNS: Array<ColumnDef<V2AlertTypeCatalogEntry>> = [
    { cell: ({ row }) => {
        const type = ALERT_TYPES.find(value => value === row.original.type);

        return type ? <Link className={`${linkClass} font-mono text-xs`} search={{ type }} to="/alerts/new">{type}</Link> : row.original.type;
    }, header: "Type", id: "type" },
    { cell: ({ row }) => (
        <div className="max-w-72 whitespace-normal">
            <span className="font-medium">{row.original.name}</span>
            <p className="text-muted-foreground text-xs">{row.original.description}</p>
        </div>
    ), header: "Name", id: "name" },
    { accessorKey: "family", header: "Family" },
    { cell: ({ row }) => <div className="max-w-48 whitespace-normal">{`${row.original.subjects.kind} · ${row.original.subjects.asset_classes.join(", ") || "no assets"} · ETF ${row.original.subjects.etf ? "yes" : "no"} · max ${row.original.subjects.max}`}</div>, header: "Subjects", id: "subjects" },
    { accessorKey: "coverage", header: "Coverage" },
    { cell: ({ row }) => <span className="font-mono text-xs whitespace-normal">{row.original.required.join(", ") || "None (see cross-field rules)"}</span>, header: "Required fields", id: "required" },
    { accessorKey: "minimum_tier", header: "Minimum tier" },
    { cell: ({ row }) => <EventPlans events={row.original.events} />, header: "Plan per event", id: "events" },
    { cell: ({ row }) => ALERT_TYPES.some(type => type === row.original.type) ? <Link className={linkClass} hash={`webhook-alert.fired-${row.original.type}`} search={{ type: row.original.type }} to="/alerts/webhooks">Webhook</Link> : "—", header: "Payload", id: "payload" },
];

export const NEWS_KIND_CATALOG_COLUMNS: Array<ColumnDef<V2NewsKindCatalogEntry>> = [
    { accessorKey: "value", header: "Value" },
    { accessorKey: "group", header: "Group" },
    { accessorKey: "name", header: "Name" },
    { accessorKey: "description", cell: ({ row }) => <div className="max-w-xl whitespace-normal">{row.original.description}</div>, header: "Description" },
];

export const HALT_REASON_CATALOG_COLUMNS: Array<ColumnDef<V2HaltReasonCatalogEntry>> = [
    { accessorKey: "code", header: "Code" },
    { accessorKey: "name", header: "Name" },
    { cell: ({ row }) => row.original.markets.join(", "), header: "Markets", id: "markets" },
    { accessorKey: "description", cell: ({ row }) => <div className="max-w-xl whitespace-normal">{row.original.description}</div>, header: "Description" },
];

export const DIVIDEND_TYPE_CATALOG_COLUMNS: Array<ColumnDef<V2DividendTypeCatalogEntry>> = [
    { accessorKey: "code", header: "Code" },
    { accessorKey: "name", header: "Name" },
    { accessorKey: "description", cell: ({ row }) => <div className="max-w-xl whitespace-normal">{row.original.description}</div>, header: "Description" },
];
