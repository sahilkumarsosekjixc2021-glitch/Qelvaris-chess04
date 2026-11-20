// QV-QC: topbar ka QC chip. Click par Store khulta hai. Reward milne par "+10" upar uthta hai.
import { tx } from "../../i18n/pages/misc"; // QV-I18N
import { useEffect, useState } from "react";
import { loadWallet } from "./qcStore";
import { badgeGlyph } from "./qcCore";
import "./qc.css";

export function useWallet() {
  const [wallet, setWallet] = useState(null);
  const [lastDelta, setLastDelta] = useState(0);

  useEffect(() => {
    let alive = true;
    const refresh = () =>
      loadWallet()
        .then((w) => alive && setWallet(w))
        .catch((e) => console.error("Wallet load failed:", e));

    refresh();
    const onChange = (e) => {
      if (e.detail && e.detail.delta) setLastDelta(e.detail.delta);
      refresh();
    };
    window.addEventListener("qelvaris-qc-changed", onChange);
    window.addEventListener("focus", refresh);
    return () => {
      alive = false;
      window.removeEventListener("qelvaris-qc-changed", onChange);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  return { wallet, lastDelta };
}

export default function QcChip({ onClick }) {
  const { wallet, lastDelta } = useWallet();
  const [pop, setPop] = useState(null);

  useEffect(() => {
    if (!lastDelta) return undefined;
    setPop(lastDelta);
    const t = setTimeout(() => setPop(null), 1800);
    return () => clearTimeout(t);
  }, [lastDelta, wallet?.balance]);

  if (!wallet) return null;
  const glyph = badgeGlyph(wallet.inv?.equipped);

  return (
    <button
      type="button"
      className="qc-chip"
      onClick={onClick}
      title={tx("Your Qelvaris Credits. Open the Store.")}
      aria-label={`${wallet.balance} Qelvaris Credits. Open the Store.`}
    >
      {glyph && <span className="qc-chip-badge" aria-hidden="true">{glyph}</span>}
      <span className="qc-chip-coin" aria-hidden="true">◆</span>
      <span className="qc-chip-n">{wallet.balance}</span>
      <span className="qc-chip-unit">{tx("QC")}</span>
      {pop ? (
        <span className={`qc-pop ${pop < 0 ? "is-neg" : ""}`} aria-hidden="true">
          {pop > 0 ? `+${pop}` : pop}
        </span>
      ) : null}
    </button>
  );
}
