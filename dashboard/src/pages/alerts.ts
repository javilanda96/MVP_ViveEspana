import { getAlerts, type AlertsFilter, type AlertRow } from "../api.js";
import { fmtDate, esc, buildPagination, prettyJson } from "../utils.js";
import { openModal } from "../modal.js";

const LIMIT = 50;

// ─── Severity badge ───────────────────────────────────────────────────────────

function severityBadge(severity: string): string {
  if (severity === "critical") {
    return `<span class="badge badge-failed">crítica</span>`;
  }
  return `<span class="badge badge-received">aviso</span>`;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function alertStatusBadge(status: string): string {
  if (status === "open") {
    return `<span class="badge badge-failed">abierta</span>`;
  }
  if (status === "resolved") {
    return `<span class="badge badge-processed">resuelta</span>`;
  }
  return `<span class="badge badge-received">${esc(status)}</span>`;
}

// ─── Renderer ─────────────────────────────────────────────────────────────────

export async function renderAlerts(container: HTMLElement): Promise<void> {
  let filter: AlertsFilter = { status: "open", limit: LIMIT, offset: 0 };

  async function load(offset: number): Promise<void> {
    filter = { ...filter, offset };
    const res = await getAlerts(filter);

    container.innerHTML = `
      <section class="page">
        <h2>Alertas operativas</h2>
        <p class="page-desc">
          Alertas generadas automáticamente por el motor de detección de anomalías en cobros.
          Cada alerta indica un pago que cumplió al menos una regla de riesgo configurada.
          Las alertas abiertas requieren revisión manual. Haz clic en una fila para ver
          el contexto completo de la alerta.
        </p>

        <div class="filters" id="alert-filters">
          <label>Estado
            <select id="f-status">
              <option value=""       ${!filter.status              ? "selected" : ""}>Todos</option>
              <option value="open"   ${filter.status === "open"    ? "selected" : ""}>Abierta</option>
              <option value="resolved"  ${filter.status === "resolved"   ? "selected" : ""}>Resuelta</option>
              <option value="dismissed" ${filter.status === "dismissed"  ? "selected" : ""}>Descartada</option>
            </select>
          </label>
          <label>Severidad
            <select id="f-severity">
              <option value=""         ${!filter.severity              ? "selected" : ""}>Todas</option>
              <option value="critical" ${filter.severity === "critical" ? "selected" : ""}>Crítica</option>
              <option value="warning"  ${filter.severity === "warning"  ? "selected" : ""}>Aviso</option>
            </select>
          </label>
          <label>Desde
            <input type="datetime-local" id="f-from" value="${filter.from ?? ""}" />
          </label>
          <label>Hasta
            <input type="datetime-local" id="f-to"   value="${filter.to   ?? ""}" />
          </label>
          <button id="btn-apply">Aplicar</button>
          <button id="btn-clear" class="btn-clear">Limpiar</button>
        </div>

        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Detectada</th>
                <th>Severidad</th>
                <th>Estado</th>
                <th>Regla</th>
                <th>Mensaje</th>
              </tr>
            </thead>
            <tbody>
              ${res.data.length === 0
                ? `<tr><td colspan="5" class="muted" style="text-align:center;padding:2.5rem">No se encontraron alertas con los filtros actuales</td></tr>`
                : res.data.map(row => `
                  <tr class="clickable" data-id="${esc(row.id)}">
                    <td>${fmtDate(row.detected_at)}</td>
                    <td>${severityBadge(row.severity)}</td>
                    <td>${alertStatusBadge(row.status)}</td>
                    <td><code>${esc(row.rule_code)}</code></td>
                    <td class="wrap">
                      ${esc(row.message.slice(0, 120))}${row.message.length > 120 ? "…" : ""}
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

    // Paginación
    container.querySelector("#pagination")!.replaceWith(
      buildPagination(res.total, LIMIT, offset, load)
    );

    // Clic en fila → modal de detalle
    container.querySelectorAll<HTMLTableRowElement>("tr.clickable").forEach(row => {
      const alert = res.data.find(a => a.id === row.dataset.id);
      if (alert) row.addEventListener("click", () => openAlertDetail(alert));
    });

    // Controles de filtro
    document.getElementById("btn-apply")!.addEventListener("click", () => {
      filter = {
        ...filter,
        status:   (document.getElementById("f-status")   as HTMLSelectElement).value || undefined,
        severity: (document.getElementById("f-severity") as HTMLSelectElement).value || undefined,
        from:     toIso(document.getElementById("f-from") as HTMLInputElement),
        to:       toIso(document.getElementById("f-to")   as HTMLInputElement),
        offset:   0,
      };
      load(0);
    });

    document.getElementById("btn-clear")!.addEventListener("click", () => {
      filter = { status: "open", limit: LIMIT, offset: 0 };
      load(0);
    });
  }

  await load(0);
}

// ─── Alert detail modal ───────────────────────────────────────────────────────

function openAlertDetail(alert: AlertRow): void {
  const html = `
    <div class="detail-section">
      <h4>Identificación</h4>
      <div class="kv-grid">
        <span class="key">ID alerta</span>    <span>${esc(alert.id)}</span>
        <span class="key">ID pago</span>      <span><code>${esc(alert.payment_id)}</code></span>
        <span class="key">Regla</span>        <span><code>${esc(alert.rule_code)}</code></span>
        <span class="key">Severidad</span>    <span>${severityBadge(alert.severity)}</span>
        <span class="key">Estado</span>       <span>${alertStatusBadge(alert.status)}</span>
        <span class="key">Detectada</span>    <span>${fmtDate(alert.detected_at)}</span>
        <span class="key">Cerrada</span>      <span>${fmtDate(alert.closed_at)}</span>
      </div>
    </div>

    <div class="detail-section">
      <h4>Mensaje</h4>
      <p style="font-size:13px;line-height:1.6">${esc(alert.message)}</p>
    </div>

    ${alert.resolution_notes ? `
      <div class="detail-section">
        <h4>Notas de resolución</h4>
        <p style="font-size:13px;line-height:1.6">${esc(alert.resolution_notes)}</p>
      </div>
    ` : ""}

    <div class="detail-section">
      <h4>Contexto</h4>
      <pre class="payload-pre">${esc(prettyJson(alert.context))}</pre>
    </div>
  `;

  openModal(`Alerta — ${alert.rule_code}`, html);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toIso(input: HTMLInputElement): string | undefined {
  if (!input.value) return undefined;
  return new Date(input.value).toISOString();
}
