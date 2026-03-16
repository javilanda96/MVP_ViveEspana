import { getIntegrations } from "../api.js";
import { fmtDate, esc } from "../utils.js";

export async function renderIntegrations(container: HTMLElement): Promise<void> {
  const integrations = await getIntegrations();

  const cards = integrations.map(i => `
    <div class="integration-card">
      <h3>${esc(i.name)}</h3>
      <div class="kv-grid">
        <span class="key">Endpoint</span>
        <span><code>${esc(i.endpoint)}</code></span>

        <span class="key">Auth type</span>
        <span>${esc(i.authType)}</span>

        <span class="key">Secret</span>
        <span>${i.secretPresent
          ? `<span class="ok">✓ Present</span>`
          : `<span class="warn">✗ Not set (permissive dev mode)</span>`
        }</span>

        <span class="key">Last seen</span>
        <span>${fmtDate(i.lastSeen)}</span>

        <span class="key">Events (24 h)</span>
        <span>${i.total24h}</span>

        <span class="key">Failed (24 h)</span>
        <span class="${i.failed24h > 0 ? "text-danger" : ""}">${i.failed24h}</span>
      </div>
    </div>
  `).join("");

  container.innerHTML = `
    <section class="page">
      <h2>Integrations</h2>

      <p class="muted" style="margin-bottom:1rem;font-size:13px">
        Read-only registry of the three hardcoded webhook integrations.
        Activity is inferred from <code>events_log</code> — not from live provider health probes.
      </p>

      <div class="integration-grid">
        ${cards}
      </div>

      <p class="note">
        ⚠ <strong>Visibility limits:</strong>
        "Last seen" reflects the most recent event that was persisted in <code>events_log</code>.
        A long gap may indicate provider inactivity, a workflow misconfiguration on the GHL side,
        or delivery failures that were rejected before reaching the service layer (which are never logged).
        There are no end-to-end health probes — this panel cannot confirm that external providers
        are currently operational.
      </p>
    </section>
  `;
}
