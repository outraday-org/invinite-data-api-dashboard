import type * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { useKeyState } from "@/lib/api/queries";

import { OnboardingCard } from "./onboarding-card";

/**
 * The global key gate (root layout): a page renders only once the key answered `GET /v1/me` (0 credits). No key (a 401
 * answered without a network call) or a refused key → the onboarding card instead of page errors and toasts. Any other
 * failure of `/v1/me` lets the page render with its own error states.
 */
export function KeyGate({ children }: { children: React.ReactNode }) {
    const { state } = useKeyState();

    if (state === "checking") {
        return (
            <div className="flex flex-col gap-4 px-4 py-6 lg:px-8" data-testid="key-gate-checking">
                <Skeleton className="h-6 w-56" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (state === "invalid") return <OnboardingCard refused />;

    return children;
}
