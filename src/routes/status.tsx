import { createFileRoute } from "@tanstack/react-router";

/**
 * The public status page lives on its own host (`../invinite-data-api/status/`, a Cloudflare Worker).
 * The old `/status` answers a 301 there with the query kept (`?days=&vendor=` are the same names).
 * A server route, not a `netlify.toml` redirect: Netlify evaluates the SSR function (`path: "/*"`)
 * BEFORE redirect rules, so a toml rule for `/status` never fires.
 */
export const STATUS_PAGE_URL = "https://status.data.invinite.com/";

export const Route = createFileRoute("/status")({
    server: {
        handlers: {
            GET: ({ request }) => {
                const target = new URL(STATUS_PAGE_URL);

                target.search = new URL(request.url).search;

                return new Response(null, { headers: { Location: target.toString() }, status: 301 });
            },
        },
    },
});
