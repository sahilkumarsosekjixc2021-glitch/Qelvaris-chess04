import { useEffect, useState } from "react";
import { clearAllData, downloadBackup, importAll } from "./storage";
import { LANGS, getLang, setLang, useT } from "./i18n/i18n"; // QV-I18N
import { supabase } from "./lib/supabase"; // QV-GDPR
import CloudBackup from "./features/cloud/CloudBackup"; // QV-CLOUD
import Billing from "./features/billing/Billing"; // QV-BILLING
import { ensureNoActiveSubscription } from "./features/billing/billingApi"; // QV-BILLING
import { bt } from "./features/billing/strings"; // QV-BILLING
import { useAuth } from "./context/AuthContext"; // QV-GDPR
import { computeLeaks, inWindow, loadReviewedGames } from "./leaks";
import { getUsernames, saveUsernames } from "./openingsData";

import {
  BOARD_THEMES,
  DEPTHS,
  LANGUAGES,
  PLANS,
  applyBoardTheme,
  loadSettings,
  saveSetting,
  setSoundEnabled,
} from "./settingsData";
import { FEATURES } from "./features/flags"; // QV-QC
import { CONTACT_EMAIL, FEEDBACK_URL } from "./features/feedback/feedback"; // QV-FEEDBACK
import InstallButton from "./features/pwa/InstallButton"; // QV-PWA
import SupportCard from "./features/support/SupportCard";
import PageLoader, { usePageLoaderDelay } from "./PageLoader";
import { tx } from "./i18n/pages/settings"; // QV-I18N
import "./Settings.css";

const FREE_GAME_LIMIT = 20;

/* Settings khulne par loader kam se kam itni der (ms) dikhega. 0 = sirf real loading tak. */
const MIN_LOADER_MS = 0; // QV-PERF (pehle 1000)

