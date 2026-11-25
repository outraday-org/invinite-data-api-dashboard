import { ChevronDown, Download, ExternalLink } from "lucide-react";
import * as React from "react";

import type { RequestRun } from "@/components/api/request-groups";
import type { ViewRequest } from "@/components/api/use-view-requests";
import type { RequestMeta } from "@/lib/api/request-meta";
import type { SnippetFormat } from "@/lib/api/request-snippets";

import { JsonTree } from "@/components/api/json-tree";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { TIER_BADGE_LABELS } from "@/components/ui/credit-hint";
import { ApiRequestError } from "@/lib/api/errors";
import { operationOf, queryString } from "@/lib/api/request-meta";
import { hasSnippet, SNIPPET_FORMATS, snippetFormatLabel, snippetOf } from "@/lib/api/request-snippets";
import { saveJsonFile } from "@/lib/download";
import { formatNumber } from "@/lib/format";
import { useRequestPanelStore } from "@/lib/stores/request-panel-store";
import { cn } from "@/lib/utils";

/** Whether a row is expanded, and how to change it (local to the panel, keyed by `request.key`). */
export type RowExpansion = {
    isExpanded: (request: ViewRequest) => boolean;
    toggle: (request: ViewRequest) => void;
};

function errorText(error: unknown) {
    if (error instanceof ApiRequestError) return `${error.status} ${error.reason ?? error.code}: ${error.message}`;

    return error instanceof Error ? error.message : "Request failed";
}

/** The problem code of a failed request (`plan_required`, `not_found`, …); null otherwise. */
function problemCode(error: unknown): null | string {
    return error instanceof ApiRequestError ? error.reason ?? error.code : null;
}

/** GET in the brand colour, a write in a strong neutral chip: the method is always written out. */
function MethodChip({ method }: { method: RequestMeta["method"] }) {
    return (
        <span
            className={cn(
                "inline-flex h-5 min-w-11 shrink-0 items-center justify-center rounded-sm px-1.5 font-mono text-xs font-medium",
                method === "GET" ? "bg-brand/12 text-brand" : "bg-foreground text-background",
            )}
        >
            {method}
        </span>
    );
}

function StatusText({ error, status }: { error: unknown; status: null | number }) {
    if (status === null && !error) return null;

    const failed = (status !== null && status >= 400) || (error !== null && error !== undefined);

    const code = failed ? problemCode(error) : null;

    return (
        <span className={cn("font-mono text-xs tabular-nums", failed ? "text-destructive" : "text-muted-foreground")}>
            {status ?? "—"}
            {code && ` ${code}`}
        </span>
    );
}

function CreditsText({ meta }: { meta: RequestMeta }) {
    if (meta.credits === null) return null;

    const base = operationOf(meta.operationId)?.credits ?? null;

    const above = base !== null && meta.credits > base;

    return (
        <span
            className={cn("font-mono text-xs tabular-nums", above ? "text-warn" : "text-muted-foreground")}
            title={`${formatNumber(meta.credits)} ${meta.credits === 1 ? "credit" : "credits"} charged${base === null ? "" : ` (base cost ${formatNumber(base)})`}`}
        >
            {`${formatNumber(meta.credits)}c`}
        </span>
    );
}

function CodeBlock({ label, text }: { label: string; text: string }) {
    return (
        <div className="flex items-start gap-1">
            <pre className="min-w-0 grow rounded-md bg-muted px-2 py-1.5 font-mono text-xs whitespace-pre-wrap break-all">{text}</pre>
            <CopyButton className="mt-1" label={label} value={text} />
        </div>
    );
}

function AnswerBlock({ answer, fileStem }: { answer: unknown; fileStem: string }) {
    const json = React.useMemo(() => JSON.stringify(answer, null, 2), [answer]);

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center justify-end gap-1">
                <CopyButton label="Copy the response as JSON" value={json} />
                <Button
                    aria-label="Download the response as JSON"
                    onClick={() => saveJsonFile(answer, `${fileStem}.json`)}
                    size="icon-xs"
                    title="Download the response as JSON"
                    type="button"
                    variant="ghost"
                >
                    <Download />
                </Button>
            </div>
            <JsonTree className="max-h-[50vh] overflow-auto rounded-md border p-2 text-xs" value={answer} />
        </div>
    );
}

/** Why a request has no code in a format. */
function missingText(format: SnippetFormat) {
    return format === "cli" ? "This operation has no CLI command." : `This operation is not in the ${snippetFormatLabel(format)} SDK.`;
}

/**
 * The expanded part of a row: curl | CLI | Python | TypeScript | Response (one at a time), request id, docs link, the
 * error of a failed one. The code format is the panel's (`useRequestPanelStore().format`): picking one in a row picks it
 * for every row and for "Copy all as …"; Response is this row's alone.
 */
