// Feature flags for StudentPilot UI and API
// In production (Render), VITE_MOCK_SEARCH should be unset or "0".
// Locally, you can set VITE_MOCK_SEARCH=1 in .env.local to see mock internships when the scraper fails.

export const IS_DEV = import.meta.env.DEV;

export const USE_MOCK_SEARCH =
  (import.meta.env.VITE_MOCK_SEARCH ?? (IS_DEV ? "1" : "0")) === "1";

export const ENABLE_RESULTS_PANEL =
  (import.meta.env.VITE_ENABLE_RESULTS_PANEL ?? "1") === "1";
