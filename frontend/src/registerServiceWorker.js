/** Minimal PWA: offline fallback to cached shell (production only). */
export function registerServiceWorker() {
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${process.env.PUBLIC_URL || ""}/sw.js`)
      .catch(() => {});
  });
}
