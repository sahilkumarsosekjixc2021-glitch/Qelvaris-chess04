import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { track } from "../features/telemetry/track"; // QV-TRACK
import "./AuthPage.css";
import { tx } from "../i18n/pages/auth"; // QV-I18N
import { lit } from "../i18n/pages/today"; // QV-I18N

export default function AuthPage({ initialMode = "login", onBack }) {
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState(initialMode === "register" ? "register" : "login"); // QV-LANDING
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setMessage("");
    setBusy(true);

    try {
      if (mode === "register") {
        const cleanUsername = username.trim().toLowerCase();

        if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
          throw new Error(
            tx("Username must be 3–20 characters: lowercase letters, numbers or underscore.")
          );
        }

        if (password.length < 6) {
          throw new Error(tx("Password must contain at least 6 characters."));
        }

        const { data, error: authError } = await signUp({
          email: email.trim(),
          password,
          username: cleanUsername,
          displayName: displayName.trim(),
        });

        if (authError) throw authError;

        track("signup_success", { confirmEmail: !data.session });
        if (data.session) {
          setMessage(tx("Account created successfully!"));
        } else {
          setMessage(
            tx("Registration successful! Check your email and confirm your account before logging in.")
          );
        }
      } else {
        const { error: authError } = await signIn({
          email: email.trim(),
          password,
        });

        if (authError) throw authError;
        track("login_success");
      }
    } catch (err) {
      track("auth_error", { mode, message: String(err?.message || "").slice(0, 100) });
      setError(lit(err.message) || tx("Something went wrong. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen">
      <div className="auth-glow auth-glow-one" />
      <div className="auth-glow auth-glow-two" />

      <section className="auth-card">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            style={{
              alignSelf: "flex-start",
              marginBottom: 14,
              padding: 0,
              border: 0,
              background: "transparent",
              color: "#8c97ab",
              font: "inherit",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {tx("← Back")}</button>
        )}

        <div className="auth-brand">
          <div className="auth-brand-icon">♛</div>
          <div>
            <h1>{tx("QELVARIS")}</h1>
            <p>{tx("CHESS • THINK BEYOND")}</p>
          </div>
        </div>

        <div className="auth-heading">
          <span className="auth-eyebrow">{tx("YOUR CHESS JOURNEY")}</span>
          <h2>
            {mode === "login" ? tx("Welcome back.") : tx("Create your account.")}
          </h2>
          <p>
            {mode === "login"
              ? tx("Sign in to continue your journey.")
              : tx("Join Qelvaris and start improving your game.")}
          </p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => {
              setMode("login");
              setError("");
              setMessage("");
            }}
          >
            {tx("Sign In")}</button>

          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => {
              setMode("register");
              setError("");
              setMessage("");
            }}
          >
            {tx("Create Account")}</button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "register" && (
            <>
              <label>
                {tx("Display Name")}<input
                  type="text"
                  placeholder={tx("Your name")}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={40}
                  required
                />
              </label>

              <label>
                {tx("Username")}<input
                  type="text"
                  placeholder={tx("e.g. chessmaster_01")}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  minLength={3}
                  maxLength={20}
                  required
                />
                <small>{tx("3–20 characters. Letters, numbers and _ only.")}</small>
              </label>
            </>
          )}

          <label>
            {tx("Email Address")}<input
              type="email"
              placeholder={tx("you@example.com")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label>
            {tx("Password")}<input
              type="password"
              placeholder={tx("Enter your password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </label>

          {error && <div className="auth-error">{error}</div>}
          {message && <div className="auth-success">{message}</div>}

          <button className="auth-submit" type="submit" disabled={busy}>
            {busy
              ? tx("Please wait...")
              : mode === "login"
                ? tx("Sign In →")
                : tx("Create Account →")}
          </button>
        </form>

        <p className="auth-footer">
          {tx("By continuing, you agree to use Qelvaris responsibly.")}</p>
      </section>
    </main>
  );
}