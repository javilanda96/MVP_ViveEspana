import { getStats, getIntegrations } from "../api.js";
import { fmtDate, esc } from "../utils.js";

export async function renderOverview(container: HTMLElement): Promise<void> {
  const [stats, integrations] = await Promise.all([getStats(), getIntegrations()]);

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  container.innerHTML = `
    <section class="page">
      <h2>Resumen</h2>
      <p class="page-desc">
        Visión general de la actividad reciente del sistema de integración: volumen de eventos,
        errores detectados, estado del pipeline de oportunidades e importes cobrados.
        Los datos se actualizan en cada visita a esta pantalla.
      </p>

      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-value">${stats.total24h}</div>
          <div class="kpi-label">Eventos procesados<br>(últimas 24 h)</div>
        </div>
        <div class="kpi-card${stats.failed24h > 0 ? " alert" : ""}">
          <div class="kpi-value">${stats.failed24h}</div>
          <div class="kpi-label">Eventos fallidos<br>(últimas 24 h)</div>
        </div>
        <div class="kpi-card${Number(stats.failureRate24h) > 10 ? " alert" : ""}">
          <div class="kpi-value">${stats.failureRate24h}%</div>
          <div class="kpi-label">Tasa de error<br>(últimas 24 h)</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value">${stats.openOpportunities}</div>
          <div class="kpi-label">Oportunidades<br>abiertas</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value">€${fmtMoney(stats.totalPaymentsAmount)}</div>
          <div class="kpi-label">Pagos cobrados<br>(completados)</div>
        </div>
      </div>

      <h3>Actividad de integraciones</h3>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Integración</th>
              <th>Endpoint</th>
              <th>Autenticación</th>
              <th>Secreto</th>
              <th>Última actividad</th>
              <th>Eventos (24 h)</th>
              <th>Fallos (24 h)</th>
            </tr>
          </thead>
          <tbody>
            ${integrations.map(i => `
              <tr>
                <td>${esc(i.name)}</td>
                <td><code>${esc(i.endpoint)}</code></td>
                <td>${esc(i.authType)}</td>
                <td>${i.secretPresent
                  ? `<span class="ok">✓ Configurado</span>`
                  : `<span class="warn">✗ No configurado</span>`
                }</td>
                <td>${fmtDate(i.lastSeen)}</td>
                <td>${i.total24h}</td>
                <td class="${i.failed24h > 0 ? "text-danger" : ""}">${i.failed24h}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <p class="note">
        ⚠ <strong>Límite de visibilidad:</strong>
        La actividad mostrada se deduce exclusivamente de los registros almacenados en
        <code>events_log</code>. Las solicitudes rechazadas antes de llegar a la capa de servicio
        (errores de autenticación, validación de esquema) <strong>no se contabilizan aquí</strong>
        y no son visibles en este panel. Las métricas de infraestructura, el estado de los
        proveedores externos y los logs de Pino en tiempo de ejecución también quedan fuera
        del alcance de este panel.
      </p>
    </section>
  `;
}
