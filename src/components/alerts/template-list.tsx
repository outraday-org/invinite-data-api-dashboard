import { Link } from "@tanstack/react-router";

import type { AlertTemplate } from "@/lib/api/types";

import { AlertsState } from "@/components/alerts/alert-parts";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { defaultText, FIDELITY_MEANING, inputRangeText } from "@/lib/alerts/scripts";

/**
 * The built-in indicator templates (`GET /v1/alert-templates`, pure): title, key and version, what it alerts on, its
 * fidelity with the spec's one-line meaning, every input with its default and bounds, the chartlang source on request,
 * and "Use template" → the alert form pre-filled with type `indicator` and this template.
 */
export function TemplateListView({ error, isLoading, templates }: { error: unknown; isLoading: boolean; templates: ReadonlyArray<AlertTemplate> }) {
    if (error && templates.length === 0) return <AlertsState error={error} title="Failed to load the templates" />;

    if (isLoading && templates.length === 0) return <Skeleton className="h-40 w-full" />;

    if (templates.length === 0) return <p className="text-muted-foreground">The API lists no template.</p>;

    return (
        <ul className="grid gap-3 md:grid-cols-2" data-testid="templates">
            {templates.map(template => (
                <li className="flex min-w-0 flex-col gap-3 rounded-xl border p-4" key={template.key}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-col">
                            <h3 className="text-sm font-semibold">{template.title}</h3>
                            <span className="font-mono text-muted-foreground">{`${template.key} · v${template.version}`}</span>
                        </div>
                        <Link className={buttonVariants({ size: "sm" })} search={{ template: template.key, type: "indicator" }} to="/alerts/new">Use template</Link>
                    </div>
                    <p>{template.description}</p>
                    <p className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{`Fidelity: ${template.fidelity}`}</Badge>
                        <span className="text-muted-foreground">{FIDELITY_MEANING[template.fidelity]}</span>
                    </p>
                    {template.inputs.length > 0
                        ? (
                                <table className="w-full text-left">
                                    <thead className="text-muted-foreground">
                                        <tr>
                                            <th className="py-1 pr-3 font-medium">Input</th>
                                            <th className="py-1 pr-3 font-medium">Kind</th>
                                            <th className="py-1 pr-3 font-medium">Default</th>
                                            <th className="py-1 font-medium">Bounds / options</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {template.inputs.map(input => (
                                            <tr className="border-t" key={input.name}>
                                                <td className="py-1 pr-3">{input.title}</td>
                                                <td className="py-1 pr-3">{input.kind}</td>
                                                <td className="py-1 pr-3 font-mono">{defaultText(input.default)}</td>
                                                <td className="py-1">{inputRangeText(input) || "—"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )
                        : <p className="text-muted-foreground">No inputs.</p>}
                    <details>
                        <summary className="cursor-pointer text-muted-foreground">{`Source (${template.source_key})`}</summary>
                        <pre className="mt-2 max-h-64 overflow-auto rounded-lg border bg-muted/30 p-2 font-mono text-xs">{template.source}</pre>
                    </details>
                </li>
            ))}
        </ul>
    );
}
