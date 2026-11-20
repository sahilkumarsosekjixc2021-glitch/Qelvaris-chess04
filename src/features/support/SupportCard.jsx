import { useState } from "react";
import { getLang, useT } from "../../i18n/i18n";
import D from "./support.dict";
import { mailtoLink } from "./supportCore";
import { collectDiagnostics, refreshAppFiles } from "./diagnostics";

export default function SupportCard({ email, page = "settings" }) {
  useT();
  const T = D[getLang()] || D.en;
  const [msg, setMsg] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function copy() {
    const { text: report } = await collectDiagnostics(page);
    setText(report);
    try { await navigator.clipboard.writeText(report); setMsg(T.copied); } catch { setMsg(T.copy_failed); }
  }
  async function mail() {
    const { text: report } = await collectDiagnostics(page);
    window.location.href = mailtoLink(email, "Qelvaris support", report);
  }
  async function fix() { setBusy(true); await refreshAppFiles(); }

  return (
    <section className="qs-card" id="support">
      <div className="qs-eyebrow">{T.title}</div>
      <p className="qs-hint">{T.hint}</p>
      <div className="qs-actions">
        <button className="qs-btn qs-btn--gold" onClick={fix} disabled={busy}>{busy ? T.fixing : T.fix}</button>
        <button className="qs-btn" onClick={copy}>{T.diag}</button>
        <button className="qs-btn" onClick={mail}>{T.email}</button>
      </div>
      <p className="qs-hint">{T.fix_hint}</p>
      {msg && <p className="qs-note" role="status">{msg}</p>}
      {text && <textarea readOnly value={text} rows={8} style={{ width: "100%", fontFamily: "monospace", fontSize: 12 }} onFocus={(e) => e.target.select()} />}
      <h3>{T.faq_title}</h3>
      {T.faq.map((f) => (
        <details key={f.q} style={{ margin: "6px 0" }}>
          <summary>{f.q}</summary>
          <p className="qs-hint">{f.a}</p>
        </details>
      ))}
    </section>
  );
}
