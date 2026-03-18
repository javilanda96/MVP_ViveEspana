import {
  getConnections, createConnection, updateConnection,
  getIntegrations,
  type ConnectionRow, type ConnectionInput, type IntegrationData,
} from "../api.js";
import { fmtDate, esc } from "../utils.js";
import { openModal } from "../modal.js";

// Finite sets enforced server-side; mirrored here for select options only.
const VALID_SOURCES    = ["ghl", "stripe", "flywire", "holded", "manual"] as const;
const VALID_AUTH_TYPES = ["GHL Shared Secret", "HMAC-SHA256", "none"]     as const;

const SOURCE_LABEL: Record<string, string> = {
  ghl:     "GoHighLevel",
  stripe:  "Stripe",
  flywire: "Flywire",
  holded:  "Holded",
  manual:  "Manual",
};

const STEP_LABELS = ["Identificación", "Configuración", "Detalles adicionales", "Confirmar"] as const;

// ── Provider guidance ─────────────────────────────────────────────────────────
// Shown in cards (setup_hint) and after saving (after_save). {endpoint} is
// replaced at render time. Never implies automatic behaviour.

interface ProviderHelp {
  webhook_needed: boolean;
  setup_hint:     string; // one-line, shown on card when no activity
  after_save:     string; // shown in success pane after wizard save
}

const PROVIDER_HELP: Record<string, ProviderHelp> = {
  ghl: {
    webhook_needed: true,
    setup_hint: "Requiere un workflow en GoHighLevel con una acción HTTP Request apuntando al endpoint.",
    after_save: `En <strong>GoHighLevel</strong>, ve a <em>Automation → Workflows</em>, añade una acción
      <em>HTTP Request</em> (POST) con URL <code>{endpoint}</code> y la cabecera
      <code>X-GHL-Signature</code> con el valor de tu secreto de verificación.`,
  },
  stripe: {
    webhook_needed: true,
    setup_hint: "Requiere registrar el endpoint en Stripe → Developers → Webhooks.",
    after_save: `En el <strong>Dashboard de Stripe</strong>, ve a <em>Developers → Webhooks</em>,
      añade el endpoint <code>{endpoint}</code> y selecciona los eventos que debe escuchar.
      El signing secret generado debe guardarse en la variable de entorno
      <code>STRIPE_WEBHOOK_SECRET</code> del servidor.`,
  },
  flywire: {
    webhook_needed: true,
    setup_hint: "Requiere contactar con Flywire para activar el envío de eventos a este endpoint.",
    after_save: `Contacta con el equipo de integración de <strong>Flywire</strong> para configurar
      el envío de eventos al endpoint <code>{endpoint}</code>.`,
  },
  holded: {
    webhook_needed: true,
    setup_hint: "Requiere configurar un webhook en Holded → Integraciones.",
    after_save: `En <strong>Holded</strong>, ve a <em>Integraciones → Webhooks</em> y añade
      <code>{endpoint}</code> como destino.`,
  },
  manual: {
    webhook_needed: false,
    setup_hint: "Esta dirección acepta llamadas manuales o desde aplicaciones propias.",
    after_save: `La dirección <code>{endpoint}</code> está lista para recibir datos.
      Puedes probarla con herramientas como cURL o Postman enviando los datos que espera recibir.`,
  },
};

const GENERIC_AFTER_SAVE =
  `Configura tu sistema externo para que envíe notificaciones a
  <code>{endpoint}</code> en este servidor.`;

// ── Derived status (truthful — based only on observed data) ───────────────────

function connStatusHtml(conn: ConnectionRow, act: IntegrationData | undefined): string {
  if (!conn.enabled) {
    return `<span class="conn-status conn-status--off">Inactiva</span>`;
  }
  if (!act || (act.total24h === 0 && act.lastSeen === null)) {
    return `<span class="conn-status conn-status--pending">Sin eventos todavía</span>`;
  }
  if (act.failed24h > 0) {
    return `<span class="conn-status conn-status--error">Error reciente</span>`;
  }
  if (act.total24h > 0) {
    return `<span class="conn-status conn-status--active">Recibiendo eventos</span>`;
  }
  return `<span class="conn-status conn-status--pending">Sin actividad reciente</span>`;
}

