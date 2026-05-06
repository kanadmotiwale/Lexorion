import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function SignupPage({ onSwitch, onGuest }) {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [done,     setDone]     = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 6)  { setError("Password must be at least 6 characters."); return; }

    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setError(error.message);
    else setDone(true);
    setLoading(false);
  };

  if (done) {
    return (
      <div style={s.root}>
        <div style={s.card}>
          <div style={s.logoRow}>
            <div style={s.logoIcon}>L</div>
            <span style={s.logoText}>Lexorion</span>
          </div>
          <div style={s.successIcon}>✓</div>
          <h1 style={s.title}>Check your email</h1>
          <p style={s.sub}>
            We sent a confirmation link to <strong>{email}</strong>.
            Click it to activate your account, then sign in.
          </p>
          <button style={s.submit} onClick={onSwitch}>
            Go to Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.root}>
      <div style={s.card}>

        {/* Logo */}
        <div style={s.logoRow}>
          <div style={s.logoIcon}>L</div>
          <span style={s.logoText}>Lexorion</span>
        </div>

        <h1 style={s.title}>Create an account</h1>
        <p style={s.sub}>Start chatting with your documents today</p>

        <form onSubmit={handleSignup} style={s.form}>
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
                placeholder="Min. 6 characters"
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

          <div style={s.field}>
            <label style={s.label}>Confirm password</label>
            <input
              style={{
                ...s.input,
                borderColor: confirm && confirm !== password ? "#fca5a5" : "#e5e7eb",
              }}
              type={showPass ? "text" : "password"}
              placeholder="Re-enter password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>

          {error && <div style={s.errorBox}>⚠ {error}</div>}

          <button
            type="submit"
            style={loading ? s.submitOff : s.submit}
            disabled={loading}
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p style={s.switchText}>
          Already have an account?{" "}
          <button style={s.switchBtn} onClick={onSwitch}>
            Sign in
          </button>
        </p>

        <div style={s.divider}>
          <div style={s.dividerLine} />
          <span style={s.dividerText}>or</span>
          <div style={s.dividerLine} />
        </div>
        <button style={s.guestBtn} onClick={onGuest}>Continue as guest</button>

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
    background: "#d97706", color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: 800, fontSize: 17,
  },
  logoText:    { fontSize: 20, fontWeight: 700, color: "#111827" },
  title:       { fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 6 },
  sub:         { fontSize: 14, color: "#6b7280", marginBottom: 28 },
  successIcon: {
    width: 56, height: 56, borderRadius: "50%",
    background: "#f0fdf4", border: "2px solid #bbf7d0",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 24, color: "#16a34a", margin: "0 auto 20px",
  },
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
  divider: { display: "flex", alignItems: "center", gap: 10, marginTop: 20 },
  dividerLine: { flex: 1, height: 1, background: "#e5e7eb" },
  dividerText: { fontSize: 12, color: "#9ca3af", flexShrink: 0, padding: "0 4px" },
  guestBtn: {
    width: "100%", padding: "11px", background: "transparent",
    border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 14,
    fontWeight: 500, color: "#6b7280", cursor: "pointer", marginTop: 4,
  },
};
