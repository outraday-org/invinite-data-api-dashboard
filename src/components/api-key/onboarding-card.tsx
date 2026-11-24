import { KeyRound } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer } from "@/components/ui/page-container";
import { useApiKeyStore } from "@/lib/stores/api-key-store";

import { ApiKeyInlineField } from "./api-key-inline";

const SHOWS = [
    "Market pages: the earnings calendar, live calls, IPOs and market holidays",
    "Every US stock, ETF, closed-end fund and ETN: profile, financials, filings, holdings and holders",
    "Earnings calls with transcript, audio, slides and guidance; live calls as they happen",
    "SEC filers and 13F institutions with their portfolios",
];

/**
 * What a visitor without a usable key sees instead of any page (the key gate): the key field (validated on save), where
 * to create a key and what the dashboard shows. `refused` = a stored key the API answered 401.
 */
export function OnboardingCard({ refused }: { refused: boolean }) {
    const hasKey = useApiKeyStore(s => s.hasHydrated && Boolean(s.apiKey));

    return (
        <PageContainer data-testid="onboarding-card" width="narrow">
            <Card>
                <CardHeader className="gap-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <KeyRound className="text-primary size-4" />
                        {refused && hasKey ? "Your API key was refused" : "Enter your API key"}
                    </CardTitle>
                    <CardDescription>
                        {refused && hasKey
                            ? "The Data API answered 401 for the stored key: it was revoked or mistyped. Enter a valid key to continue."
                            : "This dashboard shows what the Invinite Data API serves, read with your own key. The key stays in this browser."}
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <ApiKeyInlineField />
                    <div className="flex flex-col gap-1.5">
                        <p className="text-muted-foreground font-medium">What you can explore</p>
                        <ul className="text-muted-foreground list-disc space-y-0.5 pl-4">
                            {SHOWS.map(line => <li key={line}>{line}</li>)}
                        </ul>
                    </div>
                </CardContent>
            </Card>
        </PageContainer>
    );
}
