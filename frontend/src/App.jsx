import { useState, useEffect, useCallback } from "react";
import { supabase } from "./lib/supabase";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ChatPanel from "./components/ChatPanel";
import UploadPanel from "./components/UploadPanel";
import SearchPanel from "./components/SearchPanel";
import { listConversations, deleteConversation } from "./api/client";

export default function App() {
  const [session, setSession]                   = useState(undefined);
  const [guestMode, setGuestMode]               = useState(true);
  const [authView, setAuthView]                 = useState("login");

  const [tab, setTab]                           = useState("chat");
  const [sidebarOpen, setSidebar]               = useState(false);

  const [conversations, setConversations]       = useState([]);
  const [activeConversationId, setActiveConvId] = useState(null);

  const isLoggedIn = !!session;

  // ── Auth ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) setGuestMode(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Load conversations on login ────────────────────────────────────────────
  const refreshConversations = useCallback(async () => {
    if (!session) return;
    try {
      const data = await listConversations();
      setConversations(data.conversations || []);
    } catch { /* ignore */ }
  }, [session]);

  useEffect(() => { refreshConversations(); }, [refreshConversations]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setConversations([]);
    setActiveConvId(null);
  };

  const handleNewChat = () => {
    setActiveConvId(null);
    setTab("chat");
    setSidebar(false);
  };

  const handleSelectConv = (id) => {
    setActiveConvId(id);
    setTab("chat");
    setSidebar(false);
  };

  const handleDeleteConv = async (e, id) => {
    e.stopPropagation();
    try {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) setActiveConvId(null);
    } catch { /* ignore */ }
  };

  // Called by ChatPanel when the backend creates a new conversation
  const handleConversationCreated = (id, title) => {
    setActiveConvId(id);
    setConversations((prev) => {
      // Avoid duplicates
      if (prev.find((c) => c.id === id)) return prev;
      return [
        { id, title, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        ...prev,
      ];
    });
  };

  // ── Auth gate ────────────────────────────────────────────────────────────────
  if (session === undefined) {
    return (
      <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0f0f" }}>
        <div style={{ width: 36, height: 36, border: "3px solid #d97706", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      </div>
    );
  }

  // Auth modal rendered as overlay on top of the app (see bottom of JSX)

  // ── Main app ─────────────────────────────────────────────────────────────────
  return (
    <div className="app-root">

      {sidebarOpen && <div className="overlay" onClick={() => setSidebar(false)} />}

      {/* ── Left sidebar: navigation only ── */}
      <aside className={`sidebar${sidebarOpen ? " open" : ""}`}>

        <div style={s.brand}>
          <div style={s.logoIcon}>L</div>
          <span style={s.logoText}>Lexorion</span>
          <button className="sidebar-close" style={s.closeBtn} onClick={() => setSidebar(false)}>✕</button>
        </div>

        <nav style={s.nav}>
          <button style={s.newChatBtn} onClick={handleNewChat}>
            New Chat
          </button>

          <div style={s.navDivider} />

          <button
            style={tab === "chat" ? s.navActive : s.navItem}
            onClick={() => { setTab("chat"); setSidebar(false); }}
          >Chat</button>
          <button
            style={tab === "documents" ? s.navActive : s.navItem}
            onClick={() => { setTab("documents"); setSidebar(false); }}
          >Documents</button>
          <button
            style={tab === "search" ? s.navActive : s.navItem}
            onClick={() => { setTab("search"); setSidebar(false); }}
          >Search</button>
        </nav>

        <div style={s.sidebarFooter}>
          {isLoggedIn ? (
            <div style={s.userRow}>
              <span style={s.userEmail} title={session.user.email}>{session.user.email}</span>
            </div>
          ) : (
            <button style={s.signInPrompt} onClick={() => { setGuestMode(false); setAuthView("login"); }}>
              Sign in to save history →
            </button>
          )}
          <div style={s.poweredBy}>Powered by Groq · pgvector</div>
        </div>
      </aside>

      {/* ── Center: main content ── */}
      <main className="main-area">

        {/* Mobile topbar */}
        <div className="topbar">
          <button style={s.hamburger} onClick={() => setSidebar(true)}>☰</button>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
            <div style={{ ...s.logoIcon, width: 28, height: 28, fontSize: 13 }}>L</div>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Lexorion</span>
          </div>
          <button style={s.newChatSm} onClick={handleNewChat}>New Chat</button>
        </div>

        <div className="content-area">
          {tab === "chat" && (
            <ChatPanel
              conversationId={activeConversationId}
              isGuest={!isLoggedIn}
              onConversationCreated={handleConversationCreated}
              onUploadClick={() => setTab("documents")}
              onRequestAuth={(view) => { setGuestMode(false); setAuthView(view || "login"); }}
            />
          )}
          {tab === "documents" && <UploadPanel onDocumentsChange={() => {}} />}
          {tab === "search"    && <SearchPanel />}
        </div>
      </main>

      {/* ── Right panel: conversation history ── */}
      <aside className="history-panel">
        <div className="history-panel-header">
          <span className="history-panel-header-dot" />
          <span className="history-panel-header-label">History</span>
        </div>

        <div className="history-list">
          {isLoggedIn ? (
            conversations.length > 0 ? (
              conversations.map((c) => (
                <button
                  key={c.id}
                  className={`history-item${c.id === activeConversationId ? " active" : ""}`}
                  onClick={() => handleSelectConv(c.id)}
                  title={c.title}
                >
                  <span className="history-item-icon">◆</span>
                  <span className="history-item-title">{c.title}</span>
                  <span
                    className="history-item-delete"
                    onClick={(e) => handleDeleteConv(e, c.id)}
                    title="Delete"
                  >✕</span>
                </button>
              ))
            ) : (
              <p className="history-empty">
                No conversations yet.<br />Start chatting to<br />see your history here.
              </p>
            )
          ) : (
            <p className="history-empty">
              Sign in to save<br />your chat history.
              <br /><br />
              <button
                style={s.signInSmall}
                onClick={() => { setGuestMode(false); setAuthView("login"); }}
              >Sign in</button>
            </p>
          )}
        </div>

        {/* Right panel footer */}
        <div style={s.historyFooter}>
          {isLoggedIn ? (
            <button style={s.signOutBtn} onClick={handleLogout}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Sign out
            </button>
          ) : null}
        </div>
      </aside>

      {/* ── Auth modal overlay ── */}
      {!session && !guestMode && (
        authView === "signup"
          ? <SignupPage onSwitch={() => setAuthView("login")} onGuest={() => setGuestMode(true)} />
          : <LoginPage  onSwitch={() => setAuthView("signup")} onGuest={() => setGuestMode(true)} />
      )}

    </div>
  );
}

const s = {
  brand: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "18px 14px", borderBottom: "1px solid #2a2a2a", flexShrink: 0,
  },
  logoIcon: {
    width: 34, height: 34, borderRadius: 9, background: "#d97706",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#fff", fontWeight: 800, fontSize: 16, flexShrink: 0,
  },
  logoText: { flex: 1, fontSize: 24, fontWeight: 800, color: "#f5f5f5", letterSpacing: "-0.5px" },
  closeBtn: {
    background: "transparent", border: "none", color: "#666",
    fontSize: 16, cursor: "pointer", padding: 4, borderRadius: 6, flexShrink: 0,
  },
  nav: {
    flex: 1, padding: "12px 10px",
    display: "flex", flexDirection: "column", gap: 2,
  },
  newChatBtn: {
    width: "100%", padding: "10px 12px",
    background: "#d97706", color: "#fff",
    border: "none", borderRadius: 8, fontSize: 13,
    fontWeight: 600, cursor: "pointer", textAlign: "left",
    marginBottom: 4,
  },
  navDivider: { height: 1, background: "#2a2a2a", margin: "6px 2px 8px" },
  navItem: {
    display: "flex", alignItems: "center", width: "100%",
    padding: "9px 12px", borderRadius: 8, border: "none",
    background: "transparent", color: "#9ca3af", fontSize: 13,
    fontWeight: 500, cursor: "pointer", textAlign: "left",
  },
  navActive: {
    display: "flex", alignItems: "center", width: "100%",
    padding: "9px 12px", borderRadius: 8, border: "none",
    background: "#2a2a2a", color: "#f5f5f5", fontSize: 13,
    fontWeight: 600, cursor: "pointer", textAlign: "left",
  },
  sidebarFooter: { padding: "12px 14px", borderTop: "1px solid #2a2a2a", flexShrink: 0, textAlign: "center" },
  userRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 6, minWidth: 0 },
  userEmail: {
    fontSize: 11, color: "#6b7280",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  logoutBtn: {
    background: "transparent", border: "1px solid #2a2a2a",
    borderRadius: 6, color: "#6b7280", cursor: "pointer",
    fontSize: 13, lineHeight: 1, padding: "3px 6px", flexShrink: 0,
  },
  signInPrompt: {
    width: "100%", padding: "8px 10px", background: "transparent",
    border: "1px solid #2a2a2a", borderRadius: 8,
    color: "#d97706", fontSize: 11, fontWeight: 600,
    cursor: "pointer", marginBottom: 6, textAlign: "center",
  },
  signInSmall: {
    padding: "6px 14px", background: "#d97706", color: "#fff",
    border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600,
    cursor: "pointer", marginTop: 4,
  },
  poweredBy: { fontSize: 10, color: "#404040", letterSpacing: "0.02em" },
  hamburger: {
    background: "transparent", border: "none", fontSize: 20,
    cursor: "pointer", color: "#374151", padding: 4, flexShrink: 0,
  },
  newChatSm: {
    padding: "6px 12px", background: "#d97706", color: "#fff",
    border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600,
    cursor: "pointer", flexShrink: 0,
  },
  historyFooter: {
    padding: "12px 14px", borderTop: "1px solid #2a2a2a", flexShrink: 0,
  },
  signOutBtn: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
    width: "100%", padding: "9px 12px",
    background: "transparent", border: "1px solid #2a2a2a",
    borderRadius: 8, color: "#9ca3af", fontSize: 12,
    fontWeight: 500, cursor: "pointer", textAlign: "center",
    transition: "border-color 0.15s, color 0.15s",
  },
};
