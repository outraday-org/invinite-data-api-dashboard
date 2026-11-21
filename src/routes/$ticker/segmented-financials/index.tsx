import { createFileRoute, redirect } from "@tanstack/react-router";

/** Redirect-only: the six financial pages are tabs of `/$ticker/financials` (`?view=segments`), the query kept. */
export const Route = createFileRoute("/$ticker/segmented-financials/")({
    beforeLoad: ({ params, search }) => {
        throw redirect({ params, search: { ...search, view: "segments" }, statusCode: 301, to: "/$ticker/financials" });
    },
});
