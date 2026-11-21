import { createFileRoute, redirect } from "@tanstack/react-router";

/** Redirect-only: the six financial pages are tabs of `/$ticker/financials` (`?view=as-reported`), the query kept. */
export const Route = createFileRoute("/$ticker/financials-as-reported/")({
    beforeLoad: ({ params, search }) => {
        throw redirect({ params, search: { ...search, view: "as-reported" }, statusCode: 301, to: "/$ticker/financials" });
    },
});
