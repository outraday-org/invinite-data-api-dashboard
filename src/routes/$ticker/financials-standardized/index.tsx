import { createFileRoute, redirect } from "@tanstack/react-router";

/** Redirect-only: the six financial pages are tabs of `/$ticker/financials` (`?view=standardized`), the query kept. */
export const Route = createFileRoute("/$ticker/financials-standardized/")({
    beforeLoad: ({ params, search }) => {
        throw redirect({ params, search: { ...search, view: "standardized" }, statusCode: 301, to: "/$ticker/financials" });
    },
});
