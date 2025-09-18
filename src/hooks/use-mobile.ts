import { useEffect, useMemo, useState } from "react";

/**
 * useIsMobile
 * Detects if viewport width is below Tailwind's `sm` breakpoint (640px by default).
 * Safe for SSR and updates on resize and orientation changes.
 */
export function useIsMobile(breakpointPx: number = 640) {
  const getMatch = () => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia(`(max-width: ${breakpointPx}px)`).matches;
  };

  const [isMobile, setIsMobile] = useState<boolean>(() => getMatch());

  // Media query listener (more efficient than resize)
  const mql = useMemo(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined as MediaQueryList | undefined;
    return window.matchMedia(`(max-width: ${breakpointPx}px)`);
  }, [breakpointPx]);

  useEffect(() => {
    if (!mql) return;
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    // Initialize in case SSR mismatch
    setIsMobile(mql.matches);

    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    } else {
      // Safari <14 fallback
      // @ts-ignore - older API
      mql.addListener(handler);
      // @ts-ignore - older API
      return () => mql.removeListener(handler);
    }
  }, [mql]);

  return isMobile;
}
