import { createFileRoute, redirect } from "@tanstack/react-router";

/** Redirect-only: the market holidays is market-wide, a top-level page (`/market-holidays`); the query is kept. */
export const Route = createFileRoute("/$ticker/market-holidays/")({
    beforeLoad: ({ search }) => {
        throw redirect({ search, statusCode: 301, to: "/market-holidays" });
    },
});
