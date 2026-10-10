/** The window choices of the status page (`?days=`). */
export const STATUS_WINDOWS = [7, 30, 90] as const;

export type StatusWindow = (typeof STATUS_WINDOWS)[number];

export const DEFAULT_STATUS_WINDOW: StatusWindow = 30;

export const ALL_VENDORS = "all";

/** A webcast vendor key as IDA accepts it (`/status/earnings-calls?vendor=`). */
export const VENDOR_PATTERN = /^[a-z0-9_]{1,24}$/;

export type StatusSearch = {
    days: StatusWindow;
    vendor?: string;
};

function isStatusWindow(value: number): value is StatusWindow {
    return STATUS_WINDOWS.some(window => window === value);
}

/**
 * `validateSearch` of `/status`: an unknown window falls back to 30 days; `vendor=all` is the default
 * (omitted), and a vendor IDA would reject (not `VENDOR_PATTERN`) falls back to it.
 */
export function validateStatusSearch(search: Record<string, unknown>): StatusSearch {
    const days = Number(search.days);

    const vendor = typeof search.vendor === "string" ? search.vendor.trim() : "";

    return {
        days: isStatusWindow(days) ? days : DEFAULT_STATUS_WINDOW,
        vendor: VENDOR_PATTERN.test(vendor) && vendor !== ALL_VENDORS ? vendor : undefined,
    };
}
