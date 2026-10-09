import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./logo-fix.css";
import "./ui-fixes.css";
import "./dark-theme.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode><App /></StrictMode>,
);
