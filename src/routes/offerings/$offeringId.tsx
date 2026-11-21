import type * as React from "react";

import { createFileRoute, Link } from "@tanstack/react-router";

import type { V2OfferingDetail } from "@/lib/api/types";

import { FactGrid } from "@/components/sec/ownership-views";
import { exemptionLabel, offeringAmountText } from "@/components/sec/sec-filer-views";
import { SecReadinessNotice } from "@/components/sec/sec-readiness-notice";
import { filerCikParam } from "@/components/sec/security-link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copyable } from "@/components/ui/copy-button";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOffering } from "@/lib/api/queries";
import { formatDay, formatMoney } from "@/lib/format";
import { titleHead } from "@/lib/layout";
import { OFFERING_ID_PATTERN, yesNoText as yesNo } from "@/lib/sec/ownership";
import { formatNumberEn } from "@/lib/utils";

export const Route = createFileRoute("/offerings/$offeringId")({
    component: OfferingPage,
    head: ({ params }) => titleHead(`Offering ${params.offeringId}`),
});

const usd = (value: null | number) => (value === null ? null : formatMoney(value, { maximumFractionDigits: 0 }));

const countText = (value: null | number) => (value === null ? null : formatNumberEn(value));

/** A filer CIK as a link to its page ("CIK 2122354"). */
function CikLink({ children, cik }: { children?: React.ReactNode; cik: null | string }) {
    const param = filerCikParam(cik);

    if (!param) return <span>{children ?? "—"}</span>;

    return (
        <Link className="underline-offset-4 hover:underline" params={{ cik: param }} title={`SEC filer · CIK ${param}`} to="/sec/$cik">
            {children ?? `CIK ${param}`}
        </Link>
    );
}

function Block({ children, title }: { children: React.ReactNode; title: string }) {
    return (
        <Card className="border-border/60 min-w-0">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">{children}</CardContent>
        </Card>
    );
}

/**
 * One Form D offering in full (pure, `GET /v1/offerings/{offering_id}`): the amounts (size, sold, remaining, minimum
 * investment), commissions and finders' fees, investors, the issuer (its filer page, co-issuers), the exemptions, the
 * related persons as filed and the offering's filings.
 */
