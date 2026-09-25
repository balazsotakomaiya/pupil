import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { queryClient } from "./lib/query";
import { applyRuntimeMarker } from "./lib/runtime";
import { applySavedTheme } from "./lib/theme";
import { installWindowChrome } from "./lib/window-chrome";
// Fonts ship with the app so type renders the same offline and nothing is
// fetched from a third party at launch.
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/syne/700.css";
import "./styles/animations.css";
import "./styles/tokens.css";
import "./styles/reset.css";
import "./styles/utilities.css";
import "./styles/shared.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

applyRuntimeMarker();
installWindowChrome();
applySavedTheme();

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
