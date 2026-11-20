import { AuthProvider, useAuth } from "../context/AuthContext";
import AuthPage from "./AuthPage";
import App from "../App";
import { CONFIG_PROBLEM } from "../lib/supabase";

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#080a0f",
          color: "#f7b538",
          fontSize: "14px",
        }}
      >
        Loading Qelvaris...
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return <App />;
}

export default function RootApp() {
  if (CONFIG_PROBLEM) {
    return (
      <div role="alert" style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#080a0f", color: "#e8e6df", padding: 24, textAlign: "center" }}>
        <div style={{ maxWidth: 480 }}>
          <h2 style={{ color: "#f7b538" }}>Qelvaris is not configured</h2>
          <p style={{ opacity: 0.85 }}>{CONFIG_PROBLEM}</p>
        </div>
      </div>
    );
  }
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}