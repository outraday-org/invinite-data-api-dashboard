// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, QueryObserver } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MacroPageActions } from "@/components/macro/macro-page-actions";
import { MACRO_ALERT_SERIES } from "@/lib/api/operations.gen";
import { useApiKeyStore } from "@/lib/stores/api-key-store";

import type { MacroEdition } from "./use-live-macro";

import vectors from "./fixtures/macro-releases-v1.json";
import { affectsMacroQuery, refreshMacroQueries, useLiveMacro } from "./use-live-macro";

const profile = vi.hoisted(() => ({ plan: "pro" }));

vi.mock("@/lib/api/queries", () => ({
    useApiBaseUrl: (enabled: boolean) => enabled ? "https://test.invalid" : null,
    useKeyState: () => ({ me: { allowed_families: profile.plan === "free" ? ["Macro"] : ["Macro", "Alerts"], plan: profile.plan } }),
}));

vi.mock("@tanstack/react-router", async original => ({ ...await original<object>(),
    Link: ({ children, search, to}: { children: React.ReactNode; to: string; search: Record<string, string> }) => <a href={to + "?" + new URLSearchParams(search).toString()}>{children}</a>,
}));

class Socket extends EventTarget {
    static last: Socket;
    static OPEN = 1;
    readyState = 1;
    sent: Array<object> = [];
    constructor() {
        super();

        Socket.last = this;
    }

    close() { this.readyState = 3; }
    frame(data: unknown) { this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(data) })); }
    open() { this.dispatchEvent(new Event("open")); }
    send(text: string) { this.sent.push(JSON.parse(text) as object); }
}

const sample = (name: string) => vectors.cases.find(c => c.name === name)!.frame as MacroEdition;

const history = ["v2", "macro", "gdp", "history", "real_gdp_growth", "2025-01-01", "2025-03-01", "1"];

const options = (client: QueryClient) => ({ apiKey: "test", apiKeyUpdatedAt: 1, baseUrl: "https://test.invalid", enabled: true, onStop: vi.fn(), queryClient: client, scope: "gdp" as const });

afterEach(() => {
    vi.unstubAllGlobals();

    vi.useRealTimers();
});

describe("macro live page", () => {
    it.each([["inflation", "multi_family"], ["gdp", "unchanged_estimate"], ["yield_curve", "treasury_curve"]] as const)("subscribes %s and displays the publication even when its headline did not change", (scope, name) => {
        vi.stubGlobal("WebSocket", Socket);

        const client = new QueryClient();

        const opts = { ...options(client), scope };

        const { result, unmount } = renderHook(() => useLiveMacro(opts));

        act(() => Socket.last.open());

        expect(Socket.last.sent).toEqual([{ channel: "macro", families: [scope], type: "subscribe" }]);

        act(() => Socket.last.frame(sample(name)));

        expect(result.current.latest).toBeNull();

        act(() => Socket.last.frame({ channel: "macro", families: [scope], type: "subscribed" }));

        act(() => Socket.last.frame(sample(name)));

        expect(result.current.latest?.release_id).toBe(sample(name).release_id);

        if (scope === "yield_curve")expect(result.current.latest?.curve).toMatchObject({ m1_5: null });

        expect(result.current.mode).toBe("live");

        unmount();

        expect(Socket.last.sent.at(-1)).toEqual({ channel: "macro", type: "unsubscribe" });
    });

    it("subscribes labor and suppresses out-of-filter, duplicate and stale release versions", () => {
        vi.stubGlobal("WebSocket", Socket);

        const client = new QueryClient(), opts = options(client);

        const refresh = vi.spyOn(client, "cancelQueries");

        const { rerender, result } = renderHook(({ scope }) => useLiveMacro({ ...opts, scope }), { initialProps: { scope: "labor" as "gdp" | "labor" } });

        act(() => {
            Socket.last.open();

            Socket.last.frame({ channel: "macro", families: ["labor"], type: "subscribed" });

            Socket.last.frame(sample("advance_estimate"));
        });

        expect(result.current.latest).toBeNull();

        const old = Socket.last;

        rerender({ scope: "gdp" });

        expect(Socket.last).toBe(old);

        expect(old.sent.at(-1)).toEqual({ channel: "macro", families: ["gdp"], type: "subscribe" });

        act(() => {
            old.frame({ channel: "macro", families: ["labor"], type: "subscribed" });

            old.frame(sample("multi_family"));

            expect(result.current.latest).toBeNull();

            Socket.last.frame({ channel: "macro", families: ["gdp"], type: "subscribed" });
        });

        refresh.mockClear();

        act(() => {
            Socket.last.frame(sample("correction"));

            Socket.last.frame(sample("unchanged_estimate"));

            Socket.last.frame(sample("correction"));
        });

        expect(refresh).toHaveBeenCalledTimes(1);

        expect(result.current.latest?.event_id).toBe(sample("correction").event_id);
    });

    it.each(["channel_unavailable", "unavailable"])("resubscribes after %s and waits for confirmation before REST recovery", (code) => {
        vi.stubGlobal("WebSocket", Socket);

        vi.useFakeTimers();

        const client = new QueryClient(), opts = options(client);

        const refresh = vi.spyOn(client, "cancelQueries");

        const { result, unmount } = renderHook(() => useLiveMacro(opts));

        act(() => {
            Socket.last.open();

            Socket.last.frame({ channel: "macro", families: ["gdp"], type: "subscribed" });

            Socket.last.frame({ channel: "macro", code, type: "error" });
        });

        expect(result.current.mode).toBe("retrying");

        expect(opts.onStop).not.toHaveBeenCalled();

        act(() => vi.advanceTimersByTime(10_000));

        expect(Socket.last.sent).toHaveLength(2);

        expect(refresh).toHaveBeenCalledTimes(1);

        act(() => Socket.last.frame({ channel: "macro", families: ["gdp"], type: "subscribed" }));

        expect(refresh).toHaveBeenCalledTimes(2);

        expect(result.current.mode).toBe("live");

        unmount();
    });

    it("recovers only after acknowledgement on reconnect and leaves paid REST usable when refused", () => {
        vi.stubGlobal("WebSocket", Socket);

        vi.useFakeTimers();

        const client = new QueryClient(), opts = options(client);

        const refresh = vi.spyOn(client, "cancelQueries");

        const { result } = renderHook(() => useLiveMacro(opts));

        act(() => {
            Socket.last.open();

            Socket.last.frame({ channel: "macro", families: ["gdp"], type: "subscribed" });
        });

        refresh.mockClear();

        act(() => {
            Socket.last.dispatchEvent(new CloseEvent("close", { code: 1006 }));

            vi.advanceTimersByTime(1000);

            Socket.last.open();
        });

        expect(refresh).not.toHaveBeenCalled();

        act(() => Socket.last.frame({ channel: "macro", families: ["gdp"], type: "subscribed" }));

        expect(result.current.mode).toBe("live");

        expect(refresh).toHaveBeenCalledTimes(1);

        act(() => Socket.last.frame({ channel: "macro", code: "forbidden_tier", type: "error" }));

        expect(opts.onStop).toHaveBeenCalledWith(expect.objectContaining({ kind: "plan" }));
    });

    it("refreshes a matching historical range and supersedes two different editions without accepting a late read", async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

        const observer = new QueryObserver(client, { queryFn: () => new Promise<number>(resolve => pending.push(resolve)), queryKey: history });

        const pending: Array<(v: number) => void> = [];

        const unsubscribe = observer.subscribe(() => undefined);

        const one = sample("unchanged_estimate"), two = sample("correction");

        expect(affectsMacroQuery(history, "gdp", 1, two)).toBe(true);

        expect(affectsMacroQuery([...history.slice(0, 5), "2022-01-01", "2022-12-01", "1"], "gdp", 1, two)).toBe(false);

        expect(affectsMacroQuery(history, "gdp", 2, two)).toBe(false);

        const first = refreshMacroQueries(client, "gdp", 1, one);

        await vi.waitFor(() => expect(pending.length).toBe(2));

        const second = refreshMacroQueries(client, "gdp", 1, { ...two, release_id: "different-edition", version: 1 });

        await vi.waitFor(() => expect(pending.length).toBe(3));

        pending[2](2.2);

        await second;

        pending[1](2.3);

        pending[0](1);

        await first;

        expect(client.getQueryData(history)).toBe(2.2);

        unsubscribe();

        client.clear();
    });
});

