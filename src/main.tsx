// Polyfills MUST be the very first import — they patch globals that other deps
// (Coinbase Wallet SDK, etc.) read at module-evaluation time.
import "./polyfills";

import { createRoot } from "react-dom/client";
import ErrorBoundary from "./components/ErrorBoundary";
import AppBootstrap from "./components/AppBootstrap";
import "./index.css";

const mountNode = document.getElementById("root") ?? document.body.appendChild(document.createElement("div"));
mountNode.id = "root";

createRoot(mountNode).render(
  <ErrorBoundary>
    <AppBootstrap />
  </ErrorBoundary>
);
