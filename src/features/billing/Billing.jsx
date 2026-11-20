import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "../../i18n/i18n";
import { BILLING_ENABLED, PRICE_LABEL, getMySubscription, isEntitled, startCheckout, cancelSubscription, loadPayPalSdk } from "./billingApi";
import { bt } from "./strings";
import { reportError } from "../../lib/errorReport";
import { askConfirm } from "../../lib/confirm";

function errKey(e) {
  const m = String(e?.message || "");
  if (m === "already-subscribed") return "err_already";
  if (m === "rate-limited") return "err_rate";
  if (m === "paypal-sdk-blocked" || m === "paypal-sdk-missing") return "err_blocked";
  return "err_gen";
}

export default function Billing() {
  useT();
  const [sub, setSub] = useState(undefined);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const btnRef = useRef(null);
  const timer = useRef(null);

  const load = useCallback(async () => {
    try { const s = await getMySubscription(); setSub(s); return s; }
    catch (e) { reportError(e, { kind: "billing-load" }); setSub(null); return null; }
  }, []);

  useEffect(() => { if (BILLING_ENABLED) load(); return () => clearTimeout(timer.current); }, [load]);

  // The webhook is the source of truth, so after PayPal approves we poll our own database for up to ~45 s.
  const waitForActivation = useCallback(() => {
    setWaiting(true); setMsg(bt("activating"));
    let tries = 0;
    const tick = async () => {
      const s = await load();
      if (isEntitled(s)) { setWaiting(false); setMsg(bt("activated")); return; }
      if (++tries >= 15) { setWaiting(false); setMsg(bt("still_pending")); return; }
      timer.current = setTimeout(tick, 3000);
    };
    tick();
  }, [load]);

  const entitled = isEntitled(sub);
  const showButtons = BILLING_ENABLED && sub !== undefined && !entitled && !waiting && !(sub && sub.status === "suspended");

  useEffect(() => {
    if (!showButtons || !btnRef.current) return undefined;
    let buttons;
    let gone = false;
    loadPayPalSdk()
      .then((paypal) => {
        if (gone || !btnRef.current) return;
        buttons = paypal.Buttons({
          style: { layout: "vertical", shape: "rect", label: "subscribe" },
          createSubscription: async () => { setMsg(""); return (await startCheckout()).id; },
          onApprove: () => waitForActivation(),
          onError: (e) => { reportError(e, { kind: "paypal-button" }); setMsg(bt(errKey(e))); },
        });
        buttons.render(btnRef.current);
      })
      .catch((e) => { setMsg(bt(errKey(e))); });
    return () => { gone = true; try { buttons?.close(); } catch { /* already closed */ } };
  }, [showButtons, waitForActivation]);

  if (!BILLING_ENABLED) return null;

  async function onCancel() {
    if (!(await askConfirm(bt("cancel_confirm"), { danger: true }))) return;
    setBusy(true); setMsg("");
    try { await cancelSubscription(); setMsg(bt("cancelled")); await load(); }
    catch (e) { reportError(e, { kind: "billing-cancel" }); setMsg(bt("err_cancel")); }
    finally { setBusy(false); }
  }

  const until = sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : "";
  let status = null;
  if (sub === undefined) status = bt("loading");
  else if (sub?.status === "active") status = until ? bt("active_until", { when: until }) : bt("active");
  else if (sub?.status === "cancelled" && entitled) status = bt("cancelled_until", { when: until });
  else if (sub?.status === "suspended") status = bt("suspended");
  else if (sub?.status === "refunded") status = bt("refunded");
  else if (sub?.status === "pending" && waiting) status = bt("pending");

  return (
    <section className="qs-card">
      <div className="qs-eyebrow">{bt("title")}</div>
      <h2>{bt("title")}{PRICE_LABEL ? ` · ${PRICE_LABEL}` : ""}</h2>
      <p className="qs-hint">{bt("hint")}</p>
      {status && <p className="qs-hint" role="status"><strong>{status}</strong></p>}
      {showButtons && <div ref={btnRef} style={{ maxWidth: 320, marginTop: 8 }} />}
      {(sub?.status === "active" || sub?.status === "suspended") && (
        <div className="qs-actions"><button className="qs-btn" onClick={onCancel} disabled={busy}>{bt("cancel")}</button></div>
      )}
      <p className="qs-hint">{bt("cancel_hint")}</p>
      {msg && <p className="qs-hint" role="status">{msg}</p>}
    </section>
  );
}
