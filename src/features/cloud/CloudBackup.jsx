import { useCallback, useEffect, useState } from "react";
import { useT } from "../../i18n/i18n";
import {
  getCloudInfo, getLocalStatus, pushBackup, previewRestore, restoreBackup,
  getAutoBackup, setAutoBackup, requestPersistentStorage,
} from "./cloud";
import { ct } from "./strings";

function errKey(e) {
  const m = String(e?.message || "");
  if (m === "not-signed-in") return "err_not";
  if (m === "too-big") return "err_big";
  if (m === "no-backup") return "err_none";
  if (m === "needs-setup") return "err_setup";
  return "err_gen";
}

export default function CloudBackup() {
  useT();
  const [info, setInfo] = useState(undefined); // undefined = loading, null = none
  const [local, setLocal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [conflict, setConflict] = useState(false);
  const [preview, setPreview] = useState(null);
  const [auto, setAuto] = useState(false);
  const [persist, setPersist] = useState("");

  const load = useCallback(() => {
    getCloudInfo().then(setInfo).catch((e) => { console.error("Cloud info failed:", e); setInfo(null); setMsg(ct(errKey(e))); });
    getLocalStatus().then(setLocal).catch(() => setLocal(null));
  }, []);
  useEffect(() => {
    load();
    getAutoBackup().then(setAuto);
    requestPersistentStorage().then(setPersist);
  }, [load]);

  async function onPush(force = false) {
    setBusy(true); setMsg(""); setConflict(false);
    try {
      const r = await pushBackup({ force });
      setMsg(ct("pushed", { games: r.summary.games, reviews: r.summary.reviews }));
      load();
    } catch (e) {
      if (e?.message === "conflict") setConflict(true);
      else { console.error("Cloud backup failed:", e); setMsg(ct(errKey(e))); }
    } finally { setBusy(false); }
  }

  async function onPreview() {
    setBusy(true); setMsg(""); setConflict(false);
    try { setPreview(await previewRestore()); }
    catch (e) { console.error("Cloud preview failed:", e); setMsg(ct(errKey(e))); }
    finally { setBusy(false); }
  }

  async function onRestore(mode) {
    setBusy(true); setMsg("");
    try {
      await restoreBackup(preview, mode);
      setPreview(null);
      setMsg(ct("pulled"));
      setTimeout(() => window.location.reload(), 800);
    } catch (e) { console.error("Cloud restore failed:", e); setMsg(ct(errKey(e))); setBusy(false); }
  }

  async function onAuto(e) {
    const on = e.target.checked;
    setAuto(on);
    await setAutoBackup(on);
  }

  const when = (iso) => new Date(iso).toLocaleString();

  return (
    <section className="qs-card">
      <div className="qs-eyebrow">{ct("title")}</div>
      <h2>{ct("title")}</h2>
      <p className="qs-hint">{ct("hint")}</p>
      <p className="qs-hint">{ct("includes")}</p>
      <p className="qs-hint">
        {info ? ct("last", { when: when(info.updatedAt), kb: Math.max(1, Math.round(info.size / 1024)) }) : info === null ? ct("never") : ct("busy")}
      </p>
      {local && (
        <>
          <p className="qs-hint">{ct("here", local.summary)}</p>
          <p className="qs-hint" role="status"><strong>{local.changed ? ct("state_changed") : ct("state_ok")}</strong></p>
        </>
      )}

      {!preview && (
        <div className="qs-actions">
          <button className="qs-btn" onClick={() => onPush(false)} disabled={busy}>{busy ? ct("busy") : ct("push")}</button>
          <button className="qs-btn" onClick={onPreview} disabled={busy || !info}>{ct("pull")}</button>
        </div>
      )}

      {conflict && (
        <div role="alert" className="qs-hint">
          <p><strong>{ct("conflict_title")}</strong></p>
          <p>{ct("conflict_body")}</p>
          <div className="qs-actions">
            <button className="qs-btn" onClick={onPreview} disabled={busy}>{ct("pull")}</button>
            <button className="qs-btn" onClick={() => onPush(true)} disabled={busy}>{ct("overwrite")}</button>
            <button className="qs-btn" onClick={() => setConflict(false)}>{ct("cancel")}</button>
          </div>
        </div>
      )}

      {preview && (
        <div className="qs-hint">
          <p><strong>{ct("restore_title")}</strong></p>
          <p>{ct("cloud_has", { when: when(preview.updatedAt), ...preview.cloud })}</p>
          <p>{ct("device_has", preview.local)}</p>
          <div className="qs-actions" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <button className="qs-btn" onClick={() => onRestore("merge")} disabled={busy}>
              {ct("mode_merge")} {preview.recommended === "merge" ? `· ${ct("recommended")}` : ""}
            </button>
            <span className="qs-hint">{ct("mode_merge_hint")}</span>
            <button className="qs-btn" onClick={() => onRestore("replace")} disabled={busy}>
              {ct("mode_replace")} {preview.recommended === "replace" ? `· ${ct("recommended")}` : ""}
            </button>
            <span className="qs-hint">{ct("mode_replace_hint")}</span>
            <button className="qs-btn" onClick={() => setPreview(null)} disabled={busy}>{ct("cancel")}</button>
          </div>
        </div>
      )}

      <label className="qs-hint" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
        <input type="checkbox" checked={auto} onChange={onAuto} /> {ct("auto")}
      </label>
      {persist === "granted" && <p className="qs-hint">{ct("persist_granted")}</p>}
      {persist === "denied" && <p className="qs-hint">{ct("persist_denied")}</p>}
      {msg && <p className="qs-hint" role="status">{msg}</p>}
    </section>
  );
}
