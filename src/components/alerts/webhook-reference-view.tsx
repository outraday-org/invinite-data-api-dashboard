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
                <thead className="bg-muted/40 text-muted-foreground text-xs">
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
        <section aria-labelledby={`webhook-${entry.type}`} className="flex scroll-mt-24 flex-col gap-3 border-t pt-6" data-testid="webhook-entry" id={`webhook-${entry.type}-section`}>
            <h3 className="text-section font-mono" id={`webhook-${entry.type}`}>{entry.type}</h3>
            <div className="flex flex-col gap-0.5">
                <p className="text-muted-foreground text-xs font-medium">When it is sent</p>
                <p className="text-sm">{entry.description}</p>
            </div>
            <div className="flex flex-col gap-1">
                <p className="text-muted-foreground text-xs font-medium">
                    <span className="font-mono">data</span>
                    {" fields (* required)"}
                </p>
                <FieldTable label={`${entry.type} data fields`} schema={entry.data} />
            </div>
            <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-1">
                    <p className="text-muted-foreground text-xs font-medium">Example body</p>
                    <Badge variant="outline">built from the schema: required fields</Badge>
                    <CopyButton label={`Copy the ${entry.type} example`} value={example} />
                </div>
                <JsonTree className="bg-muted/30 max-h-80 overflow-auto rounded-md border p-2" value={exampleBody(entry)} />
            </div>
        </section>
    );
}

/** Request headers and acknowledgement as the spec states them (the same for every type: shown once, from the first). */
function DeliveryRules({ entry }: { entry: WebhookEntry }) {
    return (
        <section aria-labelledby="webhook-delivery" className="flex scroll-mt-24 flex-col gap-2 border-t pt-6" id="webhook-delivery-section">
            <h3 className="text-section" id="webhook-delivery">Signature and retries</h3>
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
            <p className="text-muted-foreground mt-2 text-xs font-medium">Your answer</p>
            <ul>
                {entry.acknowledgement.map(line => <li key={line}>{line}</li>)}
            </ul>
        </section>
    );
}

/**
 * The webhook reference (pure; `/alerts/webhooks`; ui-redesign task 13: from `lg` the types are a sticky list of
 * in-page anchors on the left, the reference on the right; one column below): rendered from the pinned spec's `x-webhooks` (generated at build
 * time into `WEBHOOKS` / `WEBHOOK_ENVELOPE`). The envelope, the signature headers and the acknowledgement once, then per
 * type: when it is sent, its `data` fields and an example body BUILT FROM THE SCHEMA (the spec gives none) — nothing the
 * spec does not state.
 */
export function WebhookReferenceView({ envelope, webhooks }: { envelope: WebhookSchema; webhooks: ReadonlyArray<WebhookEntry> }) {
    if (webhooks.length === 0) return <p className="text-muted-foreground">The pinned spec lists no webhook payloads.</p>;

    return (
        <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
            <nav aria-label="Webhook types" className="lg:sticky lg:top-[calc(var(--app-topbar-height,0px)+1.5rem)] lg:self-start">
                <ul className="flex flex-wrap gap-1 lg:flex-col lg:gap-0.5">
                    <li><a className="hover:bg-muted block rounded-md px-2 py-1 max-sm:py-2" href="#webhook-envelope-section">Envelope</a></li>
                    <li><a className="hover:bg-muted block rounded-md px-2 py-1 max-sm:py-2" href="#webhook-delivery-section">Signature and retries</a></li>
                    {webhooks.map(entry => (
                        <li key={entry.type}>
                            <a className="hover:bg-muted block rounded-md px-2 py-1 font-mono max-sm:py-2" href={`#webhook-${entry.type}-section`}>{entry.type}</a>
                        </li>
                    ))}
                </ul>
            </nav>
            <div className="flex min-w-0 flex-col gap-6">
                <section aria-labelledby="webhook-envelope" className="flex scroll-mt-24 flex-col gap-2" id="webhook-envelope-section">
                    <h3 className="text-section" id="webhook-envelope">The envelope (every body)</h3>
                    <FieldTable label="Envelope fields" schema={envelope} />
                </section>
                <DeliveryRules entry={webhooks[0]} />
                {webhooks.map(entry => <WebhookCard entry={entry} key={entry.type} />)}
            </div>
        </div>
    );
}
