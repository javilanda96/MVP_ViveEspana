import { getEvents, getEventById, type EventsFilter } from "../api.js";
import { fmtDate, esc, statusBadge, buildPagination, prettyJson } from "../utils.js";
import { openModal } from "../modal.js";

const LIMIT = 50;

export async function renderLogs(container: HTMLElement): Promise<void> {
  let filter: EventsFilter = { limit: LIMIT, offset: 0 };

  async function load(offset: number): Promise<void> {
    filter = { ...filter, offset };
    const res = await getEvents(filter);

    container.innerHTML = `
      <section class="page">
        <h2>Registro de eventos</h2>
        <p class="page-desc">
          Listado completo de los eventos recibidos y procesados por el sistema. Utiliza los
          filtros para localizar un evento concreto por origen, estado, tipo o identificador
          externo. Haz clic en cualquier fila para ver el detalle completo y el payload original.
        </p>

        <div class="filters" id="log-filters">
          <label>Origen
            <select id="f-source">
              <option value="">Todos</option>
              <option value="ghl"    ${filter.source === "ghl"    ? "selected" : ""}>GHL</option>
              <option value="stripe" ${filter.source === "stripe" ? "selected" : ""}>Stripe</option>
            </select>
          </label>
          <label>Estado
            <select id="f-status">
              <option value="">Todos</option>
              <option value="processed" ${filter.status === "processed" ? "selected" : ""}>Procesado</option>
              <option value="failed"    ${filter.status === "failed"    ? "selected" : ""}>Fallido</option>
              <option value="received"  ${filter.status === "received"  ? "selected" : ""}>Recibido</option>
            </select>
          </label>
          <label>Tipo de evento
            <input type="text" id="f-event-type" placeholder="p. ej. payment.created" value="${esc(filter.event_type ?? "")}" />
          </label>
          <label>ID externo del evento
            <input type="text" id="f-ext-id" placeholder="coincidencia exacta" value="${esc(filter.external_event_id ?? "")}" />
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
                <th>Estado</th>
                <th>ID externo</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              ${res.data.length === 0
                ? `<tr><td colspan="6" class="muted" style="text-align:center;padding:2.5rem">No se encontraron eventos con los filtros aplicados</td></tr>`
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
                `).join("")
              }
            </tbody>
          </table>
        </div>

        <div id="pagination"></div>

        <p class="note">
          ⚠ Este registro muestra únicamente los eventos que alcanzaron la capa de servicio
          y fueron persistidos. Las solicitudes rechazadas por autenticación (401) o por
          fallos de validación de esquema (400) no aparecen aquí.
        </p>
      </section>
    `;

    // Paginación
    container.querySelector("#pagination")!.replaceWith(
      buildPagination(res.total, LIMIT, offset, load)
    );

    // Clic en fila → modal de detalle
    container.querySelectorAll<HTMLTableRowElement>("tr.clickable").forEach(row => {
      row.addEventListener("click", () => openEventDetail(row.dataset.id!));
    });

    // Controles de filtro
    document.getElementById("btn-apply")!.addEventListener("click", () => {
      filter = {
        ...filter,
        source:            (document.getElementById("f-source") as HTMLSelectElement).value || undefined,
        status:            (document.getElementById("f-status") as HTMLSelectElement).value || undefined,
        event_type:        (document.getElementById("f-event-type") as HTMLInputElement).value.trim() || undefined,
        external_event_id: (document.getElementById("f-ext-id") as HTMLInputElement).value.trim() || undefined,
        from:              toIso(document.getElementById("f-from") as HTMLInputElement),
        to:                toIso(document.getElementById("f-to")   as HTMLInputElement),
        offset:            0,
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

async function openEventDetail(id: string): Promise<void> {
  const event = await getEventById(id);

  const html = `
    <div class="detail-section">
      <h4>Metadatos del evento</h4>
      <div class="kv-grid">
        <span class="key">ID interno</span>         <span>${esc(event.id)}</span>
        <span class="key">Origen</span>              <span><code>${esc(event.webhook_source)}</code></span>
        <span class="key">Tipo de evento</span>      <span><code>${esc(event.event_type)}</code></span>
        <span class="key">Estado</span>              <span>${statusBadge(event.status)}</span>
        <span class="key">ID externo</span>          <span><code>${esc(event.external_event_id)}</code></span>
        <span class="key">Clave de idempotencia</span><span><code>${esc(event.idempotency_key)}</code></span>
        <span class="key">Recibido</span>            <span>${fmtDate(event.created_at)}</span>
        <span class="key">Procesado</span>           <span>${fmtDate(event.processed_at)}</span>
      </div>
    </div>

    ${event.error_message ? `
      <div class="detail-section">
        <h4>Mensaje de error</h4>
        <p class="text-danger" style="font-size:13px;line-height:1.6">${esc(event.error_message)}</p>
      </div>
    ` : ""}

    <div class="detail-section">
      <h4>Payload recibido</h4>
      <pre class="payload-pre">${esc(prettyJson(event.payload))}</pre>
    </div>
  `;

  openModal(`Evento — ${event.event_type}`, html);
}

function toIso(input: HTMLInputElement): string | undefined {
  if (!input.value) return undefined;
  return new Date(input.value).toISOString();
}
