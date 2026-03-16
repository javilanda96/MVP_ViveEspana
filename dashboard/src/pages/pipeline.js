import { getPipeline } from "../api.js";
import { fmtDate, esc, buildPagination } from "../utils.js";
const LIMIT = 50;
export async function renderPipeline(container) {
    let filter = { limit: LIMIT, offset: 0 };
    async function load(offset) {
        filter = { ...filter, offset };
        const res = await getPipeline(filter);
        const fmtMoney = (v, currency) => v !== null
            ? `${new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2 }).format(v)} ${esc(currency)}`
            : "—";
        container.innerHTML = `
      <section class="page">
        <h2>Pipeline</h2>

        <div class="filters">
          <label>Status
            <select id="f-status">
              <option value="">All</option>
              <option value="open"      ${filter.status === "open" ? "selected" : ""}>open</option>
              <option value="won"       ${filter.status === "won" ? "selected" : ""}>won</option>
              <option value="lost"      ${filter.status === "lost" ? "selected" : ""}>lost</option>
              <option value="abandoned" ${filter.status === "abandoned" ? "selected" : ""}>abandoned</option>
            </select>
          </label>
          <label>Pipeline
            <input type="text" id="f-pipeline" placeholder="pipeline name" value="${esc(filter.pipeline_name ?? "")}" />
          </label>
          <button id="btn-apply">Apply</button>
          <button id="btn-clear" class="btn-clear">Clear</button>
        </div>

        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Opportunity</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Pipeline</th>
                <th>Stage</th>
                <th>Status</th>
                <th>Value</th>
                <th>Payments</th>
                <th>Collected</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              ${res.data.length === 0
            ? `<tr><td colspan="10" class="muted" style="text-align:center;padding:2rem">No opportunities found</td></tr>`
            : res.data.map(row => `
                  <tr>
                    <td>${esc(row.opportunity_name)}</td>
                    <td>${esc(row.contact_full_name)}</td>
                    <td>${esc(row.contact_email)}</td>
                    <td>${esc(row.pipeline_name)}</td>
                    <td>${esc(row.stage_name)}</td>
                    <td><span class="badge ${statusClass(row.status)}">${esc(row.status)}</span></td>
                    <td>${fmtMoney(row.monetary_value, row.currency)}</td>
                    <td style="text-align:center">${row.payments_count}</td>
                    <td>${fmtMoney(row.total_payments_amount, row.currency)}</td>
                    <td>${fmtDate(row.created_at)}</td>
                  </tr>
                `).join("")}
            </tbody>
          </table>
        </div>

        <div id="pagination"></div>

        <p class="note">
          Data sourced from the <code>opportunity_overview</code> view.
          Collected payments reflect all succeeded payments linked to the same contact,
          not exclusively to this opportunity.
        </p>
      </section>
    `;
        container.querySelector("#pagination").replaceWith(buildPagination(res.total, LIMIT, offset, load));
        document.getElementById("btn-apply").addEventListener("click", () => {
            filter = {
                ...filter,
                status: document.getElementById("f-status").value || undefined,
                pipeline_name: document.getElementById("f-pipeline").value.trim() || undefined,
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
function statusClass(status) {
    return status === "won" ? "badge-processed" :
        status === "lost" ? "badge-failed" :
            "badge-received";
}
