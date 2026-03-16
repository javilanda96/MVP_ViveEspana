/** Format an ISO timestamp to a short locale string, or "—" if absent. */
export function fmtDate(iso) {
    if (!iso)
        return "—";
    return new Date(iso).toLocaleString("es-ES", {
        dateStyle: "short",
        timeStyle: "short",
    });
}
/** Escape HTML special characters to prevent injection via DB content. */
export function esc(s) {
    if (s === null || s === undefined)
        return "—";
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
/** Render a status badge span. */
export function statusBadge(status) {
    const cls = status === "processed" ? "badge-processed" :
        status === "failed" ? "badge-failed" :
            "badge-received";
    return `<span class="badge ${cls}">${esc(status)}</span>`;
}
/** Build a pagination control element. */
export function buildPagination(total, limit, offset, onNav) {
    const wrap = document.createElement("div");
    wrap.className = "pagination";
    const totalPages = Math.ceil(total / limit) || 1;
    const page = Math.floor(offset / limit) + 1;
    const prev = document.createElement("button");
    prev.textContent = "← Prev";
    prev.disabled = offset === 0;
    prev.addEventListener("click", () => onNav(Math.max(0, offset - limit)));
    const info = document.createElement("span");
    info.textContent = `Page ${page} of ${totalPages}  (${total} total)`;
    const next = document.createElement("button");
    next.textContent = "Next →";
    next.disabled = offset + limit >= total;
    next.addEventListener("click", () => onNav(offset + limit));
    wrap.append(prev, info, next);
    return wrap;
}
/** Pretty-print JSON for the payload viewer. */
export function prettyJson(obj) {
    try {
        return JSON.stringify(obj, null, 2);
    }
    catch {
        return String(obj);
    }
}
