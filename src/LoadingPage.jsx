import { tx } from "./i18n/pages/misc"; // QV-I18N
import pawnImg from "./assets/pawn-loading.webp";
import "./LoadingPage.css";

/**
 * progress   : number 0-100, or null for an indeterminate bar
 * statusText : small line under the bar
 * pawnImgSrc : optional override of the artwork
 */
export default function LoadingPage({
  progress = null,
  statusText = "Preparing opening academy…",
  pawnImgSrc = pawnImg,
}) {
  const known = progress !== null;
  const pct = known ? Math.min(100, Math.max(0, progress)) : 0;

  return (
    <div className="ql-screen" role="status" aria-live="polite" aria-label={tx("Loading")}>
      <div className="ql-art">
        <img className="ql-img" src={pawnImgSrc} alt="" draggable="false" />
        <div className="ql-shade" />
      </div>

      <div className="ql-content">
        <h1 className="ql-title">{tx("Qelvaris Chess")}</h1>
        <p className="ql-subtitle">{tx("Mastering the Board")}</p>

        <div
          className="ql-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={known ? Math.round(pct) : undefined}
        >
          {known ? (
            <div className="ql-bar-fill" style={{ width: `${pct}%` }} />
          ) : (
            <div className="ql-bar-indeterminate" />
          )}
        </div>

        <div className="ql-status">
          {statusText}
          {known && pct > 0 ? ` · ${Math.round(pct)}%` : ""}
        </div>
      </div>
    </div>
  );
}