// Show setup hint only when the connection has never been observed active.
function setupHintHtml(conn: ConnectionRow, act: IntegrationData | undefined): string {
  if (!conn.enabled) return "";
  if (act && (act.total24h > 0 || act.lastSeen !== null)) return ""; // already working — hide hint
  const help = PROVIDER_HELP[conn.source];
  const text = help
    ? help.setup_hint
    : "Configura el proveedor externo para enviar eventos a este endpoint.";
  return `
    <div class="setup-hint">
      <span class="setup-hint-icon">⚙</span>
      <span><strong>Configuración pendiente:</strong> ${esc(text)}</span>
    </div>`;
}

// After-save success pane shown inside the wizard modal.
function afterSaveHtml(source: string, endpoint: string, isNew: boolean): string {
  const help  = PROVIDER_HELP[source];
  const raw   = help ? help.after_save : GENERIC_AFTER_SAVE;
  const text  = raw.replace(/\{endpoint\}/g, `<code>${esc(endpoint)}</code>`);
  const title = isNew ? "Conexión creada" : "Conexión actualizada";
  return `
    <div class="wiz-success">
      <div class="wiz-success-icon">✓</div>
      <p class="wiz-success-title">${esc(title)}</p>
      <p class="wiz-success-sub">Los cambios se han guardado correctamente.</p>
    </div>
    <div class="wiz-next-steps">
      <p class="wiz-next-label">Siguiente paso</p>
      <p class="wiz-next-text">${text}</p>
      <p class="wiz-next-note">
        En cuanto llegue el primer evento, el estado de la integración cambiará a
        <strong>Recibiendo eventos</strong> en este panel.
      </p>
    </div>
  `;
}

export async function renderIntegrations(container: HTMLElement): Promise<void> {
  const [connections, integrations] = await Promise.all([
    getConnections(),
    getIntegrations(),
  ]);

  // Secret presence keyed by source — derived from env vars via /admin/integrations.
  const secretBySource: Record<string, boolean> = {};
  for (const i of integrations) {
    if (!(i.source in secretBySource)) secretBySource[i.source] = i.secretPresent;
  }

  // Activity data keyed by endpoint — values come exclusively from observed events_log rows.
  const activityByEndpoint = Object.fromEntries(
    integrations.map(i => [i.endpoint, i])
  );

  // ── Wizard ────────────────────────────────────────────────────────────────────

  function openWizard(conn: ConnectionRow | null): void {
    const isNew = conn === null;

    // Accumulated form data across steps — pre-fill from existing row on edit.
    const data: Partial<ConnectionInput> = isNew ? { enabled: true } : {
      name:        conn!.name,
      source:      conn!.source,
      event_type:  conn!.event_type,
      endpoint:    conn!.endpoint,
      auth_type:   conn!.auth_type,
      description: conn!.description,
      enabled:     conn!.enabled,
      base_url:    conn!.base_url,
      account_id:  conn!.account_id,
      public_key:  conn!.public_key,
      notes:       conn!.notes,
    };

    let step = 1;

    // ── HTML builders ─────────────────────────────────────────────────────────

    function stepIndicatorHtml(current: number): string {
      const items = STEP_LABELS.map((lbl, i) => {
        const n   = i + 1;
        const cls = n === current ? "ws-step ws-active"
                  : n < current  ? "ws-step ws-done"
                  :                "ws-step";
        return `<span class="${cls}"><span class="ws-num">${n}</span>${lbl}</span>`;
      }).join(`<span class="ws-sep">›</span>`);
      return `<div class="wizard-steps">${items}</div>`;
    }

    function navHtml(s: number): string {
      const isLast = s === STEP_LABELS.length;
      const back   = s > 1
        ? `<button id="wiz-back"   class="btn-secondary">← Atrás</button>`
        : `<span></span>`;
      const fwd    = isLast
        ? `<button id="wiz-submit" class="btn-primary">Guardar</button>`
        : `<button id="wiz-next"   class="btn-primary">Siguiente →</button>`;
      return `<div class="wizard-nav">${back}${fwd}</div>`;
    }

    function step1Html(): string {
      const srcOptions = VALID_SOURCES.map(s =>
        `<option value="${s}"${data.source === s ? " selected" : ""}>${SOURCE_LABEL[s] ?? s}</option>`
      ).join("");
      return `
        <div class="form-group">
          <label for="wf-name">Nombre <span class="req">*</span></label>
          <input id="wf-name" type="text" value="${esc(data.name ?? "")}"
            placeholder="Ej. GHL Contactos" autocomplete="off">
          <p class="field-hint">Un nombre corto para identificar esta integración en el panel.</p>
        </div>
        <div class="form-group">
          <label for="wf-source">Proveedor <span class="req">*</span></label>
          <select id="wf-source">${srcOptions}</select>
          <p class="field-hint">Sistema externo que envía los datos a este servidor.</p>
        </div>
        <div class="form-group">
          <label for="wf-description">Descripción <span class="opt">(opcional)</span></label>
          <textarea id="wf-description" rows="2"
            placeholder="Ej. Sincroniza contactos desde GHL.">${esc(data.description ?? "")}</textarea>
        </div>
      `;
    }

    function step2Html(): string {
      const authOptions = VALID_AUTH_TYPES.map(a =>
        `<option value="${a}"${data.auth_type === a ? " selected" : ""}>${a}</option>`
      ).join("");
      return `
        <div class="form-group">
          <label for="wf-endpoint">Endpoint <span class="req">*</span></label>
          <input id="wf-endpoint" type="text" value="${esc(data.endpoint ?? "")}"
            placeholder="/webhooks/contacts" autocomplete="off">
          <p class="field-hint">Ruta en este servidor que recibe los eventos del proveedor.</p>
        </div>
        <div class="form-group">
          <label for="wf-event_type">Tipo de evento <span class="req">*</span></label>
          <input id="wf-event_type" type="text" value="${esc(data.event_type ?? "")}"
            placeholder="contact.upsert" autocomplete="off">
          <p class="field-hint">
            Identificador del evento que procesa esta integración
            (p.&nbsp;ej. <code>contact.upsert</code>).
          </p>
        </div>
        <div class="form-group">
          <label for="wf-auth_type">Autenticación <span class="req">*</span></label>
          <select id="wf-auth_type">${authOptions}</select>
          <p class="field-hint">Mecanismo de verificación que usa el proveedor para firmar las peticiones.</p>
        </div>
        <div class="form-group form-inline">
          <input id="wf-enabled" type="checkbox" ${(data.enabled ?? true) ? "checked" : ""}>
          <label for="wf-enabled">Integración activa</label>
        </div>
      `;
    }

    function step3Html(): string {
      const src      = data.source ?? "";
      const secretOk = secretBySource[src] ?? false;
      return `
        <div class="form-group">
          <label for="wf-base_url">URL base del proveedor <span class="opt">(opcional)</span></label>
          <input id="wf-base_url" type="url" value="${esc(data.base_url ?? "")}"
            placeholder="https://api.gohighlevel.com" autocomplete="off">
          <p class="field-hint">URL raíz de la API del proveedor. Solo informativo — no afecta al procesamiento de webhooks.</p>
        </div>
        <div class="form-group">
          <label for="wf-account_id">ID de cuenta / workspace <span class="opt">(opcional)</span></label>
          <input id="wf-account_id" type="text" value="${esc(data.account_id ?? "")}"
            placeholder="Ej. location_abc123" autocomplete="off">
          <p class="field-hint">Identificador de la cuenta o workspace en el proveedor externo.</p>
        </div>
        <div class="form-group">
          <label for="wf-public_key">Clave pública / Client ID <span class="opt">(opcional)</span></label>
          <input id="wf-public_key" type="text" value="${esc(data.public_key ?? "")}"
            placeholder="pk_live_…" autocomplete="off">
          <p class="field-hint">
            Clave pública o client ID (p.&nbsp;ej. Stripe publishable key).
            <strong>No introducir secretos de firma ni claves privadas aquí.</strong>
          </p>
        </div>
        <div class="form-group">
          <label for="wf-notes">Notas operativas <span class="opt">(opcional)</span></label>
          <textarea id="wf-notes" rows="3"
            placeholder="Instrucciones de configuración, particularidades conocidas…">${esc(data.notes ?? "")}</textarea>
        </div>
        <div class="note" style="margin-top:.75rem">
          <strong>Secreto de verificación:</strong>
          ${secretOk
            ? `<span class="ok">✓ Configurado para este proveedor</span>`
            : `<span class="warn">✗ Sin configurar (modo permisivo)</span>`}
          — Los secretos se gestionan exclusivamente mediante variables de entorno del servidor
          y no son editables desde este panel.
        </div>
      `;
    }

    function step4Html(): string {
      const rows: Array<[string, string]> = [
        ["Nombre",         esc(data.name ?? "—")],
        ["Proveedor",      esc(SOURCE_LABEL[data.source ?? ""] ?? data.source ?? "—")],
        ["Descripción",    esc(data.description || "—")],
        ["Endpoint",       `<code>${esc(data.endpoint ?? "—")}</code>`],
        ["Tipo de evento", esc(data.event_type ?? "—")],
        ["Autenticación",  esc(data.auth_type ?? "—")],
        ["Activo",         (data.enabled ?? true) ? "Sí" : "No"],
        ...(data.base_url   ? [["URL base",         esc(data.base_url)]]   as Array<[string,string]> : []),
        ...(data.account_id ? [["ID de cuenta",     esc(data.account_id)]] as Array<[string,string]> : []),
        ...(data.public_key ? [["Clave pública",    esc(data.public_key)]] as Array<[string,string]> : []),
        ...(data.notes      ? [["Notas operativas", esc(data.notes)]]      as Array<[string,string]> : []),
      ];
      return `
        <p style="margin-bottom:.75rem;font-size:13px;color:var(--muted)">
          Revisa los datos antes de guardar. Podrás editarlos en cualquier momento.
        </p>
        <div class="kv-grid">
          ${rows.map(([k, v]) => `<span class="key">${k}</span><span>${v}</span>`).join("")}
        </div>
        <div id="wiz-err" class="text-danger" style="margin-top:10px;font-size:13px"></div>
      `;
    }

    function paneHtml(s: number): string {
      if (s === 1) return step1Html();
      if (s === 2) return step2Html();
      if (s === 3) return step3Html();
      return step4Html();
    }

    // ── Step read-back ────────────────────────────────────────────────────────

    function readStep1(): boolean {
      const name = (document.getElementById("wf-name") as HTMLInputElement).value.trim();
      if (!name) { alert("El nombre es obligatorio."); return false; }
      data.name        = name;
      data.source      = (document.getElementById("wf-source") as HTMLSelectElement).value;
      data.description = (document.getElementById("wf-description") as HTMLTextAreaElement).value.trim() || null;
      return true;
    }

    function readStep2(): boolean {
      const endpoint  = (document.getElementById("wf-endpoint")   as HTMLInputElement).value.trim();
      const eventType = (document.getElementById("wf-event_type") as HTMLInputElement).value.trim();
      if (!endpoint)  { alert("El endpoint es obligatorio.");        return false; }
      if (!eventType) { alert("El tipo de evento es obligatorio."); return false; }
      data.endpoint   = endpoint;
      data.event_type = eventType;
      data.auth_type  = (document.getElementById("wf-auth_type") as HTMLSelectElement).value;
      data.enabled    = (document.getElementById("wf-enabled")   as HTMLInputElement).checked;
      return true;
    }

    function readStep3(): boolean {
      // All optional — empty string stored as null.
      data.base_url   = (document.getElementById("wf-base_url")   as HTMLInputElement).value.trim()    || null;
      data.account_id = (document.getElementById("wf-account_id") as HTMLInputElement).value.trim()    || null;
      data.public_key = (document.getElementById("wf-public_key") as HTMLInputElement).value.trim()    || null;
      data.notes      = (document.getElementById("wf-notes")      as HTMLTextAreaElement).value.trim() || null;
      return true;
    }

    // ── Navigation wiring ─────────────────────────────────────────────────────

    function renderStep(s: number): void {
      const body = document.getElementById("modal-body");
      if (!body) return;
      body.innerHTML = stepIndicatorHtml(s) + paneHtml(s) + navHtml(s);
      wireNav(s);
    }

    function wireNav(s: number): void {
      document.getElementById("wiz-back")?.addEventListener("click", () => {
        step--;
        renderStep(step);
      });

      document.getElementById("wiz-next")?.addEventListener("click", () => {
        const valid = s === 1 ? readStep1() : s === 2 ? readStep2() : s === 3 ? readStep3() : true;
        if (valid) { step++; renderStep(step); }
      });

      document.getElementById("wiz-submit")?.addEventListener("click", async () => {
        const errEl = document.getElementById("wiz-err");
        try {
          if (isNew) {
            await createConnection(data as ConnectionInput);
          } else {
            await updateConnection(conn!.id, data);
          }

          // Show success + next-steps pane in the modal instead of abruptly closing.
          // The page re-renders in the background so the user sees fresh data on close.
          const modalBody  = document.getElementById("modal-body");
          const modalTitle = document.querySelector<HTMLElement>("#detail-modal .modal-header h3");
          if (modalBody)  modalBody.innerHTML = afterSaveHtml(data.source ?? "", data.endpoint ?? "", isNew);
          if (modalTitle) modalTitle.textContent = isNew ? "¡Conexión creada!" : "Conexión actualizada";

          // Re-render page in background — no await so it doesn't block the modal.
          renderIntegrations(container).catch(() => {});

        } catch (err) {
          if (errEl) errEl.textContent = err instanceof Error ? err.message : String(err);
        }
      });
    }

    const title = isNew ? "Nueva integración" : `Editar: ${esc(conn!.name)}`;
    openModal(title, ""); // open panel with empty body first
    renderStep(1);        // then populate step 1
  }

  // ── Cards ──────────────────────────────────────────────────────────────────

  const cards = connections.length === 0
    ? `<div class="empty-state">
        <div class="empty-state-icon">🔌</div>
        <p class="empty-state-title">No hay integraciones configuradas</p>
        <p class="empty-state-sub">
          Crea la primera integración para empezar a recibir eventos de tus plataformas externas.
        </p>
        <button id="btn-new-conn-empty" class="btn-primary" style="margin-top:1rem">
          + Nueva integración
        </button>
      </div>`
    : connections.map(conn => {
        const act      = activityByEndpoint[conn.endpoint];
        const srcLabel = SOURCE_LABEL[conn.source] ?? conn.source;
        return `
          <div class="integration-card">
            <div class="card-title-row">
              <span class="card-name">${esc(conn.name)}</span>
              <div class="card-title-actions">
                ${connStatusHtml(conn, act)}
                <button class="edit-conn" data-id="${esc(conn.id)}" class="btn-secondary"
                  style="font-size:12px;cursor:pointer;background:none;border:1px solid var(--border);border-radius:4px;padding:2px 8px;white-space:nowrap">
                  Editar
                </button>
              </div>
            </div>
            <div class="kv-grid" style="margin-top:.75rem">
              <span class="key">Proveedor</span>
              <span>${esc(srcLabel)}</span>

              <span class="key">Endpoint</span>
              <span><code>${esc(conn.endpoint)}</code></span>

              <span class="key">Autenticación</span>
              <span>${esc(conn.auth_type)}</span>

              <span class="key">Secreto</span>
              <span>${secretBySource[conn.source]
                ? `<span class="ok">✓ Configurado</span>`
                : `<span class="warn">✗ Sin configurar (modo permisivo)</span>`
              }</span>

              <span class="key">Última actividad</span>
              <span>${act ? fmtDate(act.lastSeen) : "—"}</span>

              <span class="key">Eventos (24 h)</span>
              <span>${act !== undefined ? act.total24h : "—"}</span>

              <span class="key">Fallos (24 h)</span>
              <span class="${act && act.failed24h > 0 ? "text-danger" : ""}">
                ${act !== undefined ? act.failed24h : "—"}
              </span>

              ${conn.base_url ? `
              <span class="key">URL base</span>
              <span><a href="${esc(conn.base_url)}" target="_blank" rel="noopener noreferrer"
                style="color:var(--primary);word-break:break-all">${esc(conn.base_url)}</a></span>` : ""}

              ${conn.account_id ? `
              <span class="key">ID de cuenta</span>
              <span><code>${esc(conn.account_id)}</code></span>` : ""}

              ${conn.description ? `
              <span class="key">Descripción</span>
              <span>${esc(conn.description)}</span>` : ""}

              <span class="key">Activo</span>
              <span>${conn.enabled
                ? `<span class="badge badge-ok">Sí</span>`
                : `<span class="badge badge-off">No</span>`
              }</span>
            </div>
            ${setupHintHtml(conn, act)}
          </div>
        `;
      }).join("");

  container.innerHTML = `
    <section class="page">
      <h2>
        Integraciones
        ${connections.length > 0 ? `
        <button id="btn-new-conn"
          style="float:right;font-size:13px;cursor:pointer;padding:4px 12px">
          + Nueva integración
        </button>` : ""}
      </h2>

      <div class="conn-explainer">
        <p class="conn-explainer-text">
          Una <strong>integración</strong> registra un endpoint de este servidor como destino para
          los eventos de una plataforma externa (GHL, Stripe, Flywire…). Crearla aquí
          <em>no conecta automáticamente el proveedor</em>: es necesario configurar el
          webhook en la plataforma externa por separado.
        </p>
        <div class="how-it-works">
          <span class="hiw-label">Cómo funciona</span>
          <div class="hiw-steps">
            <div class="hiw-step"><span class="hiw-num">1</span><span>Crea la integración aquí</span></div>
            <span class="hiw-arrow">→</span>
            <div class="hiw-step"><span class="hiw-num">2</span><span>Configura el webhook en el proveedor</span></div>
            <span class="hiw-arrow">→</span>
            <div class="hiw-step"><span class="hiw-num">3</span><span>Verifica el secreto en el servidor</span></div>
            <span class="hiw-arrow">→</span>
            <div class="hiw-step"><span class="hiw-num">4</span><span>Los eventos aparecen en Registros</span></div>
          </div>
        </div>
      </div>

      <div class="integration-grid">
        ${cards}
      </div>

      ${connections.length > 0 ? `
      <p class="note">
        ⚠ <strong>Límite de visibilidad:</strong>
        «Última actividad» refleja el evento más reciente persistido en <code>events_log</code>.
        Una brecha prolongada puede indicar inactividad del proveedor, una configuración
        incorrecta del workflow en GHL, o fallos de entrega rechazados antes de llegar
        a la capa de servicio (que nunca se registran). Este panel no realiza sondeos
        de salud extremo a extremo: no puede confirmar que los proveedores externos
        estén operativos en este momento.
      </p>` : ""}
    </section>
  `;

  container.querySelectorAll<HTMLButtonElement>(".edit-conn").forEach(btn => {
    const conn = connections.find(c => c.id === btn.dataset["id"]) ?? null;
    btn.addEventListener("click", () => openWizard(conn));
  });

  document.getElementById("btn-new-conn")?.addEventListener("click", () => openWizard(null));
  document.getElementById("btn-new-conn-empty")?.addEventListener("click", () => openWizard(null));
}
