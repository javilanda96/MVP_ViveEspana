import { getErrors, getEventById, type ErrorsFilter } from "../api.js";
import { fmtDate, esc, buildPagination, prettyJson, statusBadge } from "../utils.js";
import { openModal } from "../modal.js";

const LIMIT = 50;

export async function renderErrors(container: HTMLElement): Promise<void> {
  let filter: ErrorsFilter = { limit: LIMIT, offset: 0 };

  async function load(offset: number): Promise<void> {
    filter = { ...filter, offset };
    const res = await getErrors(filter);

    // Agrupación por tipo de evento en la página actual
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
        <h2>Errores</h2>
        <p class="page-desc">
          Eventos que han producido algún error durante el procesamiento. Usa esta sección
          para detectar incidencias en las integraciones y revisar el payload original que
          causó el fallo. Haz clic en cualquier fila para ver el detalle completo.
        </p>

        <p class="note" style="margin-bottom:1.5rem">
          ⚠ <strong>Límite de visibilidad importante:</strong>
          Esta página muestra únicamente los eventos que <em>alcanzaron la capa de servicio</em>
          y fueron persistidos con <code>estado = fallido</code>.
          Las solicitudes rechazadas antes de ser persistidas — errores de autenticación (401),
          fallos de validación de esquema (400) y excepciones genéricas de Fastify — <strong>no
          aparecen aquí</strong>. Si esperas errores que no están en este listado, revisa
          directamente los logs del servidor.
        </p>

        ${res.total === 0 ? "" : `
          <h3>Fallos en esta página por tipo de evento</h3>
          <div class="table-wrap" style="max-width:420px;margin-bottom:1.75rem">
            <table class="data-table">
              <thead><tr><th>Tipo de evento</th><th>Cantidad (esta página)</th></tr></thead>
              <tbody>${summaryRows}</tbody>
            </table>
          </div>
        `}

        <h3>Eventos fallidos</h3>

        <div class="filters" id="err-filters">
          <label>Tipo de evento
            <input type="text" id="f-event-type" placeholder="p. ej. opportunity.updated" value="${esc(filter.event_type ?? "")}" />
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
                <th>Fecha y hora</th>
                <th>Origen</th>
                <th>Tipo de evento</th>
                <th>ID externo</th>
                <th>Mensaje de error</th>
              </tr>
            </thead>
            <tbody>
              ${res.data.length === 0
                ? `<tr><td colspan="5" class="muted" style="text-align:center;padding:2.5rem">No se encontraron eventos fallidos</td></tr>`
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

    // Paginación
    container.querySelector("#pagination")!.replaceWith(
      buildPagination(res.total, LIMIT, offset, load)
    );

    // Clic en fila → modal de detalle completo
    container.querySelectorAll<HTMLTableRowElement>("tr.clickable").forEach(row => {
      row.addEventListener("click", () => openErrorDetail(row.dataset.id!));
    });

    // Controles de filtro
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
      <h4>Metadatos del evento</h4>
      <div class="kv-grid">
        <span class="key">ID interno</span>          <span>${esc(event.id)}</span>
        <span class="key">Origen</span>               <span><code>${esc(event.webhook_source)}</code></span>
        <span class="key">Tipo de evento</span>       <span><code>${esc(event.event_type)}</code></span>
        <span class="key">Estado</span>               <span>${statusBadge(event.status)}</span>
        <span class="key">ID externo</span>           <span><code>${esc(event.external_event_id)}</code></span>
        <span class="key">Clave de idempotencia</span><span><code>${esc(event.idempotency_key)}</code></span>
        <span class="key">Recibido</span>             <span>${fmtDate(event.created_at)}</span>
        <span class="key">Procesado</span>            <span>${fmtDate(event.processed_at)}</span>
      </div>
    </div>

    <div class="detail-section">
      <h4>Mensaje de error</h4>
      <p class="text-danger" style="font-size:13px;line-height:1.6">
        ${esc(event.error_message ?? "Sin mensaje de error almacenado")}
      </p>
    </div>

    <div class="detail-section">
      <h4>Payload recibido</h4>
      <pre class="payload-pre">${esc(prettyJson(event.payload))}</pre>
    </div>
  `;

  openModal(`Evento fallido — ${event.event_type}`, html);
}

function toIso(input: HTMLInputElement): string | undefined {
  if (!input.value) return undefined;
  return new Date(input.value).toISOString();
}
