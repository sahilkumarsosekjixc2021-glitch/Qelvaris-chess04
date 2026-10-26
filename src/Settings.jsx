import { useEffect, useState } from "react";
import { clearAllData, downloadBackup, importAll } from "./storage";
import { computeLeaks, inWindow, loadReviewedGames } from "./leaks";
import { getUsernames, saveUsernames } from "./openingsData";
import { BOARD_THEMES, DEPTHS, LANGUAGES, PLANS, applyBoardTheme, loadSettings, saveSetting } from "./settingsData";
import "./Settings.css";

const FREE_GAME_LIMIT = 20;

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
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Row({ title, hint, children }) {
  return (
    <div className="qs-row">
      <div>
        <div className="qs-row-title">{title}</div>
        {hint && <div className="qs-hint">{hint}</div>}
      </div>
      <div className="qs-row-control">{children}</div>
    </div>
  );
}

export default function Settings() {
  const [values, setValues] = useState(null);
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
    } catch (err) {
      console.error("Could not save setting:", err);
    }
  }

  async function onSaveNames() {
    await saveUsernames(names.split(",").map((s) => s.trim()).filter(Boolean));
    setDataMsg("Usernames save ho gaye.");
  }

  async function onExport() {
    try {
      await downloadBackup();
      setDataMsg("Backup download ho gaya.");
    } catch (err) {
      console.error(err);
      setDataMsg("Backup nahi ban paya.");
    }
  }

  async function onImport(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      await importAll(JSON.parse(await file.text()));
      setDataMsg("Backup wapas aa gaya. Page reload ho raha hai…");
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      console.error(err);
      setDataMsg(err?.message || "Ye file padhi nahi ja saki.");
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
      setDataMsg("Data delete nahi ho paya.");
    }
  }

  if (!values) return <div className="qs-page"><p className="qs-hint">Loading…</p></div>;

  return (
    <div className="qs-page">
      <h2 className="qs-title">Plans and Settings</h2>

      <section className="qs-section">
        <div className="qs-section-head">
          <div className="qs-eyebrow">Plans</div>
          <Segmented
            label="Billing"
            value={yearly ? "yearly" : "monthly"}
            onChange={(id) => setYearly(id === "yearly")}
            options={[{ id: "monthly", label: "Monthly" }, { id: "yearly", label: "Yearly" }]}
          />
        </div>

        <div className="qs-plans">
          {PLANS.map((plan) => {
            const current = plan.id === "free";
            return (
              <div key={plan.id} className={`qs-plan ${current ? "is-current" : ""}`}>
                <div className="qs-plan-name">{plan.name}</div>
                <div className="qs-price">
                  {yearly ? plan.yearly : plan.monthly}
                  <span> {plan.id === "free" ? "forever" : yearly ? "per year" : "per month"}</span>
                </div>
                <ul className="qs-features">
                  {plan.features.map((f) => (
                    <li key={f}>✓ {f}</li>
                  ))}
                </ul>
                {current ? (
                  <span className="qs-pill">Your plan</span>
                ) : (
                  <button
                    className="qs-btn"
                    onClick={() => setPlanMsg("Payments abhi shuru nahi hue. Jaise hi hue, yahin se upgrade kar paoge.")}
                  >
                    {plan.id === "pro" ? "Upgrade" : "See Elite"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {planMsg && <p className="qs-hint" role="status">{planMsg}</p>}

        {proAdds && proAdds.moreLeaks > 0 && (
          <div className="qs-adds">
            <div className="qs-eyebrow">What Pro would add to your account</div>
            <p>
              {proAdds.moreLeaks} more leak{proAdds.moreLeaks === 1 ? "" : "s"} in your report, apart from the top one.
            </p>
          </div>
        )}

        <p className="qs-hint">Annual is about 37% cheaper. Founding Member: Pro for ₹999 for the first year (first 100 buyers).</p>
      </section>

      <section className="qs-section">
        <div className="qs-eyebrow">Settings</div>

        <Row title="Board theme">
          <Segmented
            label="Board theme"
            value={values.boardTheme}
            onChange={(id) => change("board-theme", "boardTheme", id)}
            options={BOARD_THEMES}
          />
        </Row>

        <Row title="Language" hint="Turning point ki wajah is bhasha mein dikhegi.">
          <Segmented
            label="Language"
            value={values.language}
            onChange={(id) => change("language", "language", id)}
            options={LANGUAGES}
          />
        </Row>

        <Row title="Analysis depth" hint="Zyada depth sahi hai par slow phone par dheema chalta hai.">
          <Segmented
            label="Analysis depth"
            value={values.depth}
            onChange={(id) => change("analysis-depth", "depth", id)}
            options={DEPTHS.map((d) => ({ id: d, label: String(d) }))}
          />
        </Row>

        <Row title="Your usernames" hint="Openings aur leaks ko pata chalta hai ki game mein aap kaun the. Comma se alag karo.">
          <div className="qs-form">
            <input value={names} onChange={(e) => setNames(e.target.value)} placeholder="ravi_chess, ravi88" />
            <button className="qs-btn" onClick={onSaveNames}>Save</button>
          </div>
        </Row>
      </section>

      <section className="qs-section">
        <div className="qs-eyebrow">Your data</div>
        <p className="qs-hint">Aapka data aapke browser mein hi rehta hai. Kabhi bhi export ya delete kar sakte ho.</p>

        <div className="qs-actions">
          <button className="qs-btn" onClick={onExport}>Export backup</button>
          <label className="qs-btn qs-file">
            Import backup
            <input type="file" accept="application/json,.json" onChange={onImport} hidden />
          </label>

          {!confirmDelete ? (
            <button className="qs-btn qs-btn--danger" onClick={() => setConfirmDelete(true)}>Delete my data</button>
          ) : (
            <span className="qs-confirm">
              Pakka? Saari games, reviews aur progress hat jayengi.
              <button className="qs-btn qs-btn--danger" onClick={onDelete}>Haan, delete karo</button>
              <button className="qs-btn" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </span>
          )}
        </div>

        {dataMsg && <p className="qs-hint" role="status">{dataMsg}</p>}
      </section>
    </div>
  );
}