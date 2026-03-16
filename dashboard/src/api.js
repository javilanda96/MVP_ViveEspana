/**
 * Typed API client for the /admin/* endpoints.
 *
 * All requests are same-origin, credentials:"include" so the HttpOnly session
 * cookie is sent automatically by the browser.  ADMIN_API_KEY is never
 * present in this file or in any built asset.
 */
// ─── Core fetch wrapper ───────────────────────────────────────────────────────
export class UnauthorizedError extends Error {
    constructor() { super("Unauthorized"); this.name = "UnauthorizedError"; }
}
async function apiFetch(path, options) {
    const res = await fetch(`/admin${path}`, {
        ...options,
        credentials: "include",
    });
    if (res.status === 401)
        throw new UnauthorizedError();
    if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`${res.status}: ${text}`);
    }
    return res.json();
}
function toQS(params) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== "")
            qs.set(k, String(v));
    }
    const s = qs.toString();
    return s ? `?${s}` : "";
}
// ─── Auth ─────────────────────────────────────────────────────────────────────
/** Check whether the current session cookie is valid without side-effects. */
export async function checkAuth() {
    const res = await fetch("/admin/stats", { credentials: "include" });
    return res.status !== 401;
}
export async function login(key) {
    const res = await fetch("/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
        credentials: "include",
    });
    return res.ok;
}
export async function logout() {
    await fetch("/admin/logout", { method: "POST", credentials: "include" });
}
// ─── Dashboard data ───────────────────────────────────────────────────────────
export const getStats = () => apiFetch("/stats");
export const getIntegrations = () => apiFetch("/integrations");
export const getEvents = (f) => apiFetch(`/events${toQS(f)}`);
export const getEventById = (id) => apiFetch(`/events/${id}`);
export const getErrors = (f) => apiFetch(`/errors${toQS(f)}`);
export const getPipeline = (f) => apiFetch(`/pipeline${toQS(f)}`);
