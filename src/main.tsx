import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { ErrorBoundary } from "./app/ErrorBoundary";
import "./ui/styles.css";

// iOS Safari ignores user-scalable=no; suppress page pinch-zoom (the board has its own).
document.addEventListener("gesturestart", (e) => e.preventDefault());

// Size the app to the *visible* viewport. iOS browsers (all WebKit, including
// Chrome) slide their toolbars over the page while 100vh/100dvh keep reporting
// the toolbar-hidden height — leaving the top of a locked layout hidden behind
// the toolbar with no scroll to recover it. visualViewport reports the truth.
const setAppHeight = () => {
  const h = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty("--app-height", `${Math.round(h)}px`);
};
setAppHeight();
window.visualViewport?.addEventListener("resize", setAppHeight);
window.addEventListener("resize", setAppHeight);
window.addEventListener("orientationchange", setAppHeight);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
