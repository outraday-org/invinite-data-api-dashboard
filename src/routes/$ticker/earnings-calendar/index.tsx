import { createFileRoute, redirect } from "@tanstack/react-router";

/** Redirect-only: the earnings calendar is market-wide, a top-level page (`/calendar`); the query is kept. */
export const Route = createFileRoute("/$ticker/earnings-calendar/")({
    beforeLoad: ({ search }) => {
        throw redirect({ search, statusCode: 301, to: "/calendar" });
    },
});
