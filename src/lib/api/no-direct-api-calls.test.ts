import { createClientRpc } from "@tanstack/react-start/client-rpc";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it, vi } from "vitest";

/**
 * The browser never calls the Data API host (backend tasks/data-api-dashboard 2-alerts task 2): every request goes
 * through a server function (`createApiClient` in `client.server.ts`, the key stays on the server side of the boundary),
 * and the only browser connection to the API is the `/v1/stream` WebSocket of the live hooks (`liveWsUrl`). Modelled
 * on `src/lib/sec/no-direct-sec-calls.test.ts`.
 */

const SRC = join(__dirname, "..", "..");

function sourceFiles(dir: string): Array<string> {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);

        if (statSync(path).isDirectory()) return sourceFiles(path);

        return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith(".d.ts") && name !== "routeTree.gen.ts" ? [path] : [];
    });
}

const files = sourceFiles(SRC).map(path => ({ path: relative(SRC, path).split("\\").join("/"), text: readFileSync(path, "utf8") }));

/** Server-only modules: their code never runs in the browser (`.server.ts`; server function handlers are stripped). */
const SERVER_ONLY = new Set(["lib/api/client.server.ts", "lib/env.ts"]);

/** `fetch(` callers, each with why it never reaches the API host (public storage files, never the API base URL). */
const FETCH_ALLOWED: Readonly<Record<string, string>> = {
    "hooks/use-get-html-storage-content.ts": "a public storage HTML file (filing rendition), no key",
    "lib/download.ts": "saves a public file (recording, document) by its public URL, no key",
    "lib/reference/public-status.ts": "the public status site's keyless snapshot (`STATUS_PAGE_URL` + `api/snapshot`, credentials omitted), never the API host",
};

const API_HOST = /api\.data\.invinite\.com/;

describe("no direct Data API traffic from the browser", () => {
    it("sends every key-bearing server function in the RPC body", () => {
        const readableByUrl = files.flatMap(({ text }) => [...text.matchAll(/export const (\w+) = createServerFn\(\{ method: "GET" \}\)/g)].map(match => match[1]));

        expect(readableByUrl).toEqual(["getApiBaseUrl"]);

        const shell = files.find(file => file.path === "lib/api/server-functions.ts")!.text;

        expect(shell).toContain("getMe = createServerFn({ method: \"POST\" })");

        const macro = files.find(file => file.path === "lib/api/server-functions-macro.ts")!.text;

        expect(macro.match(/createServerFn\(\{ method: "POST" \}\)/g)).toHaveLength(5);
    });

    it("keeps a synthetic key out of URLs in the installed Start transport", async () => {
        const key = "test-only-dashboard-credential";

        const capture = vi.fn((_url: string, _options: RequestInit) => Promise.resolve(Response.json({})));

        vi.stubGlobal("fetch", capture);

        try {
            for (const [path, id] of [["lib/api/server-functions.ts", "getMe"], ["lib/api/server-functions-macro.ts", "getMacroCatalog"]]) {
                const file = files.find(f => f.path === path)!;

                const method = new RegExp(`export const ${id} = createServerFn\\(\\{ method: "(GET|POST)"`).exec(file.text)?.[1];

                expect(method).toBe("POST");

                await createClientRpc(id)({ data: { apiKey: key }, method });
            }

            expect(capture).toHaveBeenCalledTimes(2);

            for (const [url, request] of capture.mock.calls) {
                expect(url).not.toContain(key);

                expect(url).not.toContain("?");

                expect(request.method).toBe("POST");

                expect(request.body).toContain(key);
            }
        }
        finally { vi.unstubAllGlobals(); }
    });

    it("only the server client creates an openapi-fetch client or reads the API base URL from the environment", () => {
        const clients = files.filter(({ text }) => /from "openapi-fetch"/.test(text) && /\bcreateClient\b/.test(text)).map(({ path }) => path);

        expect(clients).toEqual(["lib/api/client.server.ts"]);

        const envReaders = files.filter(({ text }) => /INVINITE_DATA_API_URL/.test(text)).map(({ path }) => path).sort();

        // `getApiBaseUrl` hands the base URL to the browser for the WebSocket and the inspector's curl only.
        expect(envReaders).toEqual(["lib/api/client.server.ts", "lib/api/server-functions.ts", "lib/env.ts"]);
    });

    it("every fetch( caller is a reviewed public-file read, never the API", () => {
        const callers = files.filter(({ text }) => /(?<![\w.])fetch\(/.test(text)).map(({ path }) => path).sort();

        expect(callers).toEqual(Object.keys(FETCH_ALLOWED).sort());

        for (const path of callers) {
            const { text } = files.find(file => file.path === path)!;

            expect({ path, readsApiBase: /useApiBaseUrl|getApiBaseUrl|API_BASE_URL|api\.data\.invinite/.test(text) }).toEqual({ path, readsApiBase: false });
        }
    });

    it("no XMLHttpRequest, sendBeacon or EventSource anywhere", () => {
        expect(files.filter(({ text }) => /new XMLHttpRequest|sendBeacon\(|new EventSource\(/.test(text)).map(({ path }) => path)).toEqual([]);
    });

    it("the only browser connection to the API is the /v1/stream WebSocket of the live hooks", () => {
        const sockets = files.filter(({ text }) => /new WebSocket\(/.test(text)).map(({ path }) => path);

        expect(sockets.length).toBeGreaterThan(0);

        for (const path of sockets) {
            // `stream-socket.ts` opens the socket of the channel hooks with the URL they hand it (checked below).
            if (path === "lib/live/stream-socket.ts") continue;

            expect(path).toMatch(/^lib\/live\/use-live-[\w-]+\.ts$/);

            expect(files.find(file => file.path === path)!.text).toContain("liveWsUrl(");
        }

        const streamCallers = files.filter(({ path, text }) => path !== "lib/live/stream-socket.ts" && /openStreamSocket\(/.test(text));

        expect(streamCallers.length).toBeGreaterThan(0);

        for (const { path, text } of streamCallers) {
            expect(path).toMatch(/^lib\/live\/use-live-[\w-]+\.ts$/);

            // Every call opens `liveWsUrl(…)` (the `/v1/stream` URL), never another address.
            expect({ calls: text.match(/openStreamSocket\(/g)!.length, path }).toEqual({ calls: text.match(/openStreamSocket\(liveWsUrl\(/g)?.length ?? 0, path });
        }

        const wsFrames = files.find(({ path }) => path === "lib/live/ws-frames.ts")!.text;

        expect(wsFrames).toMatch(/new URL\("\/v1\/stream", baseUrl\)/);
    });

    it("the API host is named only by the server env default and the request panel's curl text", () => {
        const naming = files.filter(({ text }) => API_HOST.test(text)).map(({ path }) => path).filter(path => !path.endsWith("-fixtures.ts")).sort();

        expect(naming).toEqual(["components/api/request-panel.tsx", "lib/env.ts"]);

        expect(files.find(({ path }) => path === "components/api/request-panel.tsx")!.text).not.toMatch(/(?<![\w.])fetch\(/);
    });

    it("the alert server functions and requests go through the server client", () => {
        const alerts = files.filter(({ path }) => path === "lib/api/server-functions-alerts.ts" || path === "lib/api/alerts-requests.ts");

        expect(alerts).toHaveLength(2);

        for (const { text } of alerts) expect(text).not.toMatch(/(?<![\w.])fetch\(/);

        expect(alerts[0].text + alerts[1].text).toContain("createApiClient");

        expect([...SERVER_ONLY].every(path => files.some(file => file.path === path))).toBe(true);
    });
});
