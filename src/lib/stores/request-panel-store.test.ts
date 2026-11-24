// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRequestPanelStore } from "@/lib/stores/request-panel-store";

const KEY = "invinite-request-panel";

const stubWidth = (width: number) => {
    vi.stubGlobal("matchMedia", (query: string) => {
        const max = /max-width: (\d+)px/.exec(query);

        return { matches: max ? width <= Number(max[1]) : false } as MediaQueryList;
    });
};

beforeEach(() => {
    window.localStorage.clear();

    useRequestPanelStore.setState({ hasHydrated: false, open: false });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("request panel store", () => {
    it("is closed and not hydrated before `rehydrate` (server and first client render)", () => {
        window.localStorage.setItem(KEY, JSON.stringify({ state: { open: true }, version: 0 }));

        expect(useRequestPanelStore.getState()).toMatchObject({ hasHydrated: false, open: false });
    });

    it("persists `open` after a toggle and applies it on the next load at desktop width", async () => {
        stubWidth(1440);

        useRequestPanelStore.getState().toggle();

        expect(JSON.parse(window.localStorage.getItem(KEY)!)).toMatchObject({ state: { open: true } });

        useRequestPanelStore.setState({ open: false });

        window.localStorage.setItem(KEY, JSON.stringify({ state: { open: true }, version: 0 }));

        await useRequestPanelStore.persist.rehydrate();

        expect(useRequestPanelStore.getState()).toMatchObject({ hasHydrated: true, open: true });
    });

    it("ignores a stored open below 1280 px (a sheet never opens by itself)", async () => {
        stubWidth(1024);

        window.localStorage.setItem(KEY, JSON.stringify({ state: { open: true }, version: 0 }));

        await useRequestPanelStore.persist.rehydrate();

        expect(useRequestPanelStore.getState()).toMatchObject({ hasHydrated: true, open: false });
    });
});
