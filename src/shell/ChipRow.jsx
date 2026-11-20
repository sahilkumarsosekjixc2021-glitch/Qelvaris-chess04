import { useEffect, useRef, useState } from "react";
import "../middlegames/LabDashboard.css";

// Opening chips: pehle kuch chips + baaki "More" dropdown mein. Lab aur Practice dono yahi use karte hain.
// items = [{ name, count }], value = "All" ya opening ka naam, total = "All openings" ka count.

export default function ChipRow({ items, total, value, onChange, visible = 6, allLabel = "All openings", label = "Opening" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (e.type === "keydown" && e.key !== "Escape") return;
      if (e.type === "mousedown" && ref.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const chips = items.slice(0, visible);
  const overflow = items.slice(visible);
  const overflowActive = overflow.find((o) => o.name === value);

  function pick(name) {
    setOpen(false);
    onChange(name);
  }

  return (
    <div className="ld-chips" role="group" aria-label={label}>
      <button type="button" className={`ld-chip ${value === "All" ? "is-on" : ""}`} aria-pressed={value === "All"} onClick={() => pick("All")}>
        {allLabel} <b>{total}</b>
      </button>
      {chips.map((o) => (
        <button key={o.name} type="button" className={`ld-chip ${value === o.name ? "is-on" : ""}`} aria-pressed={value === o.name} onClick={() => pick(o.name)}>
          {o.name} <b>{o.count}</b>
        </button>
      ))}
      {overflow.length > 0 && (
        <div className="ld-more" ref={ref}>
          <button type="button" className={`ld-chip ld-chip--more ${overflowActive ? "is-on" : ""}`} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {overflowActive ? overflowActive.name : `More (${overflow.length})`} <span aria-hidden="true">▾</span>
          </button>
          {open && (
            <ul className="ld-menu" role="listbox">
              {overflow.map((o) => (
                <li key={o.name}>
                  <button type="button" className={value === o.name ? "is-on" : ""} onClick={() => pick(o.name)}>
                    <span>{o.name}</span>
                    <b>{o.count}</b>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
