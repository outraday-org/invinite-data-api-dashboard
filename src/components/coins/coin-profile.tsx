import { ArrowUpRightIcon } from "lucide-react";

import type { V2Coin } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { formatDay, formatInstant, formatNumber } from "@/lib/format";

const supply = [
    ["circulating_supply", "Circulating supply"],
    ["total_supply", "Total supply"],
    ["max_supply", "Maximum supply"],
] as const;

export function CoinProfile({ coin }: { coin: V2Coin }) {
    return (
        <>
            <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-4">
                <div className="min-w-0 bg-card p-4">
                    <dt className="text-muted-foreground text-xs">Market cap rank</dt>
                    <dd className="mt-2 text-lg font-semibold tabular-nums">{coin.market_cap_rank === null ? "—" : `#${formatNumber(coin.market_cap_rank)}`}</dd>
                </div>
                {supply.map(([field, label]) => (
                    <div className="min-w-0 bg-card p-4" key={field}>
                        <dt className="text-muted-foreground text-xs">{label}</dt>
                        <dd className="mt-2 break-words font-semibold tabular-nums">
                            {formatNumber(coin[field], { maximumSignificantDigits: 16 })}
                            {coin[field] !== null && (
                                <span className="text-muted-foreground text-xs font-normal">
                                    {" "}
                                    {coin.symbol ?? "coins"}
                                </span>
                            )}
                        </dd>
                    </div>
                ))}
            </dl>
            <section aria-labelledby="coin-profile-heading" className="space-y-4 rounded-lg border p-4">
                <h3 className="text-sm font-semibold" id="coin-profile-heading">Coin profile</h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-4 lg:grid-cols-4">
                    <div>
                        <dt className="text-muted-foreground text-xs">Coin ID</dt>
                        <dd className="mt-1 break-words">{coin.slug}</dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground text-xs">Symbol</dt>
                        <dd className="mt-1">{coin.symbol ?? "—"}</dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground text-xs">Quote currency</dt>
                        <dd className="mt-1">{coin.currency}</dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground text-xs">Status</dt>
                        <dd className="mt-1"><Badge variant="outline">{coin.is_active ? "Active" : "Inactive"}</Badge></dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground text-xs">Genesis date</dt>
                        <dd className="mt-1 tabular-nums">{formatDay(coin.genesis_date)}</dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground text-xs">Hashing algorithm</dt>
                        <dd className="mt-1">{coin.hashing_algorithm ?? "—"}</dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground text-xs">Available data</dt>
                        <dd className="mt-1">{coin.datasets.includes("profile") ? "Profile" : "—"}</dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground text-xs">Profile updated</dt>
                        <dd className="mt-1 tabular-nums"><time dateTime={coin.updated_at}>{formatInstant(coin.updated_at, "UTC")}</time></dd>
                    </div>
                    <div className="col-span-2">
                        <dt className="text-muted-foreground text-xs">Categories</dt>
                        <dd className="mt-1 flex flex-wrap gap-1">{coin.categories.length ? coin.categories.map(category => <Badge key={category} variant="secondary">{category}</Badge>) : "—"}</dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground text-xs">Source</dt>
                        <dd className="mt-1">
                            <a className="inline-flex items-center gap-1 underline-offset-4 hover:underline" href={coin.source_url} rel="noreferrer" target="_blank">
                                {coin.source}
                                <ArrowUpRightIcon className="size-3.5" />
                            </a>
                        </dd>
                    </div>
                </dl>
            </section>
        </>
    );
}