export function OfferingDetailView({ offering }: { offering: V2OfferingDetail }) {
    const amounts: Array<readonly [string, React.ReactNode]> = [
        ["Offering size", offeringAmountText(offering)],
        ["Sold", usd(offering.total_sold)],
        ["Remaining", offering.indefinite_amount && offering.total_remaining === null ? "Indefinite" : usd(offering.total_remaining)],
        ["Minimum investment", usd(offering.min_investment)],
        ["Sales commissions", usd(offering.sales_commission)],
        ["Finders' fees", usd(offering.finders_fee)],
        ["Investors", countText(offering.investor_count)],
        ["Non-accredited investors", offering.has_non_accredited ? (countText(offering.non_accredited_count) ?? "Yes") : yesNo(offering.has_non_accredited)],
        ["First sale", offering.first_sale_yet_to_occur ? "Yet to occur" : (offering.sale_date ? formatDay(offering.sale_date) : null)],
        ["Lasts more than a year", yesNo(offering.more_than_one_year)],
    ];

    const issuer: Array<readonly [string, React.ReactNode]> = [
        ["Issuer", <CikLink cik={offering.primary_issuer_cik} key="issuer">{offering.issuer_name}</CikLink>],
        ["Co-issuers", offering.co_issuer_ciks.length > 0
            ? <span className="flex flex-wrap gap-2" key="co">{offering.co_issuer_ciks.map(cik => <CikLink cik={cik} key={cik} />)}</span>
            : null],
        ["Entity type", offering.entity_type],
        ["Jurisdiction", offering.jurisdiction],
        ["Incorporated", offering.year_of_inc],
        ["SIC code", offering.sic_code],
        ["Revenue range", offering.revenue_range],
        ["Net asset value range", offering.net_asset_value_range],
    ];

    const terms: Array<readonly [string, React.ReactNode]> = [
        ["Exemptions", offering.exemptions.length > 0 ? offering.exemptions.map(code => `${exemptionLabel(code)}${exemptionLabel(code) === code ? "" : ` (${code})`}`).join(", ") : null],
        ["Industry", offering.industry_group],
        ["Fund type", offering.investment_fund_type],
        ["Securities", offering.security_types.length > 0 ? offering.security_types.map(type => type.replaceAll("_", " ")).join(", ") : null],
        ["Investment Company Act", yesNo(offering.is_40_act)],
        ["Business combination", yesNo(offering.is_business_combination)],
    ];

    const filings: Array<readonly [string, React.ReactNode]> = [
        ["File number", offering.file_number ? <Copyable key="file" label="Copy file number" value={offering.file_number} /> : null],
        ["First filed", offering.filed_first ? formatDay(offering.filed_first) : null],
        ["Latest filed", offering.filed_latest ? formatDay(offering.filed_latest) : null],
        ["Amendments", offering.amendment_count > 0 ? String(offering.amendment_count) : "None"],
        ["History", offering.original_held ? null : "Starts with an amendment (the original Form D is older than the held five years)"],
    ];

    return (
        <div className="grid gap-4 md:grid-cols-2" data-testid="offering-detail">
            <Block title="Amounts">
                <FactGrid facts={amounts} />
            </Block>
            <Block title="Issuer">
                <FactGrid facts={issuer} />
            </Block>
            <Block title="Offering">
                <FactGrid facts={terms} />
            </Block>
            <Block title="Filings">
                <div className="flex flex-col gap-3">
                    <FactGrid facts={filings} />
                    <ul className="flex flex-col gap-1 text-xs">
                        {offering.accessions.map(accession => (
                            <li className="flex items-center gap-2" key={accession}>
                                <Copyable className="tabular-nums" label="Copy accession number" value={accession} />
                                {accession === offering.latest_accession && <Badge variant="secondary">Latest</Badge>}
                            </li>
                        ))}
                    </ul>
                </div>
            </Block>
            <div className="min-w-0 md:col-span-2">
                <Block title="Related persons">
                    {offering.related_persons.length === 0
                        ? <div className="text-muted-foreground">No related person was filed.</div>
                        : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Relationship</TableHead>
                                            <TableHead>Clarification</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {offering.related_persons.map((person, index) => (
                                            // A name can appear twice (two relationships filed separately).
                                            <TableRow key={`${person.name}-${index}`}>
                                                <TableCell className="font-medium">{person.name}</TableCell>
                                                <TableCell>{person.relationships.join(", ") || "—"}</TableCell>
                                                <TableCell className="whitespace-normal">{person.clarification ?? "—"}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                </Block>
            </div>
        </div>
    );
}

/** `/offerings/$offeringId`: one Form D offering (1 credit), reached from `/offerings` and a filer's private offerings. */
function OfferingPage() {
    const { offeringId: rawId } = Route.useParams();

    const offeringId = OFFERING_ID_PATTERN.test(rawId) ? rawId : "";

    const { data, error, isLoading } = useOffering(offeringId);

    const shell = (body: React.ReactNode) => (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 lg:px-8">
            <PageHeader
                description={(
                    <>
                        {`Form D offering ${offeringId || rawId}`}
                        {" · "}
                        <Link className="underline-offset-4 hover:underline" to="/offerings">Every offering</Link>
                    </>
                )}
                title={data?.issuer_name ?? "Private offering"}
            />
            {body}
        </div>
    );

    if (!offeringId) return shell(<Notice badge="Not found" title="This is not an offering id (a Form D file number such as 021-599503, or an accession number)" />);

    if (error) return shell(<SecReadinessNotice error={error} title="Failed to load the offering" />);

    if (isLoading || !data) return shell(<Skeleton className="h-64 w-full" />);

    return shell(<OfferingDetailView offering={data} />);
}
