import { createFileRoute, redirect } from "@tanstack/react-router";

/** Redirect-only: the IPO calendar is market-wide, a top-level page (`/ipo-calendar`); the query is kept. */
export const Route = createFileRoute("/$ticker/ipos/")({
    beforeLoad: ({ search }) => {
        throw redirect({ search, statusCode: 301, to: "/ipo-calendar" });
    },
});
