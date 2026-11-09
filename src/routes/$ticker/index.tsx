import { createFileRoute, Link } from "@tanstack/react-router";

import type { V2CompanyCoverage } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Notice } from "@/components/ui/notice";
import { ApiRequestError } from "@/lib/api/errors";
import { useV2Company } from "@/lib/api/queries";
import { coverageEntries } from "@/lib/api/v2";
import { formatEnDateTime } from "@/lib/date";

export const Route = createFileRoute("/$ticker/")({
    component: TickerOverview,
});

function TickerOverview() {
    const { ticker } = Route.useParams();

    const { data: company, error, isLoading } = useV2Company(ticker, { expand: ["coverage"] });

    if (error instanceof ApiRequestError && error.code === "not_covered") {
        return <Notice badge="Not covered" title={`${ticker} is not covered by the Invinite API`}>{error.message}</Notice>;
    }

    if (error) {
        return <ErrorState error={error} title="Failed to load company details" />;
    }

    if (isLoading) {
        return <div className="text-muted-foreground">Loading company details...</div>;
    }

    if (!company) {
        return <div className="text-muted-foreground">No company data found.</div>;
    }

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-border/60">
                <CardHeader>
                    <CardTitle>Company Info</CardTitle>
                    <CardDescription>Basic details from the Invinite API</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Ticker</span>
                        <span className="font-medium">{company.ticker}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">CIK</span>
                        {company.filer_cik
                            ? (
                                    <Link
                                        className="font-medium underline-offset-4 hover:underline"
                                        params={{ cik: company.filer_cik }}
                                        title="SEC filer: identity, lifecycle and filings"
                                        to="/sec/$cik"
                                    >
                                        {company.cik}
                                    </Link>
                                )
                            : <span className="font-medium">{company.cik}</span>}
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Sector</span>
                        <span className="font-medium">{company.sector}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Industry</span>
                        <span className="font-medium">{company.industry}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Currency</span>
                        <span className="font-medium">{company.currency}</span>
                    </div>
                    {company.employees && (
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Employees</span>
                            <span className="font-medium">
                                {company.employees.toLocaleString()}
                            </span>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="border-border/60">
                <CardHeader>
                    <CardTitle>Market Data</CardTitle>
                    <CardDescription>Key financial metrics</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                    {company.market_cap && (
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Market Cap</span>
                            <span className="font-medium">
                                $
                                {(company.market_cap / 1e9).toFixed(2)}
                                B
                            </span>
                        </div>
                    )}
                    {company.shares_outstanding && (
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Shares Outstanding</span>
                            <span className="font-medium">
                                {(company.shares_outstanding / 1e6).toFixed(1)}
                                M
                            </span>
                        </div>
                    )}
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Exchange</span>
                        <span className="font-medium">{company.exchange ?? "-"}</span>
                    </div>
                    {company.employees && (
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Employees</span>
                            <span className="font-medium">
                                {company.employees.toLocaleString()}
                            </span>
                        </div>
                    )}
                    {company.list_date && (
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Listed since</span>
                            <span className="font-medium">
                                {formatEnDateTime(company.list_date, { hideTime: true })}
                            </span>
                        </div>
                    )}
                </CardContent>
            </Card>

            <CoverageCard coverage={company.coverage} />

            {company.description && (
                <Card className="border-border/60 md:col-span-2">
                    <CardHeader>
                        <CardTitle>Description</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            {company.description}
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

/** `expand=coverage`: which data families hold rows for the company and through which day. */
function CoverageCard({ coverage }: { coverage: null | undefined | V2CompanyCoverage }) {
    const entries = coverageEntries(coverage);

    return (
        <Card className="border-border/60 md:col-span-2">
            <CardHeader>
                <CardTitle>Data available</CardTitle>
                <CardDescription>The data families that hold rows for this company</CardDescription>
            </CardHeader>
            <CardContent>
                {entries.length === 0
                    ? <div className="text-muted-foreground text-sm">No data family holds rows for this company yet.</div>
                    : (
                            <div className="flex flex-wrap gap-2">
                                {entries.map(entry => <Badge key={entry.family} variant="secondary">{entry.text}</Badge>)}
                            </div>
                        )}
            </CardContent>
        </Card>
    );
}
