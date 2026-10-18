import { createFileRoute } from "@tanstack/react-router";

import { LICENSING_PAGE_URL } from "@/lib/public-hosts";

/**
 * The licensing matrix lives in the Invinite Data app's docs. The old `/licensing` answers a 301 there.
 * A server route, not a `netlify.toml` redirect: Netlify evaluates the SSR function (`path: "/*"`)
 * BEFORE redirect rules, so a toml rule for `/licensing` never fires (see `status.tsx`).
 */
export const Route = createFileRoute("/licensing")({
    server: {
        handlers: {
            GET: () => new Response(null, { headers: { Location: LICENSING_PAGE_URL }, status: 301 }),
        },
    },
});
