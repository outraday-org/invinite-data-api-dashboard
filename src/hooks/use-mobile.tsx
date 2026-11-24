import * as React from "react";

// Below 1024 px the sidebar is off-canvas (a sheet): docked, its 232 px left too little room for tables (ui-redesign F9).
export const MOBILE_BREAKPOINT_PX = 1024;

export function useIsMobile() {
    // False on the server AND on the first client render (the hydrated markup must match the server's); the effect
    // then reads the viewport. Reading `matchMedia` in the initializer made a phone render mismatch (the sidebar).
    const [isMobile, setIsMobile] = React.useState(false);

    React.useEffect(() => {
        const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`);

        const onChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);

        setIsMobile(mql.matches);

        // Safari < 14 fallback
        if ("addEventListener" in mql) {
            mql.addEventListener("change", onChange);

            return () => mql.removeEventListener("change", onChange);
        }

        (mql as any).addListener(onChange);

        return () => (mql as any).removeListener(onChange);
    }, []);

    return isMobile;
}
