import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { ErrorBoundary } from "./app/ErrorBoundary";
import "./ui/styles.css";

// iOS Safari ignores user-scalable=no; suppress page pinch-zoom (the board has its
// own). All three gesture events must be cancelled or Safari still zooms.
for (const evt of ["gesturestart", "gesturechange", "gestureend"]) {
  document.addEventListener(evt, (e) => e.preventDefault());
}

// Size the app to the *visible* viewport. iOS browsers (all WebKit, including
// Chrome) slide their toolbars over the page while 100vh/100dvh keep reporting
// the toolbar-hidden height — leaving the top of a locked layout hidden behind
// the toolbar with no scroll to recover it. visualViewport reports the truth.
const setAppHeight = () => {
  const vv = window.visualViewport;
  // Multiply by scale so a pinch-zoomed page (iOS ignores the meta) reports the
  // layout-viewport height — otherwise zooming would shrink the app layout too.
  const h = vv ? vv.height * vv.scale : window.innerHeight;
  document.documentElement.style.setProperty("--app-height", `${Math.round(h)}px`);
};
setAppHeight();
window.visualViewport?.addEventListener("resize", setAppHeight);
window.addEventListener("resize", setAppHeight);
window.addEventListener("orientationchange", setAppHeight);
window.addEventListener("pageshow", setAppHeight); // bfcache restores skip load-time setup

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
