import { createFileRoute, redirect } from "@tanstack/react-router";

/** Redirect-only: the six financial pages are tabs of `/$ticker/financials` (`?view=cagr`), the query kept. */
export const Route = createFileRoute("/$ticker/financials-cagr/")({
    beforeLoad: ({ params, search }) => {
        throw redirect({ params, search: { ...search, view: "cagr" }, statusCode: 301, to: "/$ticker/financials" });
    },
});
