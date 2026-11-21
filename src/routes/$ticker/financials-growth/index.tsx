import { createFileRoute, redirect } from "@tanstack/react-router";

/** Redirect-only: the six financial pages are tabs of `/$ticker/financials` (`?view=growth`), the query kept. */
export const Route = createFileRoute("/$ticker/financials-growth/")({
    beforeLoad: ({ params, search }) => {
        throw redirect({ params, search: { ...search, view: "growth" }, statusCode: 301, to: "/$ticker/financials" });
    },
});
