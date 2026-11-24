import { createFileRoute } from "@tanstack/react-router";

import { ScalarMacroPage } from "@/components/macro/macro-page";
import { macroSearch } from "@/lib/api/macro";
import { titleHead } from "@/lib/layout";
import { IN_PLACE } from "@/lib/url-state";

export const Route = createFileRoute("/us-macro/labor")({
    component: Page,
    head: () => titleHead("Labor market"),
    validateSearch: macroSearch,
});

function Page() {
    const search = Route.useSearch();

    const navigate = Route.useNavigate();

    return (
        <ScalarMacroPage
            family="labor"
            onChange={patch => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, ...patch }) })}
            search={search}
        />
    );
}
