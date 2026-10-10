import type { FreshnessRow } from "@/lib/api/types";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    datasetLabel,
    familyLabel,
    formatAgeHours,
    formatUtcDateTime,
    FRESHNESS_REASON_LABELS,
} from "@/lib/status/labels";

import { StatePanel } from "./chart-parts";

/** Newest ingest per dataset; a row with a `reason` shows the reason, never a date. */
export function FreshnessSection({ freshness }: { freshness: Array<FreshnessRow> | null }) {
    if (freshness === null) return <StatePanel>Freshness unavailable</StatePanel>;

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Dataset</TableHead>
                    <TableHead>Product family</TableHead>
                    <TableHead>Newest</TableHead>
                    <TableHead className="text-right">Age</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {freshness.map(row => (
                    <TableRow key={row.dataset}>
                        <TableCell>{datasetLabel(row.dataset)}</TableCell>
                        <TableCell>{familyLabel(row.family)}</TableCell>
                        {row.reason
                            ? (
                                    <TableCell className="text-muted-foreground" colSpan={2}>
                                        {FRESHNESS_REASON_LABELS[row.reason]}
                                    </TableCell>
                                )
                            : (
                                    <>
                                        <TableCell>{formatUtcDateTime(row.newest)}</TableCell>
                                        <TableCell className="text-right tabular-nums">{formatAgeHours(row.age_hours)}</TableCell>
                                    </>
                                )}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
