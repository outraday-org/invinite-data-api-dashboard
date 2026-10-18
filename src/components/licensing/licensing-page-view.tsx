import { CheckIcon } from "lucide-react";

import type { LicenseRight, LicensingFamily, LicensingResponse } from "@/lib/api/types";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    describeEarningsScope,
    FAMILY_LABELS,
    LICENSE_TIERS,
    RIGHT_LABELS,
    TIER_LABELS,
} from "@/lib/licensing/labels";
import { ENTERPRISE_TIER, SELF_SERVE_TIERS, VOLUME_PRICING_NOTE } from "@/lib/pricing-posture";

// The notes shown after the per-family routes (`audio` sits under the matrix with the resale callout).
const TRAILING_NOTES = ["display", "redistribute", "rag", "train", "sec_data"] as const satisfies ReadonlyArray<keyof LicensingResponse["notes"]>;

const NOTE_TITLES: Record<(typeof TRAILING_NOTES)[number], string> = {
    display: "Display",
    rag: "RAG (retrieval-augmented generation)",
    redistribute: "Redistribution",
    sec_data: "SEC data",
    train: "Model training",
};

// The `resell` right is never granted on any plan; its column carries the resale footnote.
const RESELL: LicenseRight = "resell";

function NotIncluded() {
    return (
        <>
            <span aria-hidden className="text-muted-foreground">–</span>
            <span className="sr-only">Not included</span>
        </>
    );
}

function RightsMatrix({ licensing }: { licensing: LicensingResponse }) {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Plan</TableHead>
                    {licensing.rights.map(right => (
                        <TableHead className="text-center" key={right}>
                            {RIGHT_LABELS[right]}
                            {right === RESELL && <sup aria-hidden>*</sup>}
                        </TableHead>
                    ))}
                </TableRow>
            </TableHeader>
            <TableBody>
                {LICENSE_TIERS.map(tier => (
                    <TableRow key={tier}>
                        <TableCell className="font-medium">{TIER_LABELS[tier]}</TableCell>
                        {licensing.rights.map(right => (
                            <TableCell className="text-center" key={right}>
                                {right !== RESELL && licensing.tiers[tier][right]
                                    ? <CheckIcon aria-label="Included" className="mx-auto size-4" role="img" />
                                    : <NotIncluded />}
                            </TableCell>
                        ))}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

function FamilyRoutes({ family }: { family: LicensingFamily }) {
    const headingId = `licensing-family-${family.family}`;

    return (
        <section aria-labelledby={headingId} className="space-y-2">
            <h3 className="text-base font-semibold" id={headingId}>{FAMILY_LABELS[family.family]}</h3>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Route</TableHead>
                        <TableHead>Minimum plan</TableHead>
                        <TableHead>Right</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {family.routes.map(route => (
                        <TableRow key={route.route}>
                            <TableCell className="font-mono text-xs">{route.route}</TableCell>
                            <TableCell>
                                <Badge variant="outline">{TIER_LABELS[route.tier]}</Badge>
                            </TableCell>
                            <TableCell>{RIGHT_LABELS[route.license]}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </section>
    );
}

function PricingPosture() {
    return (
        <section aria-labelledby="licensing-pricing" className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight" id="licensing-pricing">Pricing</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[...SELF_SERVE_TIERS, ENTERPRISE_TIER].map(tier => (
                    <Card key={tier.name} size="sm">
                        <CardHeader className="gap-1">
                            <CardTitle className="text-sm">{tier.name}</CardTitle>
                            <CardDescription className="text-foreground text-lg font-semibold">{tier.price}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="text-muted-foreground list-disc space-y-1 pl-4">
                                {tier.includes.map(item => <li key={item}>{item}</li>)}
                            </ul>
                        </CardContent>
                    </Card>
                ))}
            </div>
            <p className="text-muted-foreground text-sm">{VOLUME_PRICING_NOTE}</p>
        </section>
    );
}

function universeLine(universe: LicensingResponse["universe"]) {
    const companies = universe.companies === null
        ? "US-listed companies"
        : `${universe.companies.toLocaleString("en")} US-listed companies`;

    const scope = describeEarningsScope(universe.earnings_calls.scope) ?? "scope not published";

    return `${companies} in the data sets · earnings calls: ${scope}`;
}

/** The licensing page body for a loaded policy. */
export function LicensingContent({ licensing }: { licensing: LicensingResponse }) {
    return (
        <>
            {!licensing.counsel_signed_off && (
                <div className="border-destructive/40 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm font-medium" role="note">
                    Draft — pending counsel sign-off
                </div>
            )}

            <section aria-labelledby="licensing-matrix" className="space-y-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                    <h2 className="text-xl font-semibold tracking-tight" id="licensing-matrix">Rights per plan</h2>
                    <p className="text-muted-foreground text-xs">{universeLine(licensing.universe)}</p>
                </div>
                <RightsMatrix licensing={licensing} />
                <p className="text-muted-foreground text-xs">
                    <span aria-hidden>* </span>
                    {`Resell is not included on any plan. ${licensing.resale}`}
                </p>
                <Card className="border-primary/40" size="sm">
                    <CardHeader>
                        <CardTitle className="text-sm">No resale as your own data</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <p>{licensing.resale}</p>
                        <p className="text-muted-foreground">{licensing.notes.audio}</p>
                    </CardContent>
                </Card>
            </section>

            <section aria-labelledby="licensing-routes" className="space-y-6">
                <h2 className="text-xl font-semibold tracking-tight" id="licensing-routes">Routes by product family</h2>
                {licensing.families.map(family => <FamilyRoutes family={family} key={family.family} />)}
            </section>

            <section aria-labelledby="licensing-notes" className="space-y-4">
                <h2 className="text-xl font-semibold tracking-tight" id="licensing-notes">Notes</h2>
                <dl className="space-y-3">
                    {TRAILING_NOTES.map(note => (
                        <div key={note}>
                            <dt className="text-sm font-medium">{NOTE_TITLES[note]}</dt>
                            <dd className="text-muted-foreground text-sm">{licensing.notes[note]}</dd>
                        </div>
                    ))}
                </dl>
            </section>

            <PricingPosture />
        </>
    );
}

export type LicensingPageViewProps = {
    data: LicensingResponse | null;
    error: unknown;
    isLoading: boolean;
};

/** The public licensing page, prop-driven (the route only wires the query). */
export function LicensingPageView({ data, error, isLoading }: LicensingPageViewProps) {
    return (
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 lg:px-8">
            <header className="space-y-2">
                <p className="text-primary text-xs tracking-[0.2em] uppercase">Invinite API</p>
                <h1 className="text-3xl font-bold tracking-tight">Licensing</h1>
                <p className="text-muted-foreground text-sm">
                    What each plan may do with the data, per route.
                    {data && ` Policy version ${data.policy_version}.`}
                </p>
            </header>
            {isLoading && (
                <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-48 w-full" />
                    <Skeleton className="h-32 w-full" />
                </div>
            )}
            {!isLoading && Boolean(error) && <ErrorState error={error} title="Licensing failed to load" />}
            {data && <LicensingContent licensing={data} />}
        </div>
    );
}
