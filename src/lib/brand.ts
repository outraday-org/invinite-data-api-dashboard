// The brand mark (copied from the invinite repo's `public/brand/` + `favicon.ico`). The `?v=` busts the
// browser's favicon cache, which keeps the old bytes for a redrawn file at the same URL: bump it with the files.
export const BRAND_ICON_VERSION = "99ea9cdc";

/** A brand file's URL with the cache-busting version (head links, the top bar, the phone sidebar's brand row). */
export const brandIconHref = (path: string): string => `${path}?v=${BRAND_ICON_VERSION}`;
