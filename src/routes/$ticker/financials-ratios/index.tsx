import { createFileRoute, redirect } from "@tanstack/react-router";

/** Redirect-only: the six financial pages are tabs of `/$ticker/financials` (`?view=ratios`), the query kept. */
export const Route = createFileRoute("/$ticker/financials-ratios/")({
    beforeLoad: ({ params, search }) => {
        throw redirect({ params, search: { ...search, view: "ratios" }, statusCode: 301, to: "/$ticker/financials" });
    },
});
