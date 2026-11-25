import { QueryClientContext } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { ChevronDown, ExternalLink, XIcon } from "lucide-react";
import * as React from "react";

import type { RowExpansion } from "@/components/api/request-row";
import type { ViewRequest } from "@/components/api/use-view-requests";

import { appSourcesOf, foldRuns, splitRequests } from "@/components/api/request-groups";
import { RequestRunRow } from "@/components/api/request-row";
import { useViewRequests } from "@/components/api/use-view-requests";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useApiBaseUrl } from "@/lib/api/queries";
import { snippetFormatLabel, snippetOf } from "@/lib/api/request-snippets";
import { docsUrl } from "@/lib/app-url";
import { formatNumber } from "@/lib/format";
import { DOCKED_PANEL_MIN_PX, useRequestPanelStore } from "@/lib/stores/request-panel-store";
import { cn } from "@/lib/utils";

/** The production API (the spec's `servers[0]`), shown until the server named its base URL. */
export const DEFAULT_API_BASE_URL = "https://api.data.invinite.com";

/** The panel element (`aria-controls` of the toggle). */
export const REQUEST_PANEL_ID = "request-panel";

/** The top bar's toggle: a closed sheet hands focus back to it. */
export const REQUEST_PANEL_TOGGLE_ID = "request-panel-toggle";

/** The docked panel's width, written as `--request-panel-width` on `<body>` while it is open. */
const DOCKED_WIDTH = "25rem";

/** Below this width the sheet comes up from the bottom (phone). */
const BOTTOM_SHEET_MAX_PX = 639;

// The stream's docs page, by the generator's docs rule (`<method>--<path, / → _>`) for the spec's `ws /v1/stream`.
const STREAM_DOCS_URL = `${docsUrl()}/ws--_v1_stream`;

const plural = (count: number, noun: string) => `${formatNumber(count)} ${noun}${count === 1 ? "" : "s"}`;

function useRowExpansion(firstKey: string | undefined): RowExpansion {
    // Keyed by `request.key` (query hash + page): a refetch or "Load more" keeps what is open.
    const [toggled, setToggled] = React.useState<Readonly<Record<string, boolean>>>({});

    const isExpanded = (request: ViewRequest) => toggled[request.key] ?? request.key === firstKey;

    return {
        isExpanded,
        toggle: request => setToggled(current => ({ ...current, [request.key]: !isExpanded(request) })),
    };
}

function RunList({ baseUrl, expansion, requests }: { baseUrl: string; expansion: RowExpansion; requests: ReadonlyArray<ViewRequest> }) {
    return (
        <ul>
            {foldRuns(requests).map(run => <RequestRunRow baseUrl={baseUrl} expansion={expansion} key={run.first.key} run={run} />)}
        </ul>
    );
}

/** A folded group under the page's requests ("App requests", "Writes"). */
function FoldedGroup({ baseUrl, expansion, hint, requests, title }: {
    baseUrl: string;
    expansion: RowExpansion;
    hint?: string;
    requests: ReadonlyArray<ViewRequest>;
    title: string;
}) {
    const [open, setOpen] = React.useState(false);

    return (
        <section className="border-t">
            <button
                aria-expanded={open}
                className="flex w-full items-baseline gap-2 px-3 py-2.5 text-left hover:bg-muted/50"
                onClick={() => setOpen(current => !current)}
                type="button"
            >
                <ChevronDown className={cn("size-3.5 shrink-0 self-center transition-transform", !open && "-rotate-90")} />
                <span className="font-medium">{`${title} (${formatNumber(requests.length)})`}</span>
                {hint && <span className="min-w-0 truncate text-xs text-muted-foreground">{hint}</span>}
            </button>
            {open && (
                <div className="border-t bg-muted/20">
                    <RunList baseUrl={baseUrl} expansion={expansion} requests={requests} />
                </div>
            )}
        </section>
    );
}

/**
 * The request panel's body (pure, tested): the page's own requests first (the first one expanded), the shell's folded
 * under "App requests", the writes under "Writes"; a summary line with the count, the credits charged and the API host,
 * and "Copy all as …" in the format the rows show (curl, CLI, Python, TypeScript). The key never appears: every format
 * reads `$INVINITE_API_KEY` / `INVINITE_API_KEY`.
 */
