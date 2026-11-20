import { useCallback, useEffect, useRef, useState } from "react";
import { getLang } from "../i18n/i18n";
import { registerConfirmHost } from "../lib/confirm";

const TXT = {
  en: { yes: "Yes", no: "Cancel" },
  es: { yes: "Sí", no: "Cancelar" },
  hi: { yes: "हाँ", no: "रद्द करें" },
};

// Mount once near the top of the app. Shows a small modal for askConfirm().
export default function ConfirmHost() {
  const [req, setReq] = useState(null);
  const yesRef = useRef(null);

  useEffect(() => registerConfirmHost((message, opts) => new Promise((resolve) => setReq({ message, opts, resolve }))), []);

  const close = useCallback((answer) => {
    setReq((r) => { r?.resolve(answer); return null; });
  }, []);

  useEffect(() => {
    if (!req) return undefined;
    yesRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") close(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [req, close]);

  if (!req) return null;
  const T = TXT[getLang()] || TXT.en;
  const accent = req.opts.danger ? "#e5534b" : "#f7b538";
  return (
    <div onClick={() => close(false)} style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,.6)", display: "grid", placeItems: "center", padding: 16 }}>
      <div role="alertdialog" aria-modal="true" aria-label={req.message} onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 380, width: "100%", background: "#10131a", color: "#e8e6df", border: "1px solid #2a3040", borderRadius: 14, padding: 20, boxShadow: "0 20px 60px rgba(0,0,0,.5)" }}>
        <p style={{ margin: "0 0 18px", lineHeight: 1.5 }}>{req.message}</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={() => close(false)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #444", background: "transparent", color: "#e8e6df", cursor: "pointer" }}>{T.no}</button>
          <button ref={yesRef} onClick={() => close(true)} style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${accent}`, background: accent, color: "#080a0f", fontWeight: 600, cursor: "pointer" }}>{T.yes}</button>
        </div>
      </div>
    </div>
  );
}
