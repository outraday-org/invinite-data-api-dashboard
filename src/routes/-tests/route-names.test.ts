import { createMemoryHistory, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { NAV_EXCEPTIONS, NAV_PAGES } from "@/lib/navigation";

/**
 * Route names vs tickers (owner decision 2026-11-21, backend tasks/data-api-dashboard README): every top-level page
 * sits beside the dynamic `/$ticker` and TanStack Router matches case-insensitively, so a static top-level name must
 * have more than five letters or a hyphen (a US ticker has at most five letters before its class suffix). `/funds` and
 * `/sec` predate the rule. The paths come from the generated route tree, so every new route is covered.
 */
const ROUTE_TREE = readFileSync(resolve(__dirname, "../../routeTree.gen.ts"), "utf8");

/** The full paths of the generated route tree (`FileRoutesByFullPath`). */
function fullPaths(): Array<string> {
    const block = /export interface FileRoutesByFullPath \{([\s\S]*?)\n\}/.exec(ROUTE_TREE)?.[1] ?? "";

    return [...block.matchAll(/^\s*'([^']+)':/gm)].map(match => match[1]);
}

/** The first segment of every path ("" = `/`), once. */
const topLevelSegments = () => [...new Set(fullPaths().map(path => path.split("/")[1] ?? ""))];

const EXISTING_EXCEPTIONS = new Set(["funds", "sec"]);

/** A name no ticker can have: more than five letters, or a hyphen. */
const tickerSafe = (name: string) => name.length > 5 || name.includes("-");

describe("route names vs tickers", () => {
    it("reads the route tree", () => {
        expect(fullPaths()).toEqual(expect.arrayContaining(["/", "/$ticker", "/calendar", "/live-calls", "/ipo-calendar"]));
    });

    it("every static top-level name has more than five letters or a hyphen (except /funds and /sec)", () => {
        const offenders = topLevelSegments()
            .filter(name => name !== "" && !name.startsWith("$"))
            .filter(name => !EXISTING_EXCEPTIONS.has(name) && !tickerSafe(name));

        expect(offenders).toEqual([]);
    });

    it("/LIVE and /IPOS open the instrument page (`/$ticker`), not a market page", () => {
        const rootRoute = createRootRoute();

        const children = topLevelSegments()
            .filter(name => name !== "")
            .map(name => createRoute({ getParentRoute: () => rootRoute, path: `/${name}` }));

        const router = createRouter({ history: createMemoryHistory(), routeTree: rootRoute.addChildren(children) });

        const leaf = (pathname: string) => router.matchRoutes(pathname, {}).at(-1)?.routeId;

        expect(leaf("/MACRO")).toBe("/$ticker");

        expect(leaf("/LIVE")).toBe("/$ticker");

        expect(leaf("/IPOS")).toBe("/$ticker");

        expect(leaf("/live-calls")).toBe("/live-calls");

        expect(leaf("/ipo-calendar")).toBe("/ipo-calendar");
    });

    it("every top-level page has an entry in the navigation table (or a stated reason)", () => {
        const listed = new Set(NAV_PAGES.map(page => page.to.split("/")[1] ?? ""));

        const missing = topLevelSegments()
            .filter(name => !name.startsWith("$"))
            .filter(name => !listed.has(name) && !(`/${name}` in NAV_EXCEPTIONS));

        expect(missing).toEqual([]);
    });
});
