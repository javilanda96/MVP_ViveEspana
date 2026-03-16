import { getPipeline, type PipelineFilter } from "../api.js";
import { fmtDate, esc, buildPagination } from "../utils.js";

const LIMIT = 50;

const STATUS_ES: Record<string, string> = {
  open:      "Abierta",
  won:       "Ganada",
  lost:      "Perdida",
  abandoned: "Abandonada",
};

export async function renderPipeline(container: HTMLElement): Promise<void> {
  let filter: PipelineFilter = { limit: LIMIT, offset: 0 };

  async function load(offset: number): Promise<void> {
    filter = { ...filter, offset };
    const res = await getPipeline(filter);

    const fmtMoney = (v: number | null, currency: string) =>
      v !== null
        ? `${new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2 }).format(v)} ${esc(currency)}`
        : "—";

    container.innerHTML = `
      <section class="page">
        <h2>Pipeline de oportunidades</h2>
        <p class="page-desc">
          Vista del pipeline de oportunidades sincronizado desde el CRM. Permite consultar
          el estado actual de cada oportunidad, la fase en la que se encuentra, su valor
          económico y los pagos completados asociados al contacto. Usa los filtros para
          acotar por estado o nombre de pipeline.
        </p>

        <div class="filters">
          <label>Estado
            <select id="f-status">
              <option value="">Todos</option>
              <option value="open"      ${filter.status === "open"      ? "selected" : ""}>Abierta</option>
              <option value="won"       ${filter.status === "won"       ? "selected" : ""}>Ganada</option>
              <option value="lost"      ${filter.status === "lost"      ? "selected" : ""}>Perdida</option>
              <option value="abandoned" ${filter.status === "abandoned" ? "selected" : ""}>Abandonada</option>
            </select>
          </label>
          <label>Pipeline
            <input type="text" id="f-pipeline" placeholder="nombre del pipeline" value="${esc(filter.pipeline_name ?? "")}" />
          </label>
          <button id="btn-apply">Aplicar</button>
          <button id="btn-clear" class="btn-clear">Limpiar</button>
        </div>

        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Oportunidad</th>
                <th>Contacto</th>
                <th>Email</th>
                <th>Pipeline</th>
                <th>Fase</th>
                <th>Estado</th>
                <th>Valor</th>
                <th>Pagos</th>
                <th>Total cobrado</th>
                <th>Fecha alta</th>
              </tr>
            </thead>
            <tbody>
              ${res.data.length === 0
                ? `<tr><td colspan="10" class="muted" style="text-align:center;padding:2.5rem">No se encontraron oportunidades con los filtros aplicados</td></tr>`
                : res.data.map(row => `
                  <tr>
                    <td>${esc(row.opportunity_name)}</td>
                    <td>${esc(row.contact_full_name)}</td>
                    <td>${esc(row.contact_email)}</td>
                    <td>${esc(row.pipeline_name)}</td>
                    <td>${esc(row.stage_name)}</td>
                    <td><span class="badge ${statusClass(row.status)}">${esc(STATUS_ES[row.status] ?? row.status)}</span></td>
                    <td>${fmtMoney(row.monetary_value, row.currency)}</td>
                    <td style="text-align:center">${row.payments_count}</td>
                    <td>${fmtMoney(row.total_payments_amount, row.currency)}</td>
                    <td>${fmtDate(row.created_at)}</td>
                  </tr>
                `).join("")
              }
            </tbody>
          </table>
        </div>

        <div id="pagination"></div>

        <p class="note">
          Los datos provienen de la vista <code>opportunity_overview</code>.
          El importe total cobrado refleja todos los pagos completados vinculados al
          mismo contacto, no exclusivamente a esta oportunidad.
        </p>
      </section>
    `;

    container.querySelector("#pagination")!.replaceWith(
      buildPagination(res.total, LIMIT, offset, load)
    );

    document.getElementById("btn-apply")!.addEventListener("click", () => {
      filter = {
        ...filter,
        status:        (document.getElementById("f-status")   as HTMLSelectElement).value || undefined,
        pipeline_name: (document.getElementById("f-pipeline") as HTMLInputElement).value.trim() || undefined,
        offset:        0,
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

function statusClass(status: string): string {
  return status === "won"  ? "badge-processed" :
         status === "lost" ? "badge-failed"    :
                             "badge-received";
}
