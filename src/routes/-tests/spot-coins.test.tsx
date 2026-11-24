// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { V2Coin } from "@/lib/api/types";

import { CoinProfile } from "@/components/coins/coin-profile";

const sample: V2Coin = {
    categories: ["Proof of work"], circulating_supply: 20.125, currency: "USD", datasets: ["profile"],
    genesis_date: "2009-01-03", hashing_algorithm: "SHA-256", is_active: true, market_cap_rank: 1,
    max_supply: null, name: "Example coin", slug: "example-coin", source: "CoinGecko",
    source_url: "https://www.coingecko.com/en/coins/example-coin", symbol: "BTC", total_supply: 21,
    updated_at: "2026-11-24T12:30:00Z",
};

afterEach(cleanup);

describe("spot coin profile", () => {
    it("keeps coin-denominated supplies, rank, provider and timestamp distinct", () => {
        render(<CoinProfile coin={sample} />);

        expect(screen.getByText("Market cap rank").nextElementSibling).toHaveTextContent("#1");

        expect(screen.getByText("Circulating supply").nextElementSibling).toHaveTextContent("20.125 BTC");

        expect(screen.getByText("Maximum supply").nextElementSibling).toHaveTextContent("—");

        expect(screen.getByText("Proof of work")).toBeInTheDocument();

        expect(screen.getByRole("link", { name: "CoinGecko" })).toHaveAttribute("href", sample.source_url);

        expect(screen.getByText(/12:30 PM UTC/)).toHaveAttribute("datetime", sample.updated_at);
    });

    it("preserves zero, missing metadata and the unit when a coin has no display symbol", () => {
        render(<CoinProfile coin={{ ...sample, categories: [], circulating_supply: 0, genesis_date: null, hashing_algorithm: null, symbol: null }} />);

        expect(screen.getByText("Circulating supply").nextElementSibling).toHaveTextContent("0 coins");

        expect(screen.getByText("Hashing algorithm").nextElementSibling).toHaveTextContent("—");

        expect(screen.getByText("Categories").nextElementSibling).toHaveTextContent("—");
    });
});
