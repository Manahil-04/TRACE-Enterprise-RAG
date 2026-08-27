import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import { App } from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { ExplorationsProvider } from "./explorations/ExplorationsContext";
import { AppStatusProvider } from "./status/AppStatusContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ExplorationsProvider>
          <AppStatusProvider>
            <App />
          </AppStatusProvider>
        </ExplorationsProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
