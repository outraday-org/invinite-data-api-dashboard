import * as React from "react";

const MOBILE_BREAKPOINT_PX = 768;

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
