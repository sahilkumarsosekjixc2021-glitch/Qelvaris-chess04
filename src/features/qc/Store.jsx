// QV-QC: Store page: balance, missions, shop, history. Sab QC se; koi paisa nahi.
import { useCallback, useEffect, useState } from "react";
import { buyItem, claimWeekly, equipBadge, loadMissions } from "./qcStore";
import { useWallet } from "./QcChip";
import { ITEMS, MAX_BOUGHT_FREEZES, STEP_REWARD, PERFECT_BONUS } from "./qcCore";
import { loadStreak } from "../../todayData";
import { celebrate } from "../celebrate/celebrate"; // QV-CELEBRATE
import { track } from "../telemetry/track"; // QV-TRACK
import "./qc.css";
import { tx } from "../../i18n/pages/store"; // QV-I18N

function go(page) {
  window.dispatchEvent(new CustomEvent("qelvaris-navigate", { detail: page }));
}

export default function Store() {
  const { wallet } = useWallet();
  const [missions, setMissions] = useState(null);
  const [msg, setMsg] = useState(null); // { text, error }

  const refreshMissions = useCallback(() => {
    loadMissions()
      .then(setMissions)
      .catch((e) => console.error("Missions load failed:", e));
  }, []);

  useEffect(() => {
    refreshMissions();
    window.addEventListener("qelvaris-qc-changed", refreshMissions);
    window.addEventListener("qelvaris-streak-changed", refreshMissions);
    return () => {
      window.removeEventListener("qelvaris-qc-changed", refreshMissions);
      window.removeEventListener("qelvaris-streak-changed", refreshMissions);
    };
  }, [refreshMissions]);

  async function onBuy(item) {
    const res = await buyItem(item.id);
    if (!res.ok) {
      setMsg({ text: res.error, error: true });
      return;
    }
    setMsg({ text: `${item.name} added.`, error: false });
    track("store_buy", { item: item.id });
    celebrate({ kind: "purchase", title: `${item.name} unlocked`, sub: item.kind === "freeze" ? "Your streak is safer now." : "Equip it from the Store." });
    if (item.kind === "freeze") {
      // streak badge/Today ko naya freeze count dikhao
      loadStreak()
        .then((s) => window.dispatchEvent(new CustomEvent("qelvaris-streak-changed", { detail: s })))
        .catch(() => {});
    }
  }

  async function onClaim(id) {
    const got = await claimWeekly(id);
    setMsg(got ? { text: `+${got} QC claimed.`, error: false } : { text: "Nothing to claim yet.", error: true });
    if (got) celebrate({ kind: "claim", title: "Weekly mission complete", sub: "Reward added to your balance.", qc: got });
  }

  if (!wallet) return <div style={{ minHeight: "55vh" }} role="status" />;

  const inv = wallet.inv;

  return (
    <div className="qq-page">
      <header className="qq-head">
        <div>
          <span className="qq-kicker">{tx("QELVARIS")}</span>
          <h1>{tx("Credits and Store")}</h1>
          <p>{tx("Earn QC by training. Spend it on streak freezes and badges.")}</p>
        </div>
        <div className="qq-balance">
          <strong>{wallet.balance}</strong>
          <span>{tx("QC BALANCE")}</span>
        </div>
      </header>

      {msg && (
        <p className={`qq-note ${msg.error ? "is-error" : ""}`} role="status">
          {msg.text}
        </p>
      )}

      <section className="qq-card">
        <div className="qq-eyebrow">{tx("Missions")}</div>
        <h2>{tx("Today")}</h2>
        <p className="qq-hint">
          {tx("Each daily step earns {a} QC, plus {b} QC when you finish them all. Streak milestones pay extra.", { a: STEP_REWARD, b: PERFECT_BONUS })}
        </p>
        <ul className="qq-list">
          {(missions?.daily || []).map((m) => (
            <li key={m.id} className={`qq-row ${m.done ? "is-done" : ""}`}>
              <div className="qq-row-main">
                <span className="qq-tick" aria-hidden="true">✓</span>
                <div className="qq-row-title">{tx(m.title)}</div>
              </div>
              {m.done ? (
                <span className="qq-reward">{tx("+{n} QC earned", { n: STEP_REWARD })}</span>
              ) : (
                <button className="qq-btn" onClick={() => go(m.goTo)}>
                  {tx("Go to {page}", { page: tx(m.goTo) })}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="qq-card">
        <div className="qq-eyebrow">{tx("Missions")}</div>
        <h2>{tx("This week")}</h2>
        <ul className="qq-list">
          {(missions?.weekly || []).map((m) => (
            <li key={m.id} className={`qq-row ${m.claimed ? "is-done" : ""}`}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="qq-row-title">{m.title}</div>
                <div className="qq-row-sub">
                  {m.value} / {m.target} · +{m.reward} QC
                </div>
                <div className="qq-bar">
                  <i style={{ width: `${(m.value / m.target) * 100}%` }} />
                </div>
              </div>
              {m.claimed ? (
                <span className="qq-reward">{tx("Claimed")}</span>
              ) : (
                <button className="qq-btn qq-btn--gold" disabled={!m.ready} onClick={() => onClaim(m.id)}>
                  {tx("Claim")}</button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="qq-card">
        <div className="qq-eyebrow">{tx("Store")}</div>
        <h2>{tx("Spend your QC")}</h2>
        <div className="qq-shop">
          {ITEMS.map((item) => {
            const owned = item.kind === "badge" && inv.badges.includes(item.id);
            const equipped = inv.equipped === item.id;
            const maxed = item.kind === "freeze" && inv.freezes >= MAX_BOUGHT_FREEZES;
            return (
              <div key={item.id} className={`qq-item ${equipped ? "is-equipped" : ""}`}>
                <span className="qq-glyph" aria-hidden="true">{item.glyph}</span>
                <div className="qq-item-name">{item.name}</div>
                <div className="qq-item-blurb">
                  {item.blurb}
                  {item.kind === "freeze" ? ` You own ${inv.freezes}.` : ""}
                </div>
                {owned ? (
                  <button className="qq-btn" onClick={() => equipBadge(equipped ? null : item.id)}>
                    {equipped ? tx("Unequip") : tx("Equip")}
                  </button>
                ) : (
                  <>
                    <div className="qq-price">{item.price} QC</div>
                    <button
                      className="qq-btn qq-btn--gold"
                      disabled={maxed || wallet.balance < item.price}
                      onClick={() => onBuy(item)}
                    >
                      {maxed ? tx("Max owned") : tx("Buy")}
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="qq-card">
        <div className="qq-eyebrow">{tx("History")}</div>
        <h2>{tx("Recent activity")}</h2>
        {wallet.ledger.length === 0 ? (
          <p className="qq-hint">{tx("Nothing yet. Finish one daily step to earn your first {n} QC.", { n: STEP_REWARD })}</p>
        ) : (
          wallet.ledger.slice(0, 12).map((e, i) => (
            <div key={`${e.t}-${i}`} className="qq-ledger-row">
              <span>{tx(e.reason)}</span>
              <span className={e.amount > 0 ? "qq-plus" : "qq-minus"}>
                {e.amount > 0 ? `+${e.amount}` : e.amount}
              </span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
