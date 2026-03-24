import { getSalesFunnel, getSalesDeals, type SalesDealsFilter } from "../api.js";
import { fmtDate, esc, buildPagination } from "../utils.js";

const LIMIT = 50;

const STATUS_ES: Record<string, string> = {
  open:      "Abierta",
  won:       "Ganada",
  lost:      "Perdida",
  abandoned: "Abandonada",
};

const CLASSIFICATION_ES: Record<string, string> = {
  nueva_venta: "Nueva venta",
  cross_sell:  "Cross-sell",
};

function fmtMoney(v: number | null, currency = "EUR"): string {
  if (v === null || v === undefined) return "—";
  return `${new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2 }).format(v)} ${esc(currency)}`;
}

function fmtPct(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return `${v}%`;
}

function statusClass(status: string): string {
  return status === "won"                              ? "badge-processed" :
         status === "lost" || status === "abandoned"  ? "badge-failed"    :
                                                        "badge-received";
}

function classificationClass(c: string | null): string {
  return c === "nueva_venta" ? "badge-processed" :
         c === "cross_sell"  ? "badge-received"  :
                               "";
}

export async function renderSales(container: HTMLElement): Promise<void> {
  let filter: SalesDealsFilter = { limit: LIMIT, offset: 0 };
  let activePipeline: string | undefined;

  async function load(offset: number): Promise<void> {
    filter = { ...filter, offset };

    // Funnel stages (filtered by pipeline if active) and deals fetched in parallel.
    // KPIs are always global — the backend never filters sales_kpis_basic.
    const [funnelRes, dealsRes] = await Promise.all([
      getSalesFunnel(activePipeline),
      getSalesDeals({ ...filter, pipeline_name: activePipeline }),
    ]);

    const { kpis, stages } = funnelRes;

    // Max count_open across all stages — used to scale funnel bar widths.
    const maxOpen = Math.max(...stages.map(s => s.count_open), 1);

    // Group stages by pipeline name for multi-pipeline display.
    const pipelineNames = [...new Set(stages.map(s => s.pipeline_name ?? "Sin pipeline"))];

    container.innerHTML = `
      <section class="page">
        <h2>Ventas</h2>
        <p class="page-desc">
          Funnel de ventas: leads captados, conversión a venta cerrada, valor del pipeline
          activo y clasificación de cada operación como nueva venta o cross-sell.
        </p>

        <!-- ── KPI cards ──────────────────────────────────────────────────── -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-value">${kpis.total_leads}</div>
            <div class="kpi-label">Leads totales</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value">${kpis.total_won}</div>
            <div class="kpi-label">Ventas cerradas</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value">${kpis.total_open}</div>
            <div class="kpi-label">En curso</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value">${fmtPct(kpis.conversion_pct)}</div>
            <div class="kpi-label">Conversión<br><span style="font-size:11px;color:var(--muted)">histórica acumulada</span></div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value" style="font-size:1.35rem">${fmtMoney(kpis.value_pipeline_active)}</div>
            <div class="kpi-label">Valor pipeline activo</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value" style="font-size:1.35rem">${fmtMoney(kpis.avg_deal_value_won)}</div>
            <div class="kpi-label">Ticket medio (ganadas)</div>
          </div>
        </div>

        <!-- ── Funnel por etapa ───────────────────────────────────────────── -->
        <h3>Estado por etapa</h3>
        ${stages.length === 0
          ? `<p class="muted" style="padding:.75rem 0 1.5rem">
               Sin datos de etapas. Verifica que las migraciones SQL están aplicadas
               y que existen oportunidades en el CRM.
             </p>`
          : pipelineNames.map(pname => {
              const pStages = stages.filter(s => (s.pipeline_name ?? "Sin pipeline") === pname);
              return `
                <div style="margin-bottom:1.5rem">
                  <p class="funnel-pipeline-label">${esc(pname)}</p>
                  <div class="funnel-list">
                    ${pStages.map(s => {
                      const barPct = Math.round((s.count_open / maxOpen) * 100);
                      return `
                        <div class="funnel-row">
                          <span class="funnel-label">${esc(s.stage_name ?? "Sin etapa")}</span>
                          <div class="funnel-bar-wrap">
                            <div class="funnel-bar" style="width:${Math.max(barPct, s.count_open > 0 ? 2 : 0)}%"></div>
                          </div>
                          <span class="funnel-count">${s.count_open}</span>
                          <span class="funnel-won">${s.count_won > 0
                            ? `<span class="badge badge-processed">${s.count_won}&nbsp;✓</span>`
                            : ""
                          }</span>
                          <span class="funnel-value">${s.value_open > 0 ? fmtMoney(s.value_open) : "—"}</span>
                        </div>
                      `;
                    }).join("")}
                  </div>
                </div>
              `;
            }).join("")
        }

        <!-- ── Deals table ────────────────────────────────────────────────── -->
        <h3>Operaciones</h3>
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
            <input type="text" id="f-pipeline" placeholder="nombre del pipeline" value="${esc(activePipeline ?? "")}" />
          </label>
          <label>Desde
            <input type="date" id="f-from" value="${filter.from ? filter.from.slice(0, 10) : ""}" />
          </label>
          <label>Hasta
            <input type="date" id="f-to" value="${filter.to ? filter.to.slice(0, 10) : ""}" />
          </label>
          <button id="btn-apply">Aplicar</button>
          <button id="btn-clear" class="btn-clear">Limpiar</button>
        </div>

        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Contacto</th>
                <th>Oportunidad</th>
                <th>Pipeline</th>
                <th>Etapa</th>
                <th>Estado</th>
                <th>Tipo</th>
                <th>Valor</th>
                <th>Responsable</th>
                <th>Fecha entrada</th>
              </tr>
            </thead>
            <tbody>
              ${dealsRes.data.length === 0
                ? `<tr><td colspan="9" class="muted" style="text-align:center;padding:2.5rem">
                     No se encontraron operaciones con los filtros aplicados
                   </td></tr>`
                : dealsRes.data.map(row => `
                  <tr>
                    <td>
                      <div>${esc(row.contact_full_name)}</div>
                      <div style="font-size:11px;color:var(--muted)">${esc(row.contact_email)}</div>
                    </td>
                    <td>${esc(row.opportunity_name)}</td>
                    <td>${esc(row.pipeline_name)}</td>
                    <td>${esc(row.stage_name)}</td>
                    <td><span class="badge ${statusClass(row.status)}">${esc(STATUS_ES[row.status] ?? row.status)}</span></td>
                    <td>${row.deal_classification
                      ? `<span class="badge ${classificationClass(row.deal_classification)}">${esc(CLASSIFICATION_ES[row.deal_classification] ?? row.deal_classification)}</span>`
                      : '<span class="muted">—</span>'
                    }</td>
                    <td>${fmtMoney(row.monetary_value, row.currency)}</td>
                    <td>${esc(row.assigned_to)}</td>
                    <td>${fmtDate(row.created_at)}</td>
                  </tr>
                `).join("")
              }
            </tbody>
          </table>
        </div>

        <div id="pagination"></div>

        <p class="note">
          Las etapas muestran el estado actual de las oportunidades (snapshot), no el flujo histórico.
          <strong>Nueva venta</strong> = primera operación ganada sobre el contacto.
          <strong>Cross-sell</strong> = operación ganada posterior sobre el mismo contacto.
          La tasa de conversión es acumulada histórica — filtros temporales disponibles en la próxima iteración.
        </p>
      </section>
    `;

    container.querySelector("#pagination")!.replaceWith(
      buildPagination(dealsRes.total, LIMIT, offset, load)
    );

    document.getElementById("btn-apply")!.addEventListener("click", () => {
      activePipeline = (document.getElementById("f-pipeline") as HTMLInputElement).value.trim() || undefined;
      filter = {
        ...filter,
        status: (document.getElementById("f-status") as HTMLSelectElement).value || undefined,
        from:   (document.getElementById("f-from")   as HTMLInputElement).value  || undefined,
        to:     (document.getElementById("f-to")     as HTMLInputElement).value  || undefined,
        offset: 0,
      };
      load(0);
    });

    document.getElementById("btn-clear")!.addEventListener("click", () => {
      activePipeline = undefined;
      filter = { limit: LIMIT, offset: 0 };
      load(0);
    });
  }

  await load(0);
}
