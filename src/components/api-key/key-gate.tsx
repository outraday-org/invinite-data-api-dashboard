import type * as React from "react";

import { PageContainer } from "@/components/ui/page-container";
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
            <PageContainer data-testid="key-gate-checking">
                <Skeleton className="h-6 w-56" />
                <Skeleton className="h-64 w-full" />
            </PageContainer>
        );
    }

    if (state === "invalid") return <OnboardingCard refused />;

    return children;
}
