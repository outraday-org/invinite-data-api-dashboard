import { createFileRoute } from "@tanstack/react-router";

import { ScalarMacroPage } from "@/components/macro/macro-page";
import { macroSearch } from "@/lib/api/macro";
import { titleHead } from "@/lib/layout";
import { IN_PLACE } from "@/lib/url-state";

export const Route = createFileRoute("/us-macro/gdp")({
    component: Page,
    head: () => titleHead("GDP & income"),
    validateSearch: macroSearch,
});

function Page() {
    const search = Route.useSearch();

    const navigate = Route.useNavigate();

    return (
        <ScalarMacroPage
            family="gdp"
            onChange={patch => void navigate({ ...IN_PLACE, search: prev => ({ ...prev, ...patch }) })}
            search={search}
        />
    );
}
