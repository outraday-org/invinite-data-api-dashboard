import { createFileRoute } from "@tanstack/react-router";

import { STATUS_PAGE_URL } from "@/lib/public-hosts";

/**
 * The public status page lives on its own host (`../invinite-data-api/status/`, a Cloudflare Worker).
 * The old `/status` answers a 301 there with the query kept (`?days=&vendor=` are the same names).
 * A server route, not a `netlify.toml` redirect: Netlify evaluates the SSR function (`path: "/*"`)
 * BEFORE redirect rules, so a toml rule for `/status` never fires.
 */
function redirect({ request }: { request: Request }) {
    const target = new URL(STATUS_PAGE_URL);

    target.search = new URL(request.url).search;

    return new Response(null, { headers: { Location: target.toString() }, status: 301 });
}

// HEAD answers the same 301 (without it, `curl -I` got the app's 200 HTML shell: UI walk F006).
export const Route = createFileRoute("/status")({
    server: {
        handlers: { GET: redirect, HEAD: redirect },
    },
});
