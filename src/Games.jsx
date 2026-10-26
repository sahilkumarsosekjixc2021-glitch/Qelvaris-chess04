import { useCallback, useEffect, useMemo, useState } from "react";
import { FILTERS, importPgnText, loadGames } from "./gamesData";
import { setSetting } from "./storage";
import "./Games.css";

const PAGE_SIZE = 50;

function go(page, extra = {}) {
  window.dispatchEvent(new CustomEvent("qelvaris-navigate", { detail: { page, ...extra } }));
}

function openGame(row) {
  // Review page ye "selected-game" setting padh sakta hai (Step C mein jodenge)
  setSetting("selected-game", row.id).catch(() => {});
  go("Review", { gameId: row.id });
}

function LeaksCell({ row }) {
  if (!row.reviewed) return <span className="qg-muted">Not reviewed</span>;
  if (row.leaks === null) return <span className="qg-muted">–</span>;
  if (row.leaks.length === 0) return <span className="qg-tag qg-tag--clean">Clean</span>;
  return (
    <span className="qg-tags">
      {row.leaks.slice(0, 2).map((name) => (
        <span key={name} className="qg-tag">{name}</span>
      ))}
      {row.leaks.length > 2 && <span className="qg-muted">+{row.leaks.length - 2}</span>}
    </span>
  );
}

export default function Games() {
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState("all");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      setRows(await loadGames());
    } catch (err) {
      console.error("Could not load games:", err);
      setError("Games load nahi ho payi. Page refresh karke dekho.");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const counts = useMemo(() => {
    const c = { all: 0, lichess: 0, chesscom: 0, bot: 0, pgn: 0, unreviewed: 0 };
    for (const r of rows || []) {
      c.all += 1;
      if (c[r.sourceKey] !== undefined) c[r.sourceKey] += 1;
      if (!r.reviewed) c.unreviewed += 1;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    if (filter === "all") return rows;
    if (filter === "unreviewed") return rows.filter((r) => !r.reviewed);
    return rows.filter((r) => r.sourceKey === filter);
  }, [rows, filter]);

  async function runImport(text) {
    setMessage("");
    const result = await importPgnText(text);
    const parts = [];
    if (result.added) parts.push(`${result.added} game add hui`);
    if (result.skipped) parts.push(`${result.skipped} pehle se thi`);
    if (result.failed) parts.push(`${result.failed} padh nahi payi`);
    setMessage(parts.length ? parts.join(", ") + "." : "Koi game nahi mili. PGN theek se paste ki?");
    if (result.added) await refresh();
  }

  async function onFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      await runImport(await file.text());
    } catch (err) {
      console.error(err);
      setMessage("File padh nahi payi.");
    }
  }

  async function onPaste() {
    await runImport(pasteText);
    setPasteText("");
    setPasteOpen(false);
  }

  if (error) return <div className="qg-page"><p className="qg-muted">{error}</p></div>;
  if (!rows) return <div className="qg-page"><p className="qg-muted">Loading…</p></div>;

  return (
    <div className="qg-page">
      <div className="qg-head">
        <h2 className="qg-title">Games</h2>
        <button className="qg-btn" onClick={() => go("Connect")}>+ Add games from Lichess / Chess.com</button>
      </div>

      <div className="qg-filters" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            className={`qg-chip ${filter === f.id ? "is-active" : ""}`}
            onClick={() => {
              setFilter(f.id);
              setVisible(PAGE_SIZE);
            }}
          >
            {f.label} <span className="qg-chip-n">{counts[f.id]}</span>
          </button>
        ))}
      </div>

      <div className="qg-layout">
        <section className="qg-card qg-table-wrap">
          {filtered.length === 0 ? (
            <p className="qg-empty">
              {rows.length === 0 ? "Abhi koi game nahi hai. Connect se games lao ya PGN import karo." : "Is filter mein koi game nahi."}
            </p>
          ) : (
            <>
              <table className="qg-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Date</th>
                    <th>Players</th>
                    <th>Result</th>
                    <th>Opening</th>
                    <th>Acc.</th>
                    <th>Leaks found</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, visible).map((row) => (
                    <tr key={row.id}>
                      <td>{row.sourceLabel}</td>
                      <td>{row.dateLabel}</td>
                      <td>{row.players}</td>
                      <td>{row.result}</td>
                      <td className="qg-clip">{row.opening}</td>
                      <td>{row.accuracy !== null ? row.accuracy.toFixed(1) : "–"}</td>
                      <td><LeaksCell row={row} /></td>
                      <td>
                        <button className="qg-btn qg-btn--small" onClick={() => openGame(row)}>
                          {row.reviewed ? "Open" : "Review"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filtered.length > visible && (
                <button className="qg-btn qg-more" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                  Show more ({filtered.length - visible} baaki)
                </button>
              )}
            </>
          )}
        </section>

        <aside className="qg-side">
          <section className="qg-card">
            <div className="qg-eyebrow">Connected sources</div>
            <ul className="qg-sources">
              <li><span>Lichess</span><span className="qg-muted">{counts.lichess} games</span></li>
              <li><span>Chess.com</span><span className="qg-muted">{counts.chesscom} games</span></li>
            </ul>
            <p className="qg-note">Daily auto-sync Pro mein aayega (backend ke baad).</p>
          </section>

          <section className="qg-card">
            <div className="qg-eyebrow">Import a game</div>
            <div className="qg-import">
              <label className="qg-btn qg-file">
                Choose PGN file
                <input type="file" accept=".pgn,.txt,text/plain" onChange={onFile} hidden />
              </label>
              <button className="qg-btn" onClick={() => setPasteOpen((open) => !open)}>
                Paste PGN
              </button>
            </div>

            {pasteOpen && (
              <div className="qg-paste">
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Yahan PGN paste karo (ek ya zyada games)"
                  rows={6}
                />
                <button className="qg-btn qg-btn--primary" onClick={onPaste} disabled={!pasteText.trim()}>
                  Import
                </button>
              </div>
            )}

            {message && <p className="qg-note" role="status">{message}</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}