/* On/off switch */
function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`qs-switch ${checked ? "is-on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="qs-switch-knob" />
      <span className="qs-switch-text">{checked ? "On" : "Off"}</span>
    </button>
  );
}

/* Sound on karte hi ek chhoti tik, taaki turant pata chale */
function playPreviewTick() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(990, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
    osc.onended = () => ctx.close();
  } catch {
    // sound na chale to koi baat nahi
  }
}

function Segmented({ options, value, onChange, label }) {
  return (
    <div className="qs-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          role="radio"
          aria-checked={value === o.id}
          className={`qs-seg-btn ${value === o.id ? "is-active" : ""}`}
          onClick={() => onChange(o.id)}
        >
          {o.vars !== undefined && (
            <i
              className="qs-swatch"
              style={{
                "--sw-light": o.vars?.light || "var(--board-light, #ebecd0)",
                "--sw-dark": o.vars?.dark || "var(--board-dark, #739552)",
              }}
            />
          )}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Row({ icon, title, hint, children }) {
  return (
    <div className="qs-row">
      <div className="qs-row-text">
        {icon && <span className="qs-row-icon" aria-hidden="true">{icon}</span>}
        <div>
          <div className="qs-row-title">{title}</div>
          {hint && <div className="qs-hint">{hint}</div>}
        </div>
      </div>
      <div className="qs-row-control">{children}</div>
    </div>
  );
}

export default function Settings() {
  const t = useT();
  const { signOut } = useAuth();
  const [confirmAccount, setConfirmAccount] = useState(false);
  const [values, setValues] = useState(null);
  const minDone = usePageLoaderDelay(MIN_LOADER_MS);
  const [names, setNames] = useState("");
  const [yearly, setYearly] = useState(false);
  const [proAdds, setProAdds] = useState(null);
  const [planMsg, setPlanMsg] = useState("");
  const [dataMsg, setDataMsg] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let alive = true;

    Promise.all([loadSettings(), getUsernames()])
      .then(([loaded, saved]) => {
        if (!alive) return;
        setValues(loaded);
        setNames(saved.join(", "));
      })
      .catch((err) => console.error("Could not load settings:", err));

    // "Pro mein aapke account mein ye aur judega": asli data se
    loadReviewedGames()
      .then((records) => {
        if (!alive) return;
        const leaks = computeLeaks(inWindow(records, 30), records).leaks.length;
        setProAdds({
          moreLeaks: Math.max(0, leaks - 1),
          extraGames: 0,
          reviewed: records.length,
        });
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, []);

  async function change(key, field, value) {
    setValues((prev) => ({ ...prev, [field]: value }));
    try {
      await saveSetting(key, value);
      if (key === "board-theme") applyBoardTheme(value);
      if (key === "sound") {
        setSoundEnabled(value);
        if (value) playPreviewTick();
      }
    } catch (err) {
      console.error("Could not save setting:", err);
    }
  }

  async function onSaveNames() {
    await saveUsernames(names.split(",").map((s) => s.trim()).filter(Boolean));
    setDataMsg(tx("Usernames saved."));
  }

  async function onExport() {
    try {
      await downloadBackup();
      setDataMsg(tx("Backup downloaded."));
    } catch (err) {
      console.error(err);
      setDataMsg(tx("Could not create the backup."));
    }
  }

  async function onImport(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      await importAll(JSON.parse(await file.text()));
      setDataMsg(tx("Backup restored. Reloading the page…"));
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      console.error(err);
      setDataMsg(tx(err?.message || "Could not read this file."));
    }
  }

  async function onDelete() {
    try {
      await clearAllData();
      // Purani localStorage games bhi hatao, warna leaks.js unhe wapas padh lega
      try {
        localStorage.removeItem("qelvarisSavedGames");
      } catch {
        // ignore
      }
      window.location.reload();
    } catch (err) {
      console.error(err);
      setDataMsg(tx("Could not delete your data."));
    }
  }

  // QV-GDPR: account hamesha ke liye delete (Supabase function delete_my_account, sql/delete_my_account.sql)
  async function onDeleteAccount() {
    try {
      await ensureNoActiveSubscription(); // QV-BILLING: never delete an account that is still being charged
      const { error } = await supabase.rpc("delete_my_account");
      if (error) throw error;
      await clearAllData();
      try {
        localStorage.removeItem("qelvarisSavedGames");
      } catch {
        // ignore
      }
      try {
        await signOut();
      } catch {
        // account ja chuka hai, session pehle hi invalid ho sakta hai
      }
      window.location.href = "/";
    } catch (err) {
      console.error(err);
      setDataMsg(/cancel-subscription-first|paypal|payment-provider|http-/.test(String(err?.message || "")) ? bt("delete_blocked") : t("settings.deleteAccount.failed"));
      setConfirmAccount(false);
    }
  }

  if (!values || !minDone) {
    return (
      <PageLoader
        page="settings"
        title={tx("Preparing your settings...")}
        messages={[
          tx("Loading your preferences"),
          tx("Checking your data"),
          tx("Setting up your board"),
        ]}
      />
    );
  }

  return (
    <div className="qs-page">
      <header className="qs-head">
        <span className="qs-kicker">{tx("QELVARIS")}</span>
        <h1>{FEATURES.pricing ? tx("Plans and Settings") : tx("Settings")}</h1>
        <p>{FEATURES.pricing ? tx("Choose your plan and set up the board and sound the way you like.") : tx("Set up the board, sound and language the way you like.")}</p>
      </header>

      {/* ---------- Plans (QV-QC: FEATURES.pricing=false par chhupa hai, delete nahi) ---------- */}
      {FEATURES.pricing && (
      <section className="qs-card">
        <div className="qs-section-head">
          <div>
            <div className="qs-eyebrow">{tx("Plans")}</div>
            <h2>{tx("Choose your plan")}</h2>
          </div>
          <Segmented
            label={tx("Billing")}
            value={yearly ? "yearly" : "monthly"}
            onChange={(id) => setYearly(id === "yearly")}
            options={[{ id: "monthly", label: tx("Monthly") }, { id: "yearly", label: tx("Yearly") }]}
          />
        </div>

        <div className="qs-plans">
          {PLANS.map((plan) => {
            const current = plan.id === "free";
            return (
              <div
                key={plan.id}
                className={`qs-plan qs-plan--${plan.id} ${current ? "is-current" : ""}`}
              >
                <div className="qs-plan-top">
                  <div className="qs-plan-name">{tx(plan.name)}</div>
                  {current && <span className="qs-pill">{tx("Your plan")}</span>}
                </div>
                <div className="qs-price">
                  {yearly ? plan.yearly : plan.monthly}
                  <span> {plan.id === "free" ? tx("forever") : yearly ? tx("per year") : tx("per month")}</span>
                </div>
                <ul className="qs-features">
                  {plan.features.map((f) => (
                    <li key={f}><i aria-hidden="true">✓</i>{tx(f)}</li>
                  ))}
                </ul>
                {!current && (
                  <button
                    className={`qs-btn ${plan.id === "pro" ? "qs-btn--gold" : ""}`}
                    onClick={() => setPlanMsg(tx("Payments are not available yet. You will be able to upgrade here once they are."))}
                  >
                    {plan.id === "pro" ? tx("Upgrade") : tx("See Elite")}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {planMsg && <p className="qs-note" role="status">{planMsg}</p>}

        {proAdds && proAdds.moreLeaks > 0 && (
          <div className="qs-adds">
            <div className="qs-eyebrow">{tx("What Pro would add to your account")}</div>
            <p>
              {proAdds.moreLeaks === 1 ? tx("1 more leak in your report, apart from the top one.") : tx("{n} more leaks in your report, apart from the top one.", { n: proAdds.moreLeaks })}
            </p>
          </div>
        )}

        <p className="qs-hint">{tx("Annual is about 37% cheaper. Founding Member: Pro for ₹999 for the first year (first 100 buyers).")}</p>
      </section>
      )}

      {/* ---------- Settings ---------- */}
      <section className="qs-card">
        <div className="qs-eyebrow">{tx("Settings")}</div>
        <h2>{tx("Preferences")}</h2>

        <Row icon="♟" title={tx("Board theme")} hint={tx("Board colours. Changes apply instantly.")}>
          <Segmented
            label={tx("Board theme")}
            value={values.boardTheme}
            onChange={(id) => change("board-theme", "boardTheme", id)}
            options={BOARD_THEMES.map((o) => ({ ...o, label: tx(o.label) }))}
          />
        </Row>

        <Row icon="♪" title={tx("Sound")} hint={tx("Game sounds (moves, captures) on or off.")}>
          <Switch
            label={tx("Sound")}
            checked={values.sound}
            onChange={(on) => change("sound", "sound", on)}
          />
        </Row>

        <Row icon="🌐" title={t("settings.uiLang.title")} hint={t("settings.uiLang.hint")}>
          <Segmented
            label={t("settings.uiLang.title")}
            value={getLang()}
            onChange={(id) => setLang(id)}
            options={LANGS}
          />
        </Row>

        <Row icon="◎" title={tx("Analysis depth")} hint={tx("Higher depth is more accurate but can be slow on older phones.")}>
          <Segmented
            label={tx("Analysis depth")}
            value={values.depth}
            onChange={(id) => change("analysis-depth", "depth", id)}
            options={DEPTHS.map((d) => ({ id: d, label: String(d) }))}
          />
        </Row>

        <Row icon="@" title={tx("Your usernames")} hint={tx("Used to tell which side you played in your games. Separate several names with commas.")}>
          <div className="qs-form">
            <input value={names} onChange={(e) => setNames(e.target.value)} placeholder={tx("ravi_chess, ravi88")} />
            <button className="qs-btn qs-btn--gold" onClick={onSaveNames}>{tx("Save")}</button>
          </div>
        </Row>
      </section>

      <CloudBackup />

      <Billing />

      {/* ---------- Data ---------- */}
      <section className="qs-card">
        <div className="qs-eyebrow">{tx("Your data")}</div>
        <h2>{tx("Backup and privacy")}</h2>
        <p className="qs-hint">{tx("Your games and progress stay in this browser. You can export or delete them at any time.")}</p>

        <div className="qs-actions">
          <button className="qs-btn" onClick={onExport}>{tx("Export backup")}</button>
          <label className="qs-btn qs-file">
            {tx("Import backup")}<input type="file" accept="application/json,.json" onChange={onImport} hidden />
          </label>

          {!confirmDelete ? (
            <button className="qs-btn qs-btn--danger" onClick={() => setConfirmDelete(true)}>{tx("Delete my data")}</button>
          ) : (
            <span className="qs-confirm">
              {tx("Are you sure? All games, reviews and progress will be removed from this device.")}<button className="qs-btn qs-btn--danger" onClick={onDelete}>{tx("Yes, delete")}</button>
              <button className="qs-btn" onClick={() => setConfirmDelete(false)}>{tx("Cancel")}</button>
            </span>
          )}
        </div>

        <p className="qs-hint" style={{ marginTop: 14 }}>{t("settings.deleteAccount.hint")}</p>
        <div className="qs-actions">
          {!confirmAccount ? (
            <button className="qs-btn qs-btn--danger" onClick={() => setConfirmAccount(true)}>{t("settings.deleteAccount")}</button>
          ) : (
            <span className="qs-confirm">
              {t("settings.deleteAccount.confirm")}
              <button className="qs-btn qs-btn--danger" onClick={onDeleteAccount}>{t("settings.deleteAccount.yes")}</button>
              <button className="qs-btn" onClick={() => setConfirmAccount(false)}>{t("settings.deleteAccount.cancel")}</button>
            </span>
          )}
        </div>

        {dataMsg && <p className="qs-note" role="status">{dataMsg}</p>}
      </section>

      <SupportCard email={CONTACT_EMAIL} />

      {/* ---------- Help and legal (QV-FEEDBACK) ---------- */}
      <section className="qs-card">
        <div className="qs-eyebrow">{tx("Help")}</div>
        <h2>{tx("Feedback and legal")}</h2>
        <p className="qs-hint">{tx("Found a bug or have an idea? Tell us, it takes 2 minutes and shapes what we build next.")}</p>
        <div className="qs-actions">
          <a className="qs-btn qs-btn--gold" href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer">{tx("Give feedback")}</a>
          <a className="qs-btn" href={`mailto:${CONTACT_EMAIL}`}>{tx("Email us")}</a>
          <a className="qs-btn" href="/?page=privacy" target="_blank" rel="noopener noreferrer">{tx("Privacy")}</a>
          <a className="qs-btn" href="/?page=terms" target="_blank" rel="noopener noreferrer">{tx("Terms")}</a>
        </div>
        <InstallButton />
      </section>
    </div>
  );
}