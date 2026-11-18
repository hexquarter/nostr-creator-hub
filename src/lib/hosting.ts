/**
 * GitHub Pages deploys are pure static files, so TanStack Start server
 * functions have nowhere to run. The deploy workflow sets
 * `VITE_STATIC_HOSTING=true`; features that need a server fall back to a
 * browser-only path or explain the limitation.
 */
export const IS_STATIC_HOSTING = import.meta.env.VITE_STATIC_HOSTING === "true";
