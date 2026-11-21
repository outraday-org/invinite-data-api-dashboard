import type { WebhookEntry, WebhookSchema } from "@/lib/alerts/webhooks";

import { JsonTree } from "@/components/api/json-tree";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { exampleBody, fieldRows, typeText } from "@/lib/alerts/webhooks";

/** A schema's fields as a table: path (indented by depth), type, required, the spec's description. */
function FieldTable({ label, schema }: { label: string; schema: WebhookSchema }) {
    const rows = fieldRows(schema);

    if (rows.length === 0) return <p className="text-muted-foreground">{schema.additionalProperties ? "A free JSON object." : "No fields."}</p>;

    return (
        <div className="overflow-x-auto rounded-md border">
            <table aria-label={label} className="w-full min-w-[560px] text-left">
                <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                        <th className="px-2 py-1 font-medium">Field</th>
                        <th className="px-2 py-1 font-medium">Type</th>
                        <th className="px-2 py-1 font-medium">Description</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(row => (
                        <tr className="border-t align-top" key={row.path}>
                            <td className="px-2 py-1 font-mono whitespace-nowrap" style={{ paddingLeft: `${0.5 + row.depth}rem` }}>
                                {row.path}
                                {row.required && <span className="ml-1 text-destructive" title="Required">*</span>}
                            </td>
                            <td className="px-2 py-1 font-mono text-muted-foreground">{typeText(row.schema)}</td>
                            <td className="px-2 py-1">{row.schema.description ?? ""}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function WebhookCard({ entry }: { entry: WebhookEntry }) {
    const example = JSON.stringify(exampleBody(entry), null, 2);

    return (
        <section aria-labelledby={`webhook-${entry.type}`} className="flex flex-col gap-3 rounded-xl border p-4" data-testid="webhook-entry">
            <h3 className="font-mono text-sm font-semibold" id={`webhook-${entry.type}`}>{entry.type}</h3>
            <div>
                <p className="font-medium">When it is sent</p>
                <p>{entry.description}</p>
            </div>
            <div className="flex flex-col gap-1">
                <p className="font-medium">
                    <span className="font-mono">data</span>
                    {" fields "}
                    <span className="text-muted-foreground">(* required)</span>
                </p>
                <FieldTable label={`${entry.type} data fields`} schema={entry.data} />
            </div>
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1">
                    <p className="font-medium">Example body</p>
                    <Badge variant="outline">built from the schema: required fields</Badge>
                    <CopyButton label={`Copy the ${entry.type} example`} value={example} />
                </div>
                <JsonTree className="max-h-80 overflow-auto rounded-md border p-2" value={exampleBody(entry)} />
            </div>
        </section>
    );
}

/** Request headers and acknowledgement as the spec states them (the same for every type: shown once, from the first). */
function DeliveryRules({ entry }: { entry: WebhookEntry }) {
    return (
        <section aria-labelledby="webhook-delivery" className="flex flex-col gap-2 rounded-xl border p-4">
            <h3 className="text-sm font-semibold" id="webhook-delivery">Signature and retries</h3>
            <p className="text-muted-foreground">Every webhook is a POST with a JSON body and these headers:</p>
            <ul className="flex flex-col gap-1">
                {entry.headers.map(header => (
                    <li key={header.name}>
                        <span className="font-mono font-medium">{header.name}</span>
                        {header.required ? "" : " (optional)"}
                        {": "}
                        {header.description}
                    </li>
                ))}
            </ul>
            <p className="font-medium">Your answer</p>
            <ul>
                {entry.acknowledgement.map(line => <li key={line}>{line}</li>)}
            </ul>
        </section>
    );
}

/**
 * The webhook reference (pure; `/alerts/webhooks`): rendered from the pinned spec's `x-webhooks` (generated at build
 * time into `WEBHOOKS` / `WEBHOOK_ENVELOPE`). The envelope, the signature headers and the acknowledgement once, then per
 * type: when it is sent, its `data` fields and an example body BUILT FROM THE SCHEMA (the spec gives none) — nothing the
 * spec does not state.
 */
export function WebhookReferenceView({ envelope, webhooks }: { envelope: WebhookSchema; webhooks: ReadonlyArray<WebhookEntry> }) {
    if (webhooks.length === 0) return <p className="text-muted-foreground">The pinned spec lists no webhook payloads.</p>;

    return (
        <div className="flex flex-col gap-4">
            <nav aria-label="Webhook types" className="flex flex-wrap gap-1">
                {webhooks.map(entry => (
                    <a className="rounded-md border px-2 py-1 font-mono hover:bg-muted" href={`#webhook-${entry.type}`} key={entry.type}>{entry.type}</a>
                ))}
            </nav>
            <section aria-labelledby="webhook-envelope" className="flex flex-col gap-2 rounded-xl border p-4">
                <h3 className="text-sm font-semibold" id="webhook-envelope">The envelope (every body)</h3>
                <FieldTable label="Envelope fields" schema={envelope} />
            </section>
            <DeliveryRules entry={webhooks[0]} />
            {webhooks.map(entry => <WebhookCard entry={entry} key={entry.type} />)}
        </div>
    );
}
