/** Canonical sending domain. Override only for isolated non-production tests. */
export const OUTBOUND_DOMAIN = (process.env.OUTBOUND_DOMAIN || "respon-do.com").trim().toLowerCase();
