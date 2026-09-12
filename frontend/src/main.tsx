import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import { App } from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { WorkspaceProvider } from "./workspace/WorkspaceContext";
import { ExplorationsProvider } from "./explorations/ExplorationsContext";
import { AppStatusProvider } from "./status/AppStatusContext";
import { ThemeProvider } from "./theme/ThemeContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <WorkspaceProvider>
            <ExplorationsProvider>
              <AppStatusProvider>
                <App />
              </AppStatusProvider>
            </ExplorationsProvider>
          </WorkspaceProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
