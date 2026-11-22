import { createFileRoute } from "@tanstack/react-router";

import { movedPageHandlers, STATUS_PAGE_URL } from "@/lib/public-hosts";

/**
 * The public status page lives on its own host (`../invinite-data-api/status/`, a Cloudflare Worker).
 * The old `/status` answers a 301 there with the query kept (`?days=&vendor=` are the same names).
 * A server route, not a `netlify.toml` redirect: Netlify evaluates the SSR function (`path: "/*"`)
 * BEFORE redirect rules, so a toml rule for `/status` never fires.
 */
export const Route = createFileRoute("/status")({
    server: { handlers: movedPageHandlers(STATUS_PAGE_URL, { keepQuery: true }) },
});
