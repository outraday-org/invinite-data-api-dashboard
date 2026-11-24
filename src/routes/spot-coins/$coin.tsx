import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";

import { CoinProfile } from "@/components/coins/coin-profile";
import { PageHeader } from "@/components/ui/page-header";
import { RequestErrorState } from "@/components/ui/request-error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useCoin } from "@/lib/api/coin-queries";
import { useKeyReady } from "@/lib/api/queries";
import { titleHead } from "@/lib/layout";
import { useRecordRecent } from "@/lib/recents";

export const Route = createFileRoute("/spot-coins/$coin")({
    component: CoinPage,
    head: ({ params }) => titleHead(`${params.coin} · Spot coins`),
});

function CoinPage() {
    const { coin: slug } = Route.useParams();

    const { data: coin, error, isLoading } = useCoin(slug, useKeyReady());

    useRecordRecent(coin ? { badge: "Spot coin", kind: "coin", label: coin.symbol ?? coin.slug, name: coin.name, ref: coin.slug } : null);

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 lg:px-8">
            <Link className="text-muted-foreground inline-flex w-fit items-center gap-1.5 hover:underline" to="/spot-coins">
                <ArrowLeftIcon className="size-3.5" />
                Spot coins
            </Link>
            <PageHeader description={coin ? [coin.symbol, "Spot cryptocurrency"].filter(Boolean).join(" · ") : undefined} title={coin?.name ?? slug} />
            {isLoading && <Skeleton aria-label="Loading coin details" className="h-28 w-full" />}
            {error && <RequestErrorState error={error} notFound={{ badge: "Not found", title: "This coin ID was not found." }} tier={{ badge: "Plan required", title: "Your plan does not include this coin." }} title="Failed to load coin details" />}
            {coin && <CoinProfile coin={coin} />}
        </div>
    );
}
