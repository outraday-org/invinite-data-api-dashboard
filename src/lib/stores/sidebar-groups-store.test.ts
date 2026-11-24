// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { useSidebarGroupsStore } from "@/lib/stores/sidebar-groups-store";

const KEY = "invinite-sidebar-groups";

beforeEach(() => {
    window.localStorage.clear();

    useSidebarGroupsStore.setState({ hasHydrated: false, open: {} });
});

describe("sidebar groups store", () => {
    it("holds no stored choice and is not hydrated before `rehydrate` (server and first client render)", () => {
        window.localStorage.setItem(KEY, JSON.stringify({ state: { open: { market: false } }, version: 0 }));

        expect(useSidebarGroupsStore.getState()).toMatchObject({ hasHydrated: false, open: {} });
    });

    it("persists a toggled group and applies it on the next load", async () => {
        useSidebarGroupsStore.getState().setGroupOpen("macro", true);

        expect(JSON.parse(window.localStorage.getItem(KEY)!)).toMatchObject({ state: { open: { macro: true } } });

        // A fresh page: nothing in memory, the stored object in `localStorage`.
        useSidebarGroupsStore.setState({ open: {} });

        window.localStorage.setItem(KEY, JSON.stringify({ state: { open: { macro: true } }, version: 0 }));

        await useSidebarGroupsStore.persist.rehydrate();

        expect(useSidebarGroupsStore.getState()).toMatchObject({ hasHydrated: true, open: { macro: true } });
    });

    it("drops stored entries that are not booleans", async () => {
        window.localStorage.setItem(KEY, JSON.stringify({ state: { open: { build: "yes", filings: false } }, version: 0 }));

        await useSidebarGroupsStore.persist.rehydrate();

        expect(useSidebarGroupsStore.getState().open).toEqual({ filings: false });
    });
});
