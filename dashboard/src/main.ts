/**
 * Punto de entrada del panel de operaciones.
 *
 * Flujo:
 *   1. La página carga → intenta GET /admin/stats para comprobar la sesión.
 *   2. Si recibe 401  → muestra el formulario de inicio de sesión.
 *   3. El formulario envía la clave a /admin/login → el servidor emite una
 *      cookie HttpOnly → se muestra la aplicación.
 *   4. Los clics en las pestañas navegan entre páginas sin recargar.
 *   5. Cualquier página que reciba un 401 de la API vuelve a mostrar el login.
 *
 * ADMIN_API_KEY nunca está presente en este fichero ni en ningún asset compilado.
 * La clave se introduce en el formulario, se envía una sola vez por HTTPS y
 * a partir de ese momento sólo se usa la cookie de sesión HttpOnly del servidor.
 */

import { checkAuth, login, logout, UnauthorizedError } from "./api.js";
import { renderOverview }     from "./pages/overview.js";
import { renderLogs }         from "./pages/logs.js";
import { renderErrors }       from "./pages/errors.js";
import { renderPipeline }     from "./pages/pipeline.js";
import { renderIntegrations } from "./pages/integrations.js";
import { renderAlerts }       from "./pages/alerts.js";

// ─── Registro de páginas ───────────────────────────────────────────────────────

type PageRenderer = (container: HTMLElement) => Promise<void>;

const PAGES: Record<string, PageRenderer> = {
  overview:     renderOverview,
  logs:         renderLogs,
  errors:       renderErrors,
  pipeline:     renderPipeline,
  integrations: renderIntegrations,
  alerts:       renderAlerts,
};

let activePage = "overview";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const loginScreen = () => document.getElementById("login-screen")!;
const mainApp     = () => document.getElementById("main-app")!;
const content     = () => document.getElementById("page-content")!;

function showLogin(): void {
  loginScreen().style.display = "flex";
  mainApp().style.display     = "none";
}

function showApp(): void {
  loginScreen().style.display = "none";
  mainApp().style.display     = "block";
  navigateTo(activePage);
}

function setActiveTab(page: string): void {
  document.querySelectorAll<HTMLButtonElement>(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.page === page);
  });
}

async function navigateTo(page: string): Promise<void> {
  activePage = page;
  setActiveTab(page);

  const el = content();
  el.innerHTML = `<p class="loading">Cargando…</p>`;

  try {
    await PAGES[page]?.(el);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      showLogin();
      return;
    }
    el.innerHTML = `<p class="error" style="padding:2rem">
      Error al cargar la página: ${err instanceof Error ? err.message : String(err)}
    </p>`;
  }
}

// ─── Eventos ──────────────────────────────────────────────────────────────────

// Navegación por pestañas
document.getElementById("tab-nav")!.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".tab-btn");
  if (btn?.dataset.page) navigateTo(btn.dataset.page);
});

// Formulario de inicio de sesión
document.getElementById("login-form")!.addEventListener("submit", async (e) => {
  e.preventDefault();

  const keyInput  = document.getElementById("admin-key") as HTMLInputElement;
  const errEl     = document.getElementById("login-error")!;
  const submitBtn = document.getElementById("login-btn") as HTMLButtonElement;

  errEl.style.display   = "none";
  submitBtn.disabled    = true;
  submitBtn.textContent = "Iniciando sesión…";

  try {
    const ok = await login(keyInput.value);
    if (ok) {
      keyInput.value = "";   // limpiar la clave del DOM inmediatamente
      showApp();
    } else {
      errEl.style.display   = "block";
      submitBtn.disabled    = false;
      submitBtn.textContent = "Acceder";
    }
  } catch {
    errEl.textContent     = "Error de red — ¿el servidor está en marcha?";
    errEl.style.display   = "block";
    submitBtn.disabled    = false;
    submitBtn.textContent = "Acceder";
  }
});

// Botón de cierre de sesión
document.getElementById("logout-btn")!.addEventListener("click", async () => {
  await logout();
  showLogin();
});

// ─── Arranque ─────────────────────────────────────────────────────────────────

(async () => {
  const authed = await checkAuth();
  if (authed) {
    showApp();
  } else {
    showLogin();
  }
})();
