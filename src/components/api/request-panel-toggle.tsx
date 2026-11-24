import { QueryClientContext } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { Braces } from "lucide-react";
import * as React from "react";

import { REQUEST_PANEL_ID, REQUEST_PANEL_TOGGLE_ID } from "@/components/api/request-panel";
import { useViewRequestCount } from "@/components/api/use-view-requests";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatNumber } from "@/lib/format";
import { useRequestPanelStore } from "@/lib/stores/request-panel-store";

/** The key that toggles the panel (outside text fields, without modifiers). */
const REQUEST_PANEL_SHORTCUT = ".";

/** Whether a key press belongs to a text field / select / editable element (the shortcut then stays a character). */
function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;

    return target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName);
}

/** The number of the page's requests beside "API" (subscribed on its own: it re-renders only when the number changes). */
function RequestCount({ pathname }: { pathname: string }) {
    const count = useViewRequestCount(pathname);

    if (count === 0) return null;

    return (
        <span className="min-w-4 rounded-sm bg-muted px-1 font-mono text-xs tabular-nums text-muted-foreground" data-testid="request-count">
            {formatNumber(count)}
        </span>
    );
}

function RequestPanelToggleButton() {
    const open = useRequestPanelStore(state => state.hasHydrated && state.open);

    const toggle = useRequestPanelStore(state => state.toggle);

    const pathname = useRouterState({ select: state => state.location.pathname });

    // The stored choice applies after mount (server and first client render are closed).
    React.useEffect(() => {
        void useRequestPanelStore.persist.rehydrate();
    }, []);

    const onKeyDown = React.useEffectEvent((event: KeyboardEvent) => {
        if (event.key !== REQUEST_PANEL_SHORTCUT || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;

        if (isEditableTarget(event.target)) return;

        event.preventDefault();

        toggle();
    });

    React.useEffect(() => {
        const listener = (event: KeyboardEvent) => onKeyDown(event);

        window.addEventListener("keydown", listener);

        return () => window.removeEventListener("keydown", listener);
    }, []);

    const label = open ? "Hide the API requests of this page" : "Show the API requests of this page";

    return (
        <Tooltip>
            <TooltipTrigger
                render={(
                    <Button
                        aria-controls={REQUEST_PANEL_ID}
                        aria-label={label}
                        aria-pressed={open}
                        className="aria-pressed:bg-muted aria-pressed:text-foreground"
                        id={REQUEST_PANEL_TOGGLE_ID}
                        onClick={toggle}
                        size="sm"
                        type="button"
                        variant="outline"
                    />
                )}
            >
                <Braces />
                <span className="hidden sm:inline">API</span>
                <RequestCount pathname={pathname} />
            </TooltipTrigger>
            <TooltipContent side="bottom">
                {`${open ? "Hide" : "Show"} the requests of this page · press ${REQUEST_PANEL_SHORTCUT}`}
            </TooltipContent>
        </Tooltip>
    );
}

/**
 * The request panel's toggle at the right end of the top bar (every page, the onboarding card's too): `{ }` + "API"
 * from `sm` + the count of the page's requests, `aria-pressed`, and the `.` shortcut. Nothing outside a query client.
 */
export function RequestPanelToggle() {
    const client = React.useContext(QueryClientContext);

    return client ? <RequestPanelToggleButton /> : null;
}