describe("macro page controls", () => {
    afterEach(cleanup);

    it.each(["lite", "payg", "free"])("keeps the socket closed on %s and offers alerts only when admitted", (plan) => {
        profile.plan = plan;

        render(<QueryClientProvider client={new QueryClient()}><MacroPageActions family="yield_curve" seriesId="treasury_par_y10" /></QueryClientProvider>);

        expect(screen.getByRole("button", { name: "Live · Pro" })).toBeDisabled();

        if (plan === "free")expect(screen.queryByRole("link", { name: "Create alert" })).toBeNull();
        else expect(screen.getByRole("link", { name: "Create alert" })).toHaveAttribute("href", "/alerts/new?series=treasury_par_y10&type=macro");
    });

    it.each([["inflation", "pce_all_sa", "multi_family"], ["gdp", "real_gdp_growth", "unchanged_estimate"], ["labor", "payrolls_sa", "labor"], ["yield_curve", "treasury_par_y10", "treasury_curve"]] as const)(
        "shows the confirmed %s publication and its observed time on the opted-in page", (family, id, name) => {
            profile.plan = "pro";

            vi.stubGlobal("WebSocket", Socket);

            useApiKeyStore.setState({ apiKey: "stub", apiKeyUpdatedAt: 1, hasHydrated: true });

            const client = new QueryClient();

            render(<QueryClientProvider client={client}><MacroPageActions family={family} seriesId={id} /></QueryClientProvider>);

            const button = screen.getByRole("button", { name: "Live" });

            expect(button).toHaveAttribute("aria-pressed", "false");

            fireEvent.click(button);

            act(() => {
                Socket.last.open();

                Socket.last.frame({ channel: "macro", families: [family], type: "subscribed" });
            });

            const frame = name === "labor"
                ? { ...sample("advance_estimate"), affected: [], agency: "BLS", families: ["labor"],
                        readings: [{ ...sample("advance_estimate").readings[0], series_id: id, unit: MACRO_ALERT_SERIES[id].unit }], release_name: "Employment Situation" }
                : sample(name);

            act(() => Socket.last.frame(frame));

            expect(screen.getByText(text => text.includes(frame.release_name))).toBeInTheDocument();

            expect(screen.getByText("Listening")).toBeInTheDocument();

            expect(Socket.last.sent[0]).toEqual({ channel: "macro", families: [family], type: "subscribe" });
        });
});
