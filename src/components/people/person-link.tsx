import type * as React from "react";

import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

/**
 * A speaker's name as a link to the person page (`/people/$personId`) when the API resolved the speaker to a person
 * (`person_id`); otherwise the plain name. The raw id is never printed.
 */
export function PersonLink({ children, className, personId }: { children: React.ReactNode; className?: string; personId: null | string | undefined }) {
    if (!personId) return <span className={className}>{children}</span>;

    return (
        <Link
            className={cn("underline-offset-4 hover:underline", className)}
            params={{ personId }}
            title="Every call of this person"
            to="/people/$personId"
        >
            {children}
        </Link>
    );
}
