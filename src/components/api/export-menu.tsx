import { Download } from "lucide-react";
import * as React from "react";

import type { OperationId } from "@/lib/api/operations.gen";
import type { ExportColumn } from "@/lib/export";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { OPERATIONS } from "@/lib/api/operations.gen";
import { downloadCsv, downloadJson, exportFileName } from "@/lib/export";
import { formatNumber } from "@/lib/format";

/** "Load all" stops after this many more pages (the API states no total; a runaway list never empties the credits). */
export const LOAD_ALL_MAX_PAGES = 25;

/** What a table exports: the file name's scope + dataset, optional columns (default: every API field, flattened). */
export type ExportConfig<TRow> = {
    columns?: ReadonlyArray<ExportColumn<TRow>>;
    dataset: string;
    scope: string;
};

/** The confirm text of "load all" (pure, tested). */
export function loadAllText(operationId: OperationId | undefined, loaded: number) {
    const credits = operationId ? OPERATIONS[operationId].credits : null;

    const cost = credits === null
        ? "Each page is billed."
        : `Each page costs ${formatNumber(credits)} ${credits === 1 ? "credit" : "credits"} (${OPERATIONS[operationId!].summary}), so at most ${formatNumber(credits * LOAD_ALL_MAX_PAGES)} credits.`;

    return `${formatNumber(loaded)} rows are loaded. The API states no total, so the number of pages is unknown: up to ${LOAD_ALL_MAX_PAGES} more pages are loaded one after another. ${cost}`;
}

/**
 * The "Export" menu of a list (`DataTable`'s `exportConfig`): CSV / JSON of the rows loaded so far, "N rows loaded",
 * and "Load all" (asks first, naming the per-page cost; stops at the last page, after a failed page or after
 * `LOAD_ALL_MAX_PAGES`).
 */
export function ExportMenu<TRow>({
    config,
    failed,
    hasNextPage,
    isFetchingNextPage,
    onLoadMore,
    operationId,
    rows,
}: {
    config: ExportConfig<TRow>;
    failed: boolean;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    onLoadMore?: () => void;
    /** The list operation (its `x-credits` is the "load all" cost); none = the dialog names no price. */
    operationId?: OperationId;
    rows: ReadonlyArray<TRow>;
}) {
    const [confirming, setConfirming] = React.useState(false);

    const [loadingAll, setLoadingAll] = React.useState(false);

    const [pagesAsked, setPagesAsked] = React.useState(0);

    // The row count when a page was asked (null = none in flight) and whether its fetch was seen running: a render in
    // between never asks the same page twice, and a page that added no row (a failed or empty page) ends the run.
    const askedAt = React.useRef<null | number>(null);

    const started = React.useRef(false);

    const rowCount = rows.length;

    React.useEffect(() => {
        if (!loadingAll) return;

        if (isFetchingNextPage) {
            started.current = true;

            return;
        }

        if (askedAt.current !== null) {
            if (!started.current) return;

            const grew = rowCount > askedAt.current;

            askedAt.current = null;

            started.current = false;

            if (!grew) {
                setLoadingAll(false);

                return;
            }
        }

        if (!hasNextPage || failed || !onLoadMore || pagesAsked >= LOAD_ALL_MAX_PAGES) {
            setLoadingAll(false);

            return;
        }

        askedAt.current = rowCount;

        setPagesAsked(count => count + 1);

        onLoadMore();
    }, [failed, hasNextPage, isFetchingNextPage, loadingAll, onLoadMore, pagesAsked, rowCount]);

    const canLoadAll = hasNextPage && !!onLoadMore;

    const name = (extension: "csv" | "json") => exportFileName(config.scope, config.dataset, extension);

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger render={<Button disabled={rows.length === 0 && !canLoadAll} size="sm" type="button" variant="outline" />}>
                    <Download />
                    {loadingAll ? `Loading… ${formatNumber(rows.length)}` : "Export"}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-56">
                    <DropdownMenuGroup>
                        <DropdownMenuLabel>{`${formatNumber(rows.length)} rows loaded${hasNextPage ? " (more available)" : ""}`}</DropdownMenuLabel>
                        <DropdownMenuItem disabled={rows.length === 0} onClick={() => downloadCsv(rows, name("csv"), config.columns)}>
                            CSV (.csv)
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={rows.length === 0} onClick={() => downloadJson(rows, name("json"))}>
                            JSON (.json)
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                    {canLoadAll && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem disabled={loadingAll} onClick={() => setConfirming(true)}>
                                Load all pages first…
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialog onOpenChange={setConfirming} open={confirming}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Load every page?</AlertDialogTitle>
                        <AlertDialogDescription>{loadAllText(operationId, rows.length)}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                setPagesAsked(0);

                                askedAt.current = null;

                                started.current = false;

                                setLoadingAll(true);

                                setConfirming(false);
                            }}
                        >
                            Load all
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
