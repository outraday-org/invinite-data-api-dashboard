/**
 * Public origin of the Invinite Data app, where a Data API account lives (keys, usage, billing) and the docs. A
 * constant, not an entry of `env.ts`: that module is the server's environment (`process.env`), and these links render
 * in the browser.
 */
export const INVINITE_APP_URL = "https://data.invinite.com";

/** The data app's dashboard: `/` (overview), `/keys`, `/usage`, `/billing`. */
export function dataApiDashboardUrl(tab?: "billing" | "keys" | "usage"): string {
    return tab ? `${INVINITE_APP_URL}/${tab}` : INVINITE_APP_URL;
}

/** The Data API docs in the data app. */
export function docsUrl(): string {
    return `${INVINITE_APP_URL}/docs`;
}
