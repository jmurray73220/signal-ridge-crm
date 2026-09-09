/**
 * Single source of truth for the password-reset URLs.
 *
 * The CRM SPA (mounted at /crm — see index.ts) owns the only forgot-password
 * and reset-password pages. The workflow SPA deliberately does NOT carry its
 * own copy: its "Forgot password?" link points at GET /auth/forgot-password,
 * which redirects here. So the flow has one implementation and one URL, and
 * changing either app cannot leave the other pointing somewhere dead.
 *
 * APP_URL has been set both with and without the /crm suffix, and the bare
 * domain does not serve the SPA. Normalize both spellings to the same result
 * so a config change on Railway cannot silently produce a broken link.
 */

const CRM_BASE_PATH = '/crm';

export function crmAppUrl(): string {
  const raw = (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '');
  return raw.endsWith(CRM_BASE_PATH) ? raw : `${raw}${CRM_BASE_PATH}`;
}

export function forgotPasswordUrl(): string {
  return `${crmAppUrl()}/forgot-password`;
}

export function resetPasswordUrl(token: string): string {
  return `${crmAppUrl()}/reset-password?token=${encodeURIComponent(token)}`;
}
