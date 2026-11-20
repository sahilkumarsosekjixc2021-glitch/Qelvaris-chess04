// QV-PWA: Settings mein "Install app" button (Chrome/Android/desktop) ya iPhone ke liye hint.
import { useEffect, useState } from "react";
import { getInstallState, promptInstall, subscribeInstall } from "./pwa";
import { track } from "../telemetry/track";

export default function InstallButton() {
  const [state, setState] = useState(getInstallState());

  useEffect(() => subscribeInstall(setState), []);

  if (state.standalone) return null;

  if (state.canInstall) {
    return (
      <div className="qs-actions">
        <button
          className="qs-btn qs-btn--gold"
          onClick={async () => {
            const ok = await promptInstall();
            track("pwa_install_prompt", { accepted: ok });
          }}
        >
          Install Qelvaris on this device
        </button>
      </div>
    );
  }

  if (state.ios) {
    return (
      <p className="qs-hint">
        To install on iPhone: tap the Share button in Safari, then &ldquo;Add to Home Screen&rdquo;.
      </p>
    );
  }

  return null;
}
