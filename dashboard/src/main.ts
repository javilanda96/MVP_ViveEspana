/**
 * Dashboard entry point.
 *
 * Flow:
 *   1. Page loads → tries GET /admin/stats to check session cookie validity.
 *   2. If 401  → show login form.
 *   3. Login form POSTs key to /admin/login → server sets HttpOnly cookie → show app.
 *   4. Tab clicks navigate between pages without reloading.
 *   5. Any page that gets a 401 from the API re-shows the login form.
 *
 * ADMIN_API_KEY is never present in this file or in any built asset.
 * The key is entered in the login form, sent once over HTTPS, and then
 * only the server-issued HttpOnly session cookie is used thereafter.
 */

import { checkAuth, login, logout, UnauthorizedError } from "./api.js";
import { renderOverview }     from "./pages/overview.js";
import { renderLogs }         from "./pages/logs.js";
import { renderErrors }       from "./pages/errors.js";
import { renderPipeline }     from "./pages/pipeline.js";
import { renderIntegrations } from "./pages/integrations.js";

// ─── Page registry ────────────────────────────────────────────────────────────

type PageRenderer = (container: HTMLElement) => Promise<void>;

const PAGES: Record<string, PageRenderer> = {
  overview:     renderOverview,
  logs:         renderLogs,
  errors:       renderErrors,
  pipeline:     renderPipeline,
  integrations: renderIntegrations,
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
  el.innerHTML = `<p class="loading">Loading…</p>`;

  try {
    await PAGES[page]?.(el);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      showLogin();
      return;
    }
    el.innerHTML = `<p class="error" style="padding:2rem">
      Failed to load page: ${err instanceof Error ? err.message : String(err)}
    </p>`;
  }
}

// ─── Event wiring ─────────────────────────────────────────────────────────────

// Tab navigation
document.getElementById("tab-nav")!.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".tab-btn");
  if (btn?.dataset.page) navigateTo(btn.dataset.page);
});

// Login form
document.getElementById("login-form")!.addEventListener("submit", async (e) => {
  e.preventDefault();

  const keyInput  = document.getElementById("admin-key") as HTMLInputElement;
  const errEl     = document.getElementById("login-error")!;
  const submitBtn = document.getElementById("login-btn") as HTMLButtonElement;

  errEl.style.display  = "none";
  submitBtn.disabled   = true;
  submitBtn.textContent = "Signing in…";

  try {
    const ok = await login(keyInput.value);
    if (ok) {
      keyInput.value = "";   // clear key from DOM immediately
      showApp();
    } else {
      errEl.style.display   = "block";
      submitBtn.disabled    = false;
      submitBtn.textContent = "Sign in";
    }
  } catch {
    errEl.textContent     = "Network error — is the server running?";
    errEl.style.display   = "block";
    submitBtn.disabled    = false;
    submitBtn.textContent = "Sign in";
  }
});

// Logout button
document.getElementById("logout-btn")!.addEventListener("click", async () => {
  await logout();
  showLogin();
});

// ─── Bootstrap ────────────────────────────────────────────────────────────────

(async () => {
  const authed = await checkAuth();
  if (authed) {
    showApp();
  } else {
    showLogin();
  }
})();
