import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/Authcontext";

export default function Login() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    const action = mode === "login" ? signIn : signUp;
    const { error } = await action(email, password);

    if (error) {
      setMessage(error.message);
      return;
    }
    navigate("/");
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 320, margin: "80px auto", display: "grid", gap: 12 }}>
      <h2>{mode === "login" ? "Login" : "Sign up"}</h2>

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Password (kam se kam 6 letters)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      <button type="submit">
        {mode === "login" ? "Login karo" : "Account banao"}
      </button>

      <p
        style={{ cursor: "pointer" }}
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
      >
        {mode === "login" ? "Account nahi hai? Sign up karo" : "Account hai? Login karo"}
      </p>

      {message && <p>{message}</p>}
    </form>
  );
}