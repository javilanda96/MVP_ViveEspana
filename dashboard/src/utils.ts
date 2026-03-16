/** Formatea una marca de tiempo ISO a cadena localizada corta, o "—" si no existe. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

/** Escapa caracteres especiales HTML para evitar inyección mediante contenido de la BD. */
export function esc(s: unknown): string {
  if (s === null || s === undefined) return "—";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Renderiza un badge de estado. */
export function statusBadge(status: string): string {
  const labels: Record<string, string> = {
    processed: "procesado",
    failed:    "fallido",
    received:  "recibido",
  };
  const cls =
    status === "processed" ? "badge-processed" :
    status === "failed"    ? "badge-failed"    :
                             "badge-received";
  return `<span class="badge ${cls}">${esc(labels[status] ?? status)}</span>`;
}

/** Construye un control de paginación. */
export function buildPagination(
  total:  number,
  limit:  number,
  offset: number,
  onNav:  (newOffset: number) => void
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "pagination";

  const totalPages = Math.ceil(total / limit) || 1;
  const page       = Math.floor(offset / limit) + 1;

  const prev = document.createElement("button");
  prev.textContent = "← Anterior";
  prev.disabled    = offset === 0;
  prev.addEventListener("click", () => onNav(Math.max(0, offset - limit)));

  const info = document.createElement("span");
  info.textContent = `Página ${page} de ${totalPages}  (${total} en total)`;

  const next = document.createElement("button");
  next.textContent = "Siguiente →";
  next.disabled    = offset + limit >= total;
  next.addEventListener("click", () => onNav(offset + limit));

  wrap.append(prev, info, next);
  return wrap;
}

/** Devuelve el JSON con sangría para el visor de payloads. */
export function prettyJson(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}