function RequestDetails({ baseUrl, request }: { baseUrl: string; request: ViewRequest }) {
    const { answer, error, meta } = request;

    const operation = operationOf(meta.operationId);

    const format = useRequestPanelStore(state => state.format);

    const setFormat = useRequestPanelStore(state => state.setFormat);

    const [answerShown, setAnswerShown] = React.useState(false);

    const showAnswer = answerShown && answer !== undefined;

    const day = new Date().toISOString().slice(0, 10);

    const tabClass = "rounded-sm px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground aria-pressed:bg-muted aria-pressed:font-medium aria-pressed:text-foreground";

    return (
        <div className="flex flex-col gap-2 pt-1 pb-3 pl-13 pr-3" data-testid="api-request-details">
            {error !== null && error !== undefined && <p className="text-destructive">{errorText(error)}</p>}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div aria-label="Show the request as" className="inline-flex flex-wrap rounded-md border p-0.5" role="group">
                    {SNIPPET_FORMATS.map(item => (
                        <button
                            aria-pressed={!showAnswer && format === item.value}
                            className={tabClass}
                            key={item.value}
                            onClick={() => {
                                setFormat(item.value);

                                setAnswerShown(false);
                            }}
                            type="button"
                        >
                            {item.label}
                        </button>
                    ))}
                    {answer !== undefined && (
                        <button aria-pressed={showAnswer} className={tabClass} onClick={() => setAnswerShown(true)} type="button">
                            Response
                        </button>
                    )}
                </div>
                {operation && (
                    <a className="inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline" href={operation.docsUrl} rel="noopener noreferrer" target="_blank">
                        Docs
                        <ExternalLink className="size-3" />
                        <span className="sr-only">{`: ${meta.operationId}`}</span>
                    </a>
                )}
            </div>
            {showAnswer
                ? <AnswerBlock answer={answer} fileStem={`${meta.operationId}-${day}`} />
                : hasSnippet(meta, format)
                    ? <CodeBlock label={format === "cli" ? "Copy the CLI command" : `Copy ${snippetFormatLabel(format)}`} text={snippetOf(format, baseUrl, [meta])} />
                    : <p className="text-xs text-muted-foreground">{missingText(format)}</p>}
            {meta.requestId && (
                <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                    <span className="shrink-0">Request id</span>
                    <code className="truncate font-mono text-foreground">{meta.requestId}</code>
                    <CopyButton label="Copy the request id" value={meta.requestId} />
                </div>
            )}
        </div>
    );
}

/**
 * One request: a collapsed row (method, path + query, status, credits charged, summary + plan) that is a button, and its
 * details once expanded. `label` marks a later page of a folded run ("page 2").
 */
export function RequestRow({ baseUrl, expansion, label, request }: { baseUrl: string; expansion: RowExpansion; label?: string; request: ViewRequest }) {
    const { error, meta } = request;

    const operation = operationOf(meta.operationId);

    const query = queryString(meta.query);

    const expanded = expansion.isExpanded(request);

    return (
        <li className="border-b last:border-b-0" data-testid="api-request">
            <button
                aria-expanded={expanded}
                className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-muted/50"
                onClick={() => expansion.toggle(request)}
                type="button"
            >
                <MethodChip method={meta.method} />
                <span className="flex min-w-0 grow flex-col gap-0.5">
                    <span className="flex items-start justify-between gap-2">
                        <code className="min-w-0 font-mono text-xs font-medium break-all">
                            {meta.path}
                            {label && <span className="font-sans font-normal text-muted-foreground">{` (${label})`}</span>}
                        </code>
                        <span className="flex shrink-0 items-center gap-2">
                            <StatusText error={error} status={meta.status} />
                            <CreditsText meta={meta} />
                        </span>
                    </span>
                    {query && <code className="font-mono text-xs break-all text-muted-foreground">{query}</code>}
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {operation && <span className="min-w-0 truncate">{operation.summary}</span>}
                        {operation?.tier && <Badge className="px-1.5" variant="outline">{TIER_BADGE_LABELS[operation.tier]}</Badge>}
                        <ChevronDown className={cn("ml-auto size-3.5 shrink-0 transition-transform", expanded && "rotate-180")} />
                    </span>
                </span>
            </button>
            {expanded && <RequestDetails baseUrl={baseUrl} request={request} />}
        </li>
    );
}

/** A run of one method + path: its first request, then a disclosure with the others ("3 more pages"). */
export function RequestRunRow({ baseUrl, expansion, run }: { baseUrl: string; expansion: RowExpansion; run: RequestRun }) {
    const [open, setOpen] = React.useState(false);

    if (run.rest.length === 0) return <RequestRow baseUrl={baseUrl} expansion={expansion} request={run.first} />;

    const noun = run.sameQuery ? "page" : "request";

    const more = `${run.rest.length} more ${noun}${run.rest.length === 1 ? "" : "s"}`;

    return (
        <>
            <RequestRow baseUrl={baseUrl} expansion={expansion} label={run.sameQuery ? "page 1" : undefined} request={run.first} />
            <li className="border-b last:border-b-0">
                <button
                    aria-expanded={open}
                    className="flex w-full items-center gap-1 py-1.5 pl-13 pr-3 text-left text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    onClick={() => setOpen(current => !current)}
                    type="button"
                >
                    <ChevronDown className={cn("size-3.5 transition-transform", !open && "-rotate-90")} />
                    {more}
                </button>
                {open && (
                    <ul className="border-t bg-muted/20">
                        {run.rest.map((request, index) => (
                            <RequestRow
                                baseUrl={baseUrl}
                                expansion={expansion}
                                key={request.key}
                                label={run.sameQuery ? `page ${index + 2}` : undefined}
                                request={request}
                            />
                        ))}
                    </ul>
                )}
            </li>
        </>
    );
}
