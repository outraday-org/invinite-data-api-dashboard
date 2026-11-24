import type { ReactNode } from "react";

import { useQueryClient } from "@tanstack/react-query";

import { OnboardingCard } from "@/components/api-key/onboarding-card";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";
import { ME_QUERY_KEY, useKeyState } from "@/lib/api/queries";

export type MacroAccess = "available" | "checking" | "invalid" | "not-advertised" | "unavailable";

/** The Free macro catalog makes Macro reachable on every key once its API serves the contract. */
export function useMacroAccess(): MacroAccess {
    const { me, state } = useKeyState();

    if (state !== "ready") return state;

    return Array.isArray(me?.allowed_families) && me.allowed_families.includes("Macro") ? "available" : "not-advertised";
}

export function MacroAvailabilityNotice({ access}: { access: Exclude<MacroAccess, "available"> }) {
    const client = useQueryClient();

    if (access === "checking") return (
        <div role="status">
            <span className="sr-only">Checking macro availability</span>
            <Skeleton className="h-20 w-full" />
        </div>
    );

    if (access === "invalid") return <OnboardingCard refused />;

    return (
        <Notice title={access === "not-advertised" ? "US macro data is not available on this API yet" : "Unable to check US macro availability"}>
            <p>{access === "not-advertised" ? "Your connected API does not currently list Macro in your account’s available data families." : "Your account status could not be loaded."}</p>
            <Button className="mt-2" onClick={() => void client.invalidateQueries({ queryKey: ME_QUERY_KEY })} type="button" variant="outline">Check again</Button>
        </Notice>
    );
}

export function MacroAvailability({ children}: { children: ReactNode }) {
    const access = useMacroAccess();

    return access === "available" ? children : <MacroAvailabilityNotice access={access} />;
}
