import { getErrors, getEventById, type ErrorsFilter } from "../api.js";
import { fmtDate, esc, buildPagination, prettyJson, statusBadge } from "../utils.js";
import { openModal } from "../modal.js";

const LIMIT = 50;

export async function renderErrors(container: HTMLElement): Promise<void> {
  let filter: ErrorsFilter = { limit: LIMIT, offset: 0 };

  async function load(offset: number): Promise<void> {
    filter = { ...filter, offset };
    const res = await getErrors(filter);

    // Build a simple count-by-event_type summary from current page
    const counts: Record<string, number> = {};
    for (const row of res.data) {
      counts[row.event_type] = (counts[row.event_type] ?? 0) + 1;
    }
    const summaryRows = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([type, n]) => `<tr><td><code>${esc(type)}</code></td><td>${n}</td></tr>`)
      .join("");

    container.innerHTML = `
      <section class="page">
        <h2>Errors</h2>

        <p class="note" style="margin-bottom:1.25rem">
          ⚠ <strong>Important visibility limit:</strong>
          This page shows only events that <em>reached the service layer</em> and were persisted
          with <code>status = failed</code>.
          Requests rejected before persistence — auth failures (401), schema validation errors (400),
          and generic Fastify runtime exceptions — are <strong>not shown here</strong>.
          If you expect errors that are missing from this list, check server logs directly.
        </p>

        ${res.total === 0 ? "" : `
          <h3>Failures on this page by event type</h3>
          <table class="data-table" style="max-width:400px;margin-bottom:1.5rem">
            <thead><tr><th>Event type</th><th>Count (this page)</th></tr></thead>
            <tbody>${summaryRows}</tbody>
          </table>
        `}

        <h3>Failed events</h3>

        <div class="filters" id="err-filters">
          <label>Event type
            <input type="text" id="f-event-type" placeholder="e.g. opportunity.updated" value="${esc(filter.event_type ?? "")}" />
          </label>
          <label>From
            <input type="datetime-local" id="f-from" value="${filter.from ?? ""}" />
          </label>
          <label>To
            <input type="datetime-local" id="f-to"   value="${filter.to   ?? ""}" />
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
                <th>External event ID</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              ${res.data.length === 0
                ? `<tr><td colspan="5" class="muted" style="text-align:center;padding:2rem">No failed events found</td></tr>`
                : res.data.map(row => `
                  <tr class="clickable" data-id="${esc(row.id)}">
                    <td>${fmtDate(row.created_at)}</td>
                    <td><code>${esc(row.webhook_source)}</code></td>
                    <td><code>${esc(row.event_type)}</code></td>
                    <td class="wrap"><code>${esc(row.external_event_id)}</code></td>
                    <td class="wrap text-danger">
                      ${esc((row.error_message ?? "").slice(0, 140))}${(row.error_message?.length ?? 0) > 140 ? "…" : ""}
                    </td>
                  </tr>
                `).join("")
              }
            </tbody>
          </table>
        </div>

        <div id="pagination"></div>
      </section>
    `;

    // Pagination
    container.querySelector("#pagination")!.replaceWith(
      buildPagination(res.total, LIMIT, offset, load)
    );

    // Row click → full event detail
    container.querySelectorAll<HTMLTableRowElement>("tr.clickable").forEach(row => {
      row.addEventListener("click", () => openErrorDetail(row.dataset.id!));
    });

    // Filter controls
    document.getElementById("btn-apply")!.addEventListener("click", () => {
      filter = {
        ...filter,
        event_type: (document.getElementById("f-event-type") as HTMLInputElement).value.trim() || undefined,
        from:       toIso(document.getElementById("f-from") as HTMLInputElement),
        to:         toIso(document.getElementById("f-to")   as HTMLInputElement),
        offset:     0,
      };
      load(0);
    });

    document.getElementById("btn-clear")!.addEventListener("click", () => {
      filter = { limit: LIMIT, offset: 0 };
      load(0);
    });
  }

  await load(0);
}

async function openErrorDetail(id: string): Promise<void> {
  const event = await getEventById(id);

  const html = `
    <div class="detail-section">
      <h4>Event metadata</h4>
      <div class="kv-grid">
        <span class="key">ID</span>            <span>${esc(event.id)}</span>
        <span class="key">Source</span>        <span><code>${esc(event.webhook_source)}</code></span>
        <span class="key">Event type</span>    <span><code>${esc(event.event_type)}</code></span>
        <span class="key">Status</span>        <span>${statusBadge(event.status)}</span>
        <span class="key">External ID</span>   <span><code>${esc(event.external_event_id)}</code></span>
        <span class="key">Idempotency key</span><span><code>${esc(event.idempotency_key)}</code></span>
        <span class="key">Created</span>       <span>${fmtDate(event.created_at)}</span>
        <span class="key">Processed</span>     <span>${fmtDate(event.processed_at)}</span>
      </div>
    </div>

    <div class="detail-section">
      <h4>Error message</h4>
      <p class="text-danger" style="font-size:13px;line-height:1.6">
        ${esc(event.error_message ?? "No error message stored")}
      </p>
    </div>

    <div class="detail-section">
      <h4>Raw payload (as received)</h4>
      <pre class="payload-pre">${esc(prettyJson(event.payload))}</pre>
    </div>
  `;

  openModal(`Failed event — ${event.event_type}`, html);
}

function toIso(input: HTMLInputElement): string | undefined {
  if (!input.value) return undefined;
  return new Date(input.value).toISOString();
}
