import { Component } from "react";
import { reportError } from "../lib/errorReport";
import { getLang } from "../i18n/i18n";
import { isStaleVersionError, reloadOnceForNewVersion } from "../lib/staleVersion";

const TXT = {
  en: { title: "Something broke on this page", body: "Your games and progress are safe — they are stored on your device and in your cloud backup. We have been told about the problem.", retry: "Try again", reload: "Reload page" },
  es: { title: "Algo falló en esta página", body: "Tus partidas y tu progreso están a salvo: se guardan en tu dispositivo y en tu copia en la nube. Ya nos avisaron del problema.", retry: "Reintentar", reload: "Recargar página" },
  hi: { title: "इस पेज पर कुछ गड़बड़ हो गई", body: "आपके गेम और प्रोग्रेस सुरक्षित हैं — वे आपके डिवाइस और क्लाउड बैकअप में रखे हैं। हमें इस समस्या की जानकारी मिल गई है।", retry: "फिर कोशिश करें", reload: "पेज रीलोड करें" },
};

// Shows a friendly screen instead of a blank page when a component crashes.
// "scope" tells us which part of the app failed (shown in the report, not to the user).
export default class ErrorBoundary extends Component {
  state = { failed: false, nonce: 0 };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    if (isStaleVersionError(error) && reloadOnceForNewVersion()) return; // new deploy: load the new version
    reportError(error, { kind: "react", scope: this.props.scope || "app", component: String(info?.componentStack || "").split("\n")[1]?.trim() });
  }

  retry = () => this.setState((s) => ({ failed: false, nonce: s.nonce + 1 }));

  render() {
    if (!this.state.failed) return <div key={this.state.nonce} style={{ display: "contents" }}>{this.props.children}</div>;
    const small = this.props.compact;
    const T = TXT[getLang()] || TXT.en;
    return (
      <div role="alert" style={{ padding: small ? 16 : 40, textAlign: "center", color: "#e8e6df", background: small ? "transparent" : "#080a0f", minHeight: small ? 0 : "100vh", display: "grid", placeItems: "center" }}>
        <div style={{ maxWidth: 420 }}>
          <h2 style={{ color: "#f7b538", marginBottom: 8 }}>{T.title}</h2>
          <p style={{ opacity: 0.8, marginBottom: 16 }}>
            {T.body}
          </p>
          <button onClick={this.retry} style={{ marginRight: 8, padding: "8px 14px", borderRadius: 8, border: "1px solid #f7b538", background: "transparent", color: "#f7b538", cursor: "pointer" }}>{T.retry}</button>
          <button onClick={() => window.location.reload()} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #444", background: "transparent", color: "#e8e6df", cursor: "pointer" }}>{T.reload}</button>
        </div>
      </div>
    );
  }
}
