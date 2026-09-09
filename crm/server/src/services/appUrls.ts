import { Request } from 'express';

/**
 * Single source of truth for the password-reset URLs.
 *
 * The CRM SPA (mounted at /crm — see index.ts) owns the only forgot-password
 * and reset-password pages. The workflow SPA deliberately does NOT carry its
 * own copy: its "Forgot password?" link points at GET /auth/forgot-password,
 * which redirects here. One implementation, one set of URLs, so a change to
 * either app cannot leave the other pointing somewhere dead.
 *
 * Origin resolution, in order:
 *   1. The host the caller is actually on. This is the reliable one — it can
 *      never disagree with where the app is really served. APP_URL was set to
 *      the apex (signalridgestrategies.com) while the app only answers on www,
 *      so every generated link 404'd; deriving from the request removes that
 *      whole class of misconfiguration.
 *   2. APP_URL, for callers with no request context.
 *   3. The local dev default.
 *
 * Host-header note: an attacker-supplied Host could steer these URLs, which is
 * the classic reset-poisoning shape. It does not apply here — the reset link is
 * displayed to whoever submits the form, never mailed to a third party, so a
 * forged host only ever poisons the attacker's own link.
 */

const CRM_BASE_PATH = '/crm';
const WORKFLOW_HOME = '/workflow/';

/** Where a completed reset should return the user. */
export type ReturnApp = 'workflow' | 'crm';

export function parseReturnApp(value: unknown): ReturnApp {
  return value === 'workflow' ? 'workflow' : 'crm';
}

function originFromRequest(req?: Request): string | null {
  if (!req) return null;
  const host = req.get('x-forwarded-host') || req.get('host');
  if (!host) return null;
  // Railway terminates TLS upstream, so req.protocol is http here; trust the
  // forwarded protocol and default to https for any non-local host.
  const forwarded = (req.get('x-forwarded-proto') || '').split(',')[0].trim();
  const proto = forwarded || (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? 'http' : 'https');
  return `${proto}://${host}`;
}

/** Absolute base URL of the app, with no trailing slash. */
export function appOrigin(req?: Request): string {
  const fromReq = originFromRequest(req);
  if (fromReq) return fromReq.replace(/\/+$/, '');
  return (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '');
}

/** Absolute base URL of the CRM SPA. Tolerates APP_URL with or without /crm. */
export function crmAppUrl(req?: Request): string {
  const base = appOrigin(req);
  return base.endsWith(CRM_BASE_PATH) ? base : `${base}${CRM_BASE_PATH}`;
}

/** Where "Back to sign in" and a completed reset should land. */
export function signInUrl(req: Request | undefined, from: ReturnApp): string {
  const base = appOrigin(req).replace(new RegExp(`${CRM_BASE_PATH}$`), '');
  return from === 'workflow' ? `${base}${WORKFLOW_HOME}` : `${crmAppUrl(req)}/login`;
}

export function forgotPasswordUrl(req?: Request, from: ReturnApp = 'crm'): string {
  const url = `${crmAppUrl(req)}/forgot-password`;
  return from === 'workflow' ? `${url}?from=workflow` : url;
}

export function resetPasswordUrl(token: string, req?: Request, from: ReturnApp = 'crm'): string {
  const url = `${crmAppUrl(req)}/reset-password?token=${encodeURIComponent(token)}`;
  return from === 'workflow' ? `${url}&from=workflow` : url;
}