export function RequestPanelView({ baseUrl, onClose, pathname, requests }: {
    baseUrl: string;
    onClose?: () => void;
    pathname: string;
    requests: ReadonlyArray<ViewRequest>;
}) {
    const { app, page, writes } = React.useMemo(() => splitRequests(requests, pathname), [pathname, requests]);

    const expansion = useRowExpansion(page[0]?.key);

    const credits = page.reduce((sum, request) => sum + (request.meta.credits ?? 0), 0);

    const host = baseUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");

    const format = useRequestPanelStore(state => state.format);

    const formatLabel = snippetFormatLabel(format);

    const allCode = React.useMemo(() => snippetOf(format, baseUrl, page.map(request => request.meta)), [baseUrl, format, page]);

    return (
        <div className="flex min-h-full flex-col" data-testid="request-panel-view">
            <header className="flex flex-col gap-1 border-b px-3 pt-3 pb-2.5">
                <div className="flex items-center justify-between gap-2">
                    <h2 className="text-section">Requests on this page</h2>
                    <span className="flex shrink-0 items-center gap-1">
                        {page.length > 0 && (
                            <CopyButton label={`Copy all as ${formatLabel}`} value={allCode}>
                                {`Copy all as ${formatLabel}`}
                            </CopyButton>
                        )}
                        {onClose && (
                            <Button aria-label="Close the request panel" onClick={onClose} size="icon-sm" type="button" variant="ghost">
                                <XIcon />
                            </Button>
                        )}
                    </span>
                </div>
                <p className="text-xs text-muted-foreground" data-testid="request-panel-summary">
                    {`${plural(page.length, "request")} · ${plural(credits, "credit")} charged · `}
                    <span className="font-mono">{host}</span>
                </p>
            </header>
            {page.length === 0
                ? (
                        <div className="flex flex-col gap-1 px-3 py-6">
                            <p>This page has not asked the Data API yet.</p>
                            <p className="text-xs text-muted-foreground">
                                Each request it sends appears here as it is made, as curl, CLI, Python and TypeScript, with its cost and its answer.
                            </p>
                        </div>
                    )
                : <RunList baseUrl={baseUrl} expansion={expansion} requests={page} />}
            {app.length > 0 && (
                <FoldedGroup baseUrl={baseUrl} expansion={expansion} hint={appSourcesOf(app).join(", ")} requests={app} title="App requests" />
            )}
            {writes.length > 0 && <FoldedGroup baseUrl={baseUrl} expansion={expansion} requests={writes} title="Writes" />}
            <p className="mt-auto border-t px-3 py-2.5 text-xs text-muted-foreground">
                {"Live streams (WebSocket) are not listed here. "}
                <a className="inline-flex items-center gap-0.5 underline underline-offset-2" href={STREAM_DOCS_URL} rel="noopener noreferrer" target="_blank">
                    Stream docs
                    <ExternalLink className="size-3" />
                </a>
            </p>
        </div>
    );
}

function RequestPanelBody({ onClose, pathname }: { onClose: () => void; pathname: string }) {
    // Mounted only while the panel is open: the subscription runs then.
    const requests = useViewRequests(true);

    const baseUrl = useApiBaseUrl() ?? DEFAULT_API_BASE_URL;

    return <RequestPanelView baseUrl={baseUrl} onClose={onClose} pathname={pathname} requests={requests} />;
}

type PanelLayout = "bottom" | "docked" | "side";

const layoutOf = (width: number): PanelLayout => (width >= DOCKED_PANEL_MIN_PX ? "docked" : width <= BOTTOM_SHEET_MAX_PX ? "bottom" : "side");

/** The panel's presentation for the viewport; null on the server and the first client render. */
function usePanelLayout(): null | PanelLayout {
    const [layout, setLayout] = React.useState<null | PanelLayout>(null);

    React.useEffect(() => {
        const queries = [`(min-width: ${DOCKED_PANEL_MIN_PX}px)`, `(max-width: ${BOTTOM_SHEET_MAX_PX}px)`].map(query => window.matchMedia(query));

        const read = () => setLayout(layoutOf(window.innerWidth));

        read();

        for (const query of queries) query.addEventListener("change", read);

        return () => {
            for (const query of queries) query.removeEventListener("change", read);
        };
    }, []);

    return layout;
}

function RequestPanelHost() {
    const open = useRequestPanelStore(state => state.hasHydrated && state.open);

    const setOpen = useRequestPanelStore(state => state.setOpen);

    const layout = usePanelLayout();

    const pathname = useRouterState({ select: state => state.location.pathname });

    const docked = open && layout === "docked";

    const close = () => setOpen(false);

    // The content column steps aside by the docked panel's width (`xl:pr-(--request-panel-width)` in `__root.tsx`).
    React.useEffect(() => {
        if (!docked) return;

        document.body.style.setProperty("--request-panel-width", DOCKED_WIDTH);

        return () => document.body.style.setProperty("--request-panel-width", "0px");
    }, [docked]);

    // Narrowing a window with the docked panel open closes it: a sheet never opens by itself.
    const previous = React.useRef(layout);

    React.useEffect(() => {
        if (previous.current === "docked" && layout !== "docked" && layout !== null) setOpen(false);

        previous.current = layout;
    }, [layout, setOpen]);

    if (layout === null) return null;

    if (layout === "docked") {
        if (!open) return null;

        // A complementary landmark beside the page: it takes no focus when it opens.
        return (
            <aside
                aria-label="API requests of this page"
                className="fixed top-(--app-topbar-height) right-0 bottom-0 z-20 w-[25rem] overflow-y-auto overscroll-contain border-l bg-background animate-in slide-in-from-right duration-[160ms] print:hidden"
                data-testid="request-panel-docked"
                id={REQUEST_PANEL_ID}
            >
                <RequestPanelBody onClose={close} pathname={pathname} />
            </aside>
        );
    }

    const bottom = layout === "bottom";

    return (
        <Sheet onOpenChange={next => !next && close()} open={open}>
            <SheetContent
                aria-label="API requests of this page"
                className={cn(
                    "gap-0 print:hidden",
                    bottom
                        ? "data-[side=bottom]:h-[85svh] rounded-t-xl"
                        : "data-[side=right]:w-full data-[side=right]:sm:max-w-md",
                )}
                finalFocus={() => document.getElementById(REQUEST_PANEL_TOGGLE_ID)}
                id={REQUEST_PANEL_ID}
                showCloseButton={false}
                side={bottom ? "bottom" : "right"}
            >
                {bottom && <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />}
                <div className="min-h-0 grow overflow-y-auto overscroll-contain">
                    {open && <RequestPanelBody onClose={close} pathname={pathname} />}
                </div>
            </SheetContent>
        </Sheet>
    );
}

/**
 * The request panel (ui-redesign task 3), opened by the top bar's `RequestPanelToggle`: docked beside the page from
 * 1280 px, a right sheet from 640 px, a bottom sheet below. Renders nothing outside a query client.
 */
export function RequestPanel() {
    const client = React.useContext(QueryClientContext);

    return client ? <RequestPanelHost /> : null;
}
