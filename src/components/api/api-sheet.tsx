import { QueryClientContext } from "@tanstack/react-query";
import { Braces, Download, ExternalLink } from "lucide-react";
import * as React from "react";

import type { ViewRequest } from "@/components/api/use-view-requests";
import type { RequestMeta } from "@/lib/api/request-meta";

import { JsonTree } from "@/components/api/json-tree";
import { useViewRequests } from "@/components/api/use-view-requests";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { TIER_BADGE_LABELS } from "@/components/ui/credit-hint";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ApiRequestError } from "@/lib/api/errors";
import { useApiBaseUrl } from "@/lib/api/queries";
import { cliOf, curlOf, operationOf, queryString } from "@/lib/api/request-meta";
import { saveJsonFile } from "@/lib/download";
import { formatNumber } from "@/lib/format";

/** The production API (the spec's `servers[0]`), shown until the server named its base URL. */
export const DEFAULT_API_BASE_URL = "https://api.data.invinite.com";

function CodeLine({ label, text }: { label: string; text: string }) {
    return (
        <div className="flex items-start gap-1">
            <pre className="min-w-0 grow overflow-x-auto rounded-md bg-muted px-2 py-1.5 font-mono text-[0.6875rem] whitespace-pre-wrap break-all">{text}</pre>
            <CopyButton className="mt-1" label={label} value={text} />
        </div>
    );
}

function costText(meta: RequestMeta) {
    const operation = operationOf(meta.operationId);

    const parts: Array<string> = [];

    if (operation?.credits != null) parts.push(`Base cost ${formatNumber(operation.credits)} ${operation.credits === 1 ? "credit" : "credits"}`);

    if (meta.credits !== null) parts.push(`charged ${formatNumber(meta.credits)}`);

    return parts.join(" · ");
}

function errorText(error: unknown) {
    if (error instanceof ApiRequestError) return `${error.status} ${error.reason ?? error.code}: ${error.message}`;

    return error instanceof Error ? error.message : "Request failed";
}

function AnswerBlock({ answer, fileStem }: { answer: unknown; fileStem: string }) {
    const [open, setOpen] = React.useState(false);

    const json = React.useMemo(() => (open ? JSON.stringify(answer, null, 2) : ""), [answer, open]);

    return (
        <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-1">
                <Button aria-expanded={open} onClick={() => setOpen(current => !current)} size="xs" type="button" variant="outline">
                    {open ? "Hide answer" : "Show answer (JSON)"}
                </Button>
                {open && (
                    <>
                        <CopyButton label="Copy the answer as JSON" value={json} />
                        <Button
                            aria-label="Download the answer as JSON"
                            onClick={() => saveJsonFile(answer, `${fileStem}.json`)}
                            size="icon-xs"
                            title="Download the answer as JSON"
                            type="button"
                            variant="ghost"
                        >
                            <Download />
                        </Button>
                    </>
                )}
            </div>
            {open && <JsonTree className="max-h-[50vh] overflow-auto rounded-md border p-2" value={answer} />}
        </div>
    );
}

function RequestCard({ baseUrl, request }: { baseUrl: string; request: ViewRequest }) {
    const { answer, error, meta } = request;

    const operation = operationOf(meta.operationId);

    const cli = cliOf(meta);

    const cost = costText(meta);

    const day = new Date().toISOString().slice(0, 10);

    return (
        <li className="flex flex-col gap-2 rounded-lg border p-3" data-testid="api-request">
            <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary">{meta.method}</Badge>
                <code className="font-mono break-all">{`${meta.path}${queryString(meta.query)}`}</code>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
                <span className="text-foreground">{operation?.summary ?? meta.operationId}</span>
                {operation?.tier && <Badge variant="outline">{TIER_BADGE_LABELS[operation.tier]}</Badge>}
                {cost && <span>{cost}</span>}
                {meta.status !== null && <span>{`HTTP ${meta.status}`}</span>}
            </div>
            {meta.requestId && (
                <div className="flex items-center gap-1 text-muted-foreground">
                    <span>Request id</span>
                    <code className="font-mono">{meta.requestId}</code>
                    <CopyButton label="Copy the request id" value={meta.requestId} />
                </div>
            )}
            {error !== null && error !== undefined && <p className="text-destructive">{errorText(error)}</p>}
            <CodeLine label="Copy curl" text={curlOf(baseUrl, meta)} />
            {cli && <CodeLine label="Copy the CLI command" text={cli} />}
            <div className="flex flex-wrap items-center gap-3">
                {operation && (
                    <a className="inline-flex items-center gap-1 underline-offset-2 hover:underline" href={operation.docsUrl} rel="noopener noreferrer" target="_blank">
                        {`Docs: ${meta.operationId}`}
                        <ExternalLink className="size-3" />
                    </a>
                )}
            </div>
            {answer !== undefined && <AnswerBlock answer={answer} fileStem={`${meta.operationId}-${day}`} />}
        </li>
    );
}

/**
 * The inspector's body (pure, tested): every request on screen with method + path + query, the operation's summary,
 * plan and cost, the request id, a `curl` with `$INVINITE_API_KEY` (never the stored key), the `invd` line, the docs
 * page and the raw answer.
 */
export function ApiRequestsView({ baseUrl, requests }: { baseUrl: string; requests: ReadonlyArray<ViewRequest> }) {
    if (requests.length === 0) {
        return <p className="text-muted-foreground">No Data API request on this page yet.</p>;
    }

    return (
        <ul className="flex flex-col gap-3">
            {requests.map(request => <RequestCard baseUrl={baseUrl} key={request.key} request={request} />)}
        </ul>
    );
}

function ApiSheetBody({ open }: { open: boolean }) {
    const requests = useViewRequests(open);

    const baseUrl = useApiBaseUrl() ?? DEFAULT_API_BASE_URL;

    return <ApiRequestsView baseUrl={baseUrl} requests={requests} />;
}

/**
 * The "API" button of every page (`PageHeader`) and, from O6-final, of each call tab: a side sheet listing the Data API
 * requests the view shows right now (`useViewRequests`). Renders nothing outside a query client (pure view tests).
 */
export function ApiButton() {
    const client = React.useContext(QueryClientContext);

    const [open, setOpen] = React.useState(false);

    if (!client) return null;

    return (
        <Sheet onOpenChange={setOpen} open={open}>
            <SheetTrigger render={<Button size="sm" type="button" variant="outline" />}>
                <Braces />
                API
            </SheetTrigger>
            <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
                <SheetHeader className="pb-2">
                    <SheetTitle>API requests on this page</SheetTitle>
                    <SheetDescription>
                        What this view asked the Data API, as sent. Set INVINITE_API_KEY in your shell to run a curl line.
                    </SheetDescription>
                </SheetHeader>
                <div className="min-h-0 grow overflow-y-auto px-6 pb-6">
                    {open && <ApiSheetBody open={open} />}
                </div>
            </SheetContent>
        </Sheet>
    );
}
