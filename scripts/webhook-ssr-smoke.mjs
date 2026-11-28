// Run after `pnpm run build`. Exercise the actual production SSR entry through loopback HTTP, without an API key.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import entry from "../dist/server/server.js";

const spec = JSON.parse(readFileSync(new URL("../openapi.json", import.meta.url), "utf8"));
const types = Object.keys(spec.components.schemas.AlertFiredData.discriminator.mapping);
const first = types[0];
const results = [];
let origin;
const server = createServer(async (request, response) => {
    try {
        const result = await entry.fetch(new Request(new URL(request.url, origin), { headers: { accept: "text/html" } }));

        response.writeHead(result.status, Object.fromEntries(result.headers));

        if (result.body) await pipeline(Readable.fromWeb(result.body), response);
        else response.end();
    }
    catch (error) {
        response.writeHead(500);
        response.end(String(error));
    }
});

await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
origin = `http://127.0.0.1:${server.address().port}`;
try {
    for (const type of [undefined, ...types]) {
        const path = "/alerts/webhooks" + (type ? `?type=${type}` : "");
        const response = await fetch(origin + path, { redirect: "manual" });

        assert.equal(response.status, 200, path);
        assert.equal(response.headers.get("location"), null, path);
        assert.match(response.headers.get("content-type"), /text\/html/);
        await response.text();
        results.push({ path, status: response.status });
    }

    for (const extra of ["", "&q=keep", "&q=keep&other=preserved"]) {
        const path = `/alerts/webhooks?type=unknown${extra}`;
        const response = await fetch(origin + path, { redirect: "manual" });
        const location = response.headers.get("location");

        assert.equal(response.status, 307);
        assert.ok(location);
        const target = new URL(location, origin);

        // Netlify can preserve an incoming query when Location has none. An explicit valid type avoids that loop.
        assert.equal(target.searchParams.get("type"), first, path);
        assert.notEqual(target.pathname + target.search, path);
        if (extra) assert.equal(target.searchParams.get("q"), "keep");
        if (extra.includes("other")) assert.equal(target.searchParams.get("other"), "preserved");
        await response.body?.cancel();

        const final = await fetch(target, { redirect: "manual" });
        assert.equal(final.status, 200);
        assert.equal(final.headers.get("location"), null);
        await final.text();
        results.push({ path, status: response.status, location, finalStatus: final.status });
    }

    for (const path of ["/catalog", "/catalog?tab=news-kinds", "/catalog?group=topic", "/catalog?tab=news-kinds&group=topic"]) {
        const response = await fetch(origin + path, { redirect: "manual" });
        assert.equal(response.status, 200, path);
        assert.equal(response.headers.get("location"), null, path);
        await response.text();
        results.push({ path, status: response.status });
    }

    for (const [path, expectedTab] of [
        ["/catalog?group=unknown", "metrics"],
        ["/catalog?group=null", "metrics"],
        ["/catalog?group=true", "metrics"],
        ["/catalog?group=42", "metrics"],
        ["/catalog?group=%5B%22topic%22%5D", "metrics"],
        ["/catalog?group=unknown&q=keep", "metrics"],
        ["/catalog?tab=news-kinds&group=unknown", "news-kinds"],
        ["/catalog?tab=unknown&group=unknown", "metrics"],
    ]) {
        const response = await fetch(origin + path, { redirect: "manual" });
        const location = response.headers.get("location");
        assert.equal(response.status, 307, path);
        assert.ok(location);
        const target = new URL(location, origin);
        assert.equal(target.searchParams.get("tab"), expectedTab, path);
        assert.equal(target.searchParams.has("group"), false, path);
        if (path.includes("q=keep")) assert.equal(target.searchParams.get("q"), "keep");
        await response.body?.cancel();
        const final = await fetch(target, { redirect: "manual" });
        assert.equal(final.status, 200);
        assert.equal(final.headers.get("location"), null);
        await final.text();
        results.push({ path, status: response.status, location, finalStatus: final.status });
    }

    // HTTP never transmits fragments; verify the browser-follow target preserves the original fragment.
    const start = new URL(origin + "/alerts/webhooks?type=unknown#webhook-alert.fired-filing");
    const response = await fetch(start, { redirect: "manual" });
    const target = new URL(response.headers.get("location"), start);
    if (!target.hash) target.hash = start.hash;
    assert.equal(target.hash, "#webhook-alert.fired-filing");
    assert.equal(target.searchParams.get("type"), first);
    await response.body?.cancel();
    results.push({ path: start.pathname + start.search + start.hash, location: target.pathname + target.search + target.hash });

    if (process.env.WEBHOOK_SSR_PROOF) writeFileSync(process.env.WEBHOOK_SSR_PROOF, JSON.stringify(results, null, 2) + "\n");
    console.log(`Production reference SSR HTTP: ${results.length} cases passed (23 valid types, missing, catalog groups, unknown/query/fragment fallback)`);
}
finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
}
