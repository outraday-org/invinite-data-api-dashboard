// Public, key-less pages that moved off this example: the status page (`../invinite-data-api/status/`,
// a Cloudflare Worker) and the licensing matrix (Invinite Data docs). `/status` and `/licensing` here
// answer 301s to them; the landing page links to them directly.
export const STATUS_PAGE_URL = "https://status.data.invinite.com/";

export const LICENSING_PAGE_URL = "https://data.invinite.com/docs/licensing";

/**
 * The server handlers of a moved page: GET and HEAD both answer a 301 to `target` (without HEAD, `curl -I` got the
 * app's 200 HTML shell: UI walk F006); `keepQuery` carries the request's query over.
 */
export function movedPageHandlers(target: string, { keepQuery = false }: { keepQuery?: boolean } = {}) {
    const redirect = ({ request }: { request: Request }) => {
        const location = new URL(target);

        if (keepQuery) location.search = new URL(request.url).search;

        return new Response(null, { headers: { Location: location.toString() }, status: 301 });
    };

    return { GET: redirect, HEAD: redirect };
}
