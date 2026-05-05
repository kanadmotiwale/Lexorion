import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ChatPanel from "./components/ChatPanel";
import UploadPanel from "./components/UploadPanel";
import SearchPanel from "./components/SearchPanel";

const NAV = [
  { id: "chat",      label: "Chat",      icon: "✦" },
  { id: "documents", label: "Documents", icon: "↑" },
  { id: "search",    label: "Search",    icon: "◎" },
];

export default function App() {
  const [tab, setTab]               = useState("chat");
  const [documents, setDocuments]   = useState([]);
  const [sidebarOpen, setSidebar]   = useState(false);
  const [session, setSession]       = useState(undefined); // undefined = loading
  const [authView, setAuthView]     = useState("login");   // "login" | "signup"

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const switchTab = (id) => { setTab(id); setSidebar(false); };

  // Still checking session
  if (session === undefined) {
    return (
      <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0f0f" }}>
        <div style={{ width: 36, height: 36, border: "3px solid #d97706", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      </div>
    );
  }

  // Not logged in
  if (!session) {
    if (authView === "signup") {
      return <SignupPage onSwitch={() => setAuthView("login")} />;
    }
    return <LoginPage onSwitch={() => setAuthView("signup")} />;
  }

  return (
    <div className="app-root">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="overlay" onClick={() => setSidebar(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={`sidebar${sidebarOpen ? " open" : ""}`}>

        {/* Brand */}
        <div style={s.brand}>
          <div style={s.logoIcon}>L</div>
          <span style={s.logoText}>Lexorion</span>
          <button
            className="sidebar-close"
            style={s.closeBtn}
            onClick={() => setSidebar(false)}
          >✕</button>
        </div>

        {/* Nav */}
        <nav style={s.nav}>
          {NAV.map(({ id, label, icon }) => (
            <button
              key={id}
              style={tab === id ? s.navActive : s.navItem}
              onClick={() => switchTab(id)}
            >
              <span style={s.navIcon}>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div style={s.sidebarFooter}>
          <div style={s.footerPill}>
            <span style={{ color: "#d97706", fontSize: 10 }}>●</span>
            <span style={s.footerText}>
              {documents.length} document{documents.length !== 1 ? "s" : ""} indexed
            </span>
          </div>
          <div style={s.userRow}>
            <span style={s.userEmail} title={session.user.email}>
              {session.user.email}
            </span>
            <button style={s.logoutBtn} onClick={handleLogout} title="Sign out">
              ⎋
            </button>
          </div>
          <div style={s.poweredBy}>Powered by Groq · pgvector</div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="main-area">

        {/* Mobile topbar */}
        <div className="topbar">
          <button style={s.hamburger} onClick={() => setSidebar(true)}>☰</button>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
            <div style={{ ...s.logoIcon, width: 28, height: 28, fontSize: 13 }}>L</div>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Lexorion</span>
          </div>
          {tab === "chat" && (
            <button style={s.uploadBtnSm} onClick={() => switchTab("documents")}>
              + Docs
            </button>
          )}
        </div>

        {/* Content */}
        <div className="content-area">
          {tab === "chat" && (
            <ChatPanel
              documents={documents}
              onUploadClick={() => switchTab("documents")}
            />
          )}
          {tab === "documents" && (
            <UploadPanel onDocumentsChange={setDocuments} />
          )}
          {tab === "search" && <SearchPanel />}
        </div>
      </main>
    </div>
  );
}

const s = {
  brand: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "18px 16px", borderBottom: "1px solid #2a2a2a",
  },
  logoIcon: {
    width: 32, height: 32, borderRadius: 9, background: "#d97706",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#fff", fontWeight: 800, fontSize: 15, flexShrink: 0,
  },
  logoText: { flex: 1, fontSize: 19, fontWeight: 700, color: "#f5f5f5", letterSpacing: "-0.3px" },
  closeBtn: {
    background: "transparent", border: "none", color: "#666",
    fontSize: 16, cursor: "pointer", padding: 4, lineHeight: 1,
    borderRadius: 6, flexShrink: 0,
  },
  nav: { flex: 1, padding: "14px 10px", display: "flex", flexDirection: "column", gap: 2 },
  navItem: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "10px 12px", borderRadius: 8, border: "none",
    background: "transparent", color: "#9ca3af", fontSize: 14,
    fontWeight: 500, cursor: "pointer", textAlign: "left", width: "100%",
    transition: "background 0.15s, color 0.15s",
  },
  navActive: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "10px 12px", borderRadius: 8, border: "none",
    background: "#2a2a2a", color: "#f5f5f5", fontSize: 14,
    fontWeight: 600, cursor: "pointer", textAlign: "left", width: "100%",
  },
  navIcon: { fontSize: 14, width: 18, textAlign: "center", flexShrink: 0 },
  sidebarFooter: { padding: "14px 16px", borderTop: "1px solid #2a2a2a" },
  footerPill: { display: "flex", alignItems: "center", gap: 6, marginBottom: 8 },
  footerText: { fontSize: 12, color: "#6b7280" },
  userRow: {
    display: "flex", alignItems: "center", gap: 6,
    marginBottom: 6, minWidth: 0,
  },
  userEmail: {
    flex: 1, fontSize: 11, color: "#6b7280",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  logoutBtn: {
    background: "transparent", border: "1px solid #2a2a2a",
    borderRadius: 6, color: "#6b7280", cursor: "pointer",
    fontSize: 14, lineHeight: 1, padding: "3px 6px", flexShrink: 0,
  },
  poweredBy: { fontSize: 10, color: "#404040", letterSpacing: "0.02em" },
  hamburger: {
    background: "transparent", border: "none", fontSize: 20,
    cursor: "pointer", color: "#374151", padding: 4, lineHeight: 1, flexShrink: 0,
  },
  uploadBtnSm: {
    padding: "6px 12px", background: "#d97706", color: "#fff",
    border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600,
    cursor: "pointer", flexShrink: 0,
  },
};
