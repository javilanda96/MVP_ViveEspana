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

        <span class="key">Tipo de autenticación</span>
        <span>${esc(i.authType)}</span>

        <span class="key">Secreto</span>
        <span>${i.secretPresent
          ? `<span class="ok">✓ Configurado</span>`
          : `<span class="warn">✗ Sin configurar (modo permisivo)</span>`
        }</span>

        <span class="key">Última actividad</span>
        <span>${fmtDate(i.lastSeen)}</span>

        <span class="key">Eventos (24 h)</span>
        <span>${i.total24h}</span>

        <span class="key">Fallos (24 h)</span>
        <span class="${i.failed24h > 0 ? "text-danger" : ""}">${i.failed24h}</span>
      </div>
    </div>
  `).join("");

  container.innerHTML = `
    <section class="page">
      <h2>Integraciones</h2>
      <p class="page-desc">
        Registro de las integraciones activas del sistema y su actividad reciente.
        Cada tarjeta muestra el endpoint configurado, el tipo de autenticación, si el
        secreto de verificación está presente y el volumen de eventos recibidos en las
        últimas 24 horas. La actividad se infiere de los registros almacenados, no de
        sondeos en tiempo real a los proveedores externos.
      </p>

      <div class="integration-grid">
        ${cards}
      </div>

      <p class="note">
        ⚠ <strong>Límite de visibilidad:</strong>
        «Última actividad» refleja el evento más reciente persistido en <code>events_log</code>.
        Una brecha prolongada puede indicar inactividad del proveedor, una configuración
        incorrecta del workflow en GHL, o fallos de entrega rechazados antes de llegar
        a la capa de servicio (que nunca se registran). Este panel no realiza sondeos
        de salud extremo a extremo: no puede confirmar que los proveedores externos
        estén operativos en este momento.
      </p>
    </section>
  `;
}
