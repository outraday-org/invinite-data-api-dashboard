import { describe, expect, it, vi } from "vitest";

import { Route as LicensingRoute } from "@/routes/licensing";
import { Route as StatusRoute } from "@/routes/status";

vi.mock("@tanstack/react-router", () => ({
    createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
}));

type Handler = (context: { request: Request }) => Response;

const handlersOf = (route: unknown) => (route as { options: { server: { handlers: Record<string, Handler> } } }).options.server.handlers;

describe("/status and /licensing (301 server routes)", () => {
    it("GET and HEAD both answer the 301; /status keeps the query (UI walk F006)", () => {
        for (const method of ["GET", "HEAD"]) {
            const status = handlersOf(StatusRoute)[method]({ request: new Request("http://localhost:3001/status?x=1", { method }) });

            expect(status.status).toBe(301);

            expect(status.headers.get("Location")).toBe("https://status.data.invinite.com/?x=1");

            const licensing = handlersOf(LicensingRoute)[method]({ request: new Request("http://localhost:3001/licensing", { method }) });

            expect(licensing.status).toBe(301);

            expect(licensing.headers.get("Location")).toBe("https://data.invinite.com/docs/licensing");
        }
    });
});
