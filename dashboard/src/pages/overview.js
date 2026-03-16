import { getStats, getIntegrations } from "../api.js";
import { fmtDate, esc } from "../utils.js";
export async function renderOverview(container) {
    const [stats, integrations] = await Promise.all([getStats(), getIntegrations()]);
    const fmtMoney = (n) => new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
    container.innerHTML = `
    <section class="page">
      <h2>Overview</h2>

      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-value">${stats.total24h}</div>
          <div class="kpi-label">Events (last 24 h)</div>
        </div>
        <div class="kpi-card${stats.failed24h > 0 ? " alert" : ""}">
          <div class="kpi-value">${stats.failed24h}</div>
          <div class="kpi-label">Failed (last 24 h)</div>
        </div>
        <div class="kpi-card${Number(stats.failureRate24h) > 10 ? " alert" : ""}">
          <div class="kpi-value">${stats.failureRate24h}%</div>
          <div class="kpi-label">Failure rate (24 h)</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value">${stats.openOpportunities}</div>
          <div class="kpi-label">Open opportunities</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value">€${fmtMoney(stats.totalPaymentsAmount)}</div>
          <div class="kpi-label">Payments collected (succeeded)</div>
        </div>
      </div>

      <h3>Integration Activity</h3>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Integration</th>
              <th>Endpoint</th>
              <th>Auth</th>
              <th>Secret</th>
              <th>Last seen</th>
              <th>Events (24 h)</th>
              <th>Failed (24 h)</th>
            </tr>
          </thead>
          <tbody>
            ${integrations.map(i => `
              <tr>
                <td>${esc(i.name)}</td>
                <td><code>${esc(i.endpoint)}</code></td>
                <td>${esc(i.authType)}</td>
                <td>${i.secretPresent
        ? `<span class="ok">✓ Present</span>`
        : `<span class="warn">✗ Missing</span>`}</td>
                <td>${fmtDate(i.lastSeen)}</td>
                <td>${i.total24h}</td>
                <td class="${i.failed24h > 0 ? "text-danger" : ""}">${i.failed24h}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <p class="note">
        ⚠ Integration activity is inferred from <strong>events_log</strong> records only.
        Events rejected before reaching the service layer (auth failures, schema validation errors)
        are <strong>not counted here</strong> and are not visible in this dashboard.
        Infrastructure metrics, external provider status, and Pino runtime logs
        are also outside the visibility of this panel.
      </p>
    </section>
  `;
}
