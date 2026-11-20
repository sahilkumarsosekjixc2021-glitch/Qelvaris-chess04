import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import RootApp from "./auth/RootApp.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { installGlobalErrorHandlers } from "./lib/errorReport";
import "./qelvaris-redesign.css";
import "./glass-theme.css";


installGlobalErrorHandlers();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary scope="root">
      <RootApp />
    </ErrorBoundary>
  </React.StrictMode>
);