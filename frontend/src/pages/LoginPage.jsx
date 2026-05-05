import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function LoginPage({ onSwitch }) {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div style={s.root}>
      <div style={s.card}>

        {/* Logo */}
        <div style={s.logoRow}>
          <div style={s.logoIcon}>L</div>
          <span style={s.logoText}>Lexorion</span>
        </div>

        <h1 style={s.title}>Welcome back</h1>
        <p style={s.sub}>Sign in to your account to continue</p>

        <form onSubmit={handleLogin} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Email</label>
            <input
              style={s.input}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div style={s.field}>
            <label style={s.label}>Password</label>
            <div style={s.passWrap}>
              <input
                style={{ ...s.input, paddingRight: 44 }}
                type={showPass ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                style={s.eyeBtn}
                onClick={() => setShowPass((v) => !v)}
              >
                {showPass ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          {error && <div style={s.errorBox}>⚠ {error}</div>}

          <button
            type="submit"
            style={loading ? s.submitOff : s.submit}
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p style={s.switchText}>
          Don't have an account?{" "}
          <button style={s.switchBtn} onClick={onSwitch}>
            Sign up
          </button>
        </p>

      </div>
    </div>
  );
}

const s = {
  root: {
    height: "100dvh", display: "flex",
    alignItems: "center", justifyContent: "center",
    background: "#0f0f0f",
  },
  card: {
    width: "100%", maxWidth: 420,
    background: "#fff", borderRadius: 20,
    padding: "40px 36px",
    boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
    margin: "0 16px",
  },
  logoRow: {
    display: "flex", alignItems: "center",
    gap: 10, marginBottom: 28,
  },
  logoIcon: {
    width: 36, height: 36, borderRadius: 10,
    background: "#d97706", color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: 800, fontSize: 17,
  },
  logoText: { fontSize: 20, fontWeight: 700, color: "#111827" },
  title: { fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 6 },
  sub:   { fontSize: 14, color: "#6b7280", marginBottom: 28 },
  form:  { display: "flex", flexDirection: "column", gap: 18 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 13, fontWeight: 600, color: "#374151" },
  input: {
    padding: "11px 14px", borderRadius: 10,
    border: "1px solid #e5e7eb", fontSize: 14,
    color: "#111827", background: "#f9fafb",
    width: "100%", boxSizing: "border-box",
  },
  passWrap: { position: "relative" },
  eyeBtn: {
    position: "absolute", right: 10, top: "50%",
    transform: "translateY(-50%)",
    background: "transparent", border: "none",
    cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 2,
  },
  errorBox: {
    background: "#fef2f2", border: "1px solid #fecaca",
    borderRadius: 10, padding: "10px 14px",
    fontSize: 13, color: "#dc2626", fontWeight: 500,
  },
  submit: {
    padding: "12px", background: "#d97706", color: "#fff",
    border: "none", borderRadius: 10, fontSize: 15,
    fontWeight: 600, cursor: "pointer", marginTop: 4,
  },
  submitOff: {
    padding: "12px", background: "#fcd34d", color: "#fff",
    border: "none", borderRadius: 10, fontSize: 15,
    fontWeight: 600, cursor: "not-allowed", marginTop: 4,
  },
  switchText: { textAlign: "center", fontSize: 13, color: "#6b7280", marginTop: 22 },
  switchBtn: {
    background: "transparent", border: "none",
    color: "#d97706", fontWeight: 600, cursor: "pointer",
    fontSize: 13, padding: 0,
  },
};
