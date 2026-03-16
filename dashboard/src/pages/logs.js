import { getEvents, getEventById } from "../api.js";
import { fmtDate, esc, statusBadge, buildPagination, prettyJson } from "../utils.js";
import { openModal } from "../modal.js";
const LIMIT = 50;
export async function renderLogs(container) {
    let filter = { limit: LIMIT, offset: 0 };
    async function load(offset) {
        filter = { ...filter, offset };
        const res = await getEvents(filter);
        container.innerHTML = `
      <section class="page">
        <h2>Execution Logs</h2>

        <div class="filters" id="log-filters">
          <label>Source
            <select id="f-source">
              <option value="">All</option>
              <option value="ghl"    ${filter.source === "ghl" ? "selected" : ""}>GHL</option>
              <option value="stripe" ${filter.source === "stripe" ? "selected" : ""}>Stripe</option>
            </select>
          </label>
          <label>Status
            <select id="f-status">
              <option value="">All</option>
              <option value="processed" ${filter.status === "processed" ? "selected" : ""}>processed</option>
              <option value="failed"    ${filter.status === "failed" ? "selected" : ""}>failed</option>
              <option value="received"  ${filter.status === "received" ? "selected" : ""}>received</option>
            </select>
          </label>
          <label>Event type
            <input type="text" id="f-event-type" placeholder="e.g. payment.created" value="${esc(filter.event_type ?? "")}" />
          </label>
          <label>External event ID
            <input type="text" id="f-ext-id" placeholder="exact match" value="${esc(filter.external_event_id ?? "")}" />
          </label>
          <label>From
            <input type="datetime-local" id="f-from" value="${filter.from ?? ""}" />
          </label>
          <label>To
            <input type="datetime-local" id="f-to"   value="${filter.to ?? ""}" />
          </label>
          <button id="btn-apply">Apply</button>
          <button id="btn-clear" class="btn-clear">Clear</button>
        </div>

        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Source</th>
                <th>Event type</th>
                <th>Status</th>
                <th>External event ID</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              ${res.data.length === 0
            ? `<tr><td colspan="6" class="muted" style="text-align:center;padding:2rem">No events found</td></tr>`
            : res.data.map(row => `
                  <tr class="clickable" data-id="${esc(row.id)}">
                    <td>${fmtDate(row.created_at)}</td>
                    <td><code>${esc(row.webhook_source)}</code></td>
                    <td><code>${esc(row.event_type)}</code></td>
                    <td>${statusBadge(row.status)}</td>
                    <td class="wrap"><code>${esc(row.external_event_id)}</code></td>
                    <td class="wrap ${row.error_message ? "text-danger" : "muted"}">
                      ${row.error_message ? esc(row.error_message.slice(0, 120)) + (row.error_message.length > 120 ? "…" : "") : "—"}
                    </td>
                  </tr>
                `).join("")}
            </tbody>
          </table>
        </div>

        <div id="pagination"></div>

        <p class="note">
          ⚠ This log only shows events that reached the service layer and were persisted.
          Auth-rejected requests and schema validation failures do not appear here.
        </p>
      </section>
    `;
        // Pagination
        container.querySelector("#pagination").replaceWith(buildPagination(res.total, LIMIT, offset, load));
        // Row click → detail modal
        container.querySelectorAll("tr.clickable").forEach(row => {
            row.addEventListener("click", () => openEventDetail(row.dataset.id));
        });
        // Filter controls
        document.getElementById("btn-apply").addEventListener("click", () => {
            filter = {
                ...filter,
                source: document.getElementById("f-source").value || undefined,
                status: document.getElementById("f-status").value || undefined,
                event_type: document.getElementById("f-event-type").value.trim() || undefined,
                external_event_id: document.getElementById("f-ext-id").value.trim() || undefined,
                from: toIso(document.getElementById("f-from")),
                to: toIso(document.getElementById("f-to")),
                offset: 0,
            };
            load(0);
        });
        document.getElementById("btn-clear").addEventListener("click", () => {
            filter = { limit: LIMIT, offset: 0 };
            load(0);
        });
    }
    await load(0);
}
async function openEventDetail(id) {
    const event = await getEventById(id);
    const html = `
    <div class="detail-section">
      <h4>Event metadata</h4>
      <div class="kv-grid">
        <span class="key">ID</span>           <span>${esc(event.id)}</span>
        <span class="key">Source</span>       <span><code>${esc(event.webhook_source)}</code></span>
        <span class="key">Event type</span>   <span><code>${esc(event.event_type)}</code></span>
        <span class="key">Status</span>       <span>${statusBadge(event.status)}</span>
        <span class="key">External ID</span>  <span><code>${esc(event.external_event_id)}</code></span>
        <span class="key">Idempotency key</span><span><code>${esc(event.idempotency_key)}</code></span>
        <span class="key">Created</span>      <span>${fmtDate(event.created_at)}</span>
        <span class="key">Processed</span>    <span>${fmtDate(event.processed_at)}</span>
      </div>
    </div>

    ${event.error_message ? `
      <div class="detail-section">
        <h4>Error message</h4>
        <p class="text-danger" style="font-size:13px">${esc(event.error_message)}</p>
      </div>
    ` : ""}

    <div class="detail-section">
      <h4>Raw payload</h4>
      <pre class="payload-pre">${esc(prettyJson(event.payload))}</pre>
    </div>
  `;
    openModal(`Event — ${event.event_type}`, html);
}
function toIso(input) {
    if (!input.value)
        return undefined;
    return new Date(input.value).toISOString();
}
