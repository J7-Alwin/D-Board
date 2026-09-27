/**
 * Application feature flags.
 *
 * Feature flags are configured via Vite environment variables (prefixed with VITE_).
 */

export const GOOGLE_AUTH_ENABLED: boolean =
  import.meta.env.VITE_ENABLE_GOOGLE_AUTH === 'true';
