import { Component, ErrorInfo, ReactNode, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { isSupabaseConfigured } from "./lib/supabase";
import "./index.css";

// Catch render-time errors so the app never shows a blank white screen.
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App crashed:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", background: "#020617", color: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "system-ui, sans-serif" }}>
          <div style={{ maxWidth: 560, border: "1px solid #1e293b", borderRadius: 16, padding: 24, background: "#0f172a" }}>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "#f87171", marginBottom: 8 }}>Something went wrong</h1>
            <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
              The dashboard hit an unexpected error while loading. This often means the
              Supabase environment variables (<code>VITE_SUPABASE_URL</code> /
              <code> VITE_SUPABASE_ANON_KEY</code>) were not provided at build time.
            </p>
            <pre style={{ marginTop: 12, fontSize: 11, color: "#f87171", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {String(this.state.error?.message || this.state.error)}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function ConfigBanner() {
  if (isSupabaseConfigured) return null;
  return (
    <div style={{ background: "#7f1d1d", color: "#fee2e2", padding: "8px 16px", fontSize: 12, fontFamily: "monospace", textAlign: "center" }}>
      ⚠️ Supabase is not configured: set <strong>VITE_SUPABASE_URL</strong> and{" "}
      <strong>VITE_SUPABASE_ANON_KEY</strong> as build environment variables, then redeploy.
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ConfigBanner />
      <App />
    </ErrorBoundary>
  </StrictMode>
);
