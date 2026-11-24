import type * as React from "react";

import { StateBlock } from "./notice";

function getErrorMessage(error: unknown): null | string {
    if (!error) return null;

    if (error instanceof Error) return error.message;

    if (typeof error === "string") return error;

    if (typeof error === "object") {
        const maybeMessage = (error as { message?: unknown }).message;

        if (typeof maybeMessage === "string" && maybeMessage.trim()) return maybeMessage;

        try {
            return JSON.stringify(error, null, 2);
        }
        catch {
            // fallthrough
        }
    }

    try {
        return String(error);
    }
    catch {
        return null;
    }
}

type ErrorStateProps = {
    action?: React.ReactNode;
    className?: string;
    error?: unknown;
    message?: React.ReactNode;
    title?: React.ReactNode;
};

/** A failed request: the state layout of `Notice` with the destructive accent, an "Error" badge and `role="alert"`. */
export function ErrorState({
    action,
    className,
    error,
    message,
    title = "Something went wrong",
}: ErrorStateProps) {
    const resolvedMessage = message ?? getErrorMessage(error) ?? "Unknown error";

    return (
        <StateBlock action={action} badge="Error" badgeVariant="destructive" className={className} role="alert" title={title} tone="destructive">
            <div className="whitespace-pre-wrap">{resolvedMessage}</div>
        </StateBlock>
    );
}
