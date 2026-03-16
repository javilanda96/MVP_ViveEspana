/**
 * Minimal slide-in detail panel (right-side drawer).
 * Opens over the current page without a route change.
 */
export function openModal(title, bodyHtml) {
    // Remove any existing modal first
    document.getElementById("detail-modal")?.remove();
    const backdrop = document.createElement("div");
    backdrop.id = "detail-modal";
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `
    <div class="modal-panel" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close" id="modal-close-btn" aria-label="Close">✕</button>
      </div>
      <div id="modal-body">${bodyHtml}</div>
    </div>
  `;
    document.body.appendChild(backdrop);
    // Close on backdrop click
    backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop)
            backdrop.remove();
    });
    // Close on button click
    document.getElementById("modal-close-btn").addEventListener("click", () => {
        backdrop.remove();
    });
    // Close on Escape
    const onKey = (e) => {
        if (e.key === "Escape") {
            backdrop.remove();
            document.removeEventListener("keydown", onKey);
        }
    };
    document.addEventListener("keydown", onKey);
}
