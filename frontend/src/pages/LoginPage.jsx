import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function LoginPage({ onSwitch, onGuest }) {
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

        <div style={s.divider}>
          <div style={s.dividerLine} />
          <span style={s.dividerText}>or</span>
          <div style={s.dividerLine} />
        </div>

        <button style={s.guestBtn} onClick={onGuest}>
          Continue as guest
        </button>

      </div>
    </div>
  );
}

const s = {
  root: {
    position: "fixed", inset: 0, zIndex: 100,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "rgba(0,0,0,0.55)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
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
    background: "#1142d4", color: "#fff",
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
    padding: "12px", background: "#1142d4", color: "#fff",
    border: "none", borderRadius: 10, fontSize: 15,
    fontWeight: 600, cursor: "pointer", marginTop: 4,
  },
  submitOff: {
    padding: "12px", background: "#a5b4fc", color: "#fff",
    border: "none", borderRadius: 10, fontSize: 15,
    fontWeight: 600, cursor: "not-allowed", marginTop: 4,
  },
  switchText: { textAlign: "center", fontSize: 13, color: "#6b7280", marginTop: 22 },
  switchBtn: {
    background: "transparent", border: "none",
    color: "#1142d4", fontWeight: 600, cursor: "pointer",
    fontSize: 13, padding: 0,
  },
  divider: {
    display: "flex", alignItems: "center", gap: 10, marginTop: 20,
  },
  dividerLine: { flex: 1, height: 1, background: "#e5e7eb" },
  dividerText: {
    fontSize: 12, color: "#9ca3af", flexShrink: 0, padding: "0 4px",
  },
  guestBtn: {
    width: "100%", padding: "11px", background: "transparent",
    border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 14,
    fontWeight: 500, color: "#6b7280", cursor: "pointer", marginTop: 4,
  },
};
