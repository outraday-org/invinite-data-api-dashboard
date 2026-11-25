/**
 * "Filed values" (`/v1/financials/vintages`, financialdatasets-parity 1/4): a statement column's start does not say
 * whether the clicked line is a duration. An instant outside the balance sheet (cash at the end of the period on the
 * cash-flow statement) matches no start and answers 404. Then the first page is asked again by the end alone (the API
 * returns the instants and every duration ending that day). A continuation page (`cursor`) is never re-asked.
 */
export async function readWithInstantFallback<T extends { response: { status: number }; error?: unknown }>(
    read: (periodStart: string | undefined) => Promise<T>,
    periodStart: string | undefined,
    cursor: string | undefined,
): Promise<T> {
    const first = await read(periodStart);

    if (first.error === undefined || first.response.status !== 404 || periodStart === undefined || cursor !== undefined) return first;

    return read(undefined);
}
