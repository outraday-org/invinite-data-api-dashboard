/**
 * Public origin of the Invinite app, where a Data API account lives (keys, usage, billing). A constant, not an
 * entry of `env.ts`: that module is the server's environment (`process.env`), and these links render in the browser.
 */
export const INVINITE_APP_URL = "https://invinite.com";

/** The app's Data API dashboard: `/data-api` (overview), `/data-api/keys`, `/data-api/usage`, `/data-api/billing`. */
export function dataApiDashboardUrl(tab?: "billing" | "keys" | "usage"): string {
    return tab ? `${INVINITE_APP_URL}/data-api/${tab}` : `${INVINITE_APP_URL}/data-api`;
}
