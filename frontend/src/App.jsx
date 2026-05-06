import { useState, useEffect, useCallback } from "react";
import { supabase } from "./lib/supabase";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ChatPanel from "./components/ChatPanel";
import UploadPanel from "./components/UploadPanel";
import SearchPanel from "./components/SearchPanel";
import { listConversations, deleteConversation } from "./api/client";

export default function App() {
  const [session, setSession]                   = useState(undefined); // undefined = checking
  const [guestMode, setGuestMode]               = useState(false);
  const [authView, setAuthView]                 = useState("login");

  const [tab, setTab]                           = useState("chat");
  const [sidebarOpen, setSidebar]               = useState(false);
  const [documents, setDocuments]               = useState([]);

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

  // ── Load conversation list whenever the user signs in ──────────────────────
  const refreshConversations = useCallback(async () => {
    if (!session) return;
    try {
      const data = await listConversations();
      setConversations(data.conversations || []);
    } catch { /* silently ignore */ }
  }, [session]);

  useEffect(() => { refreshConversations(); }, [refreshConversations]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setConversations([]);
    setActiveConvId(null);
    setGuestMode(false);
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

  // Called by ChatPanel when the backend auto-creates a new conversation
  const handleConversationCreated = (id, title) => {
    setActiveConvId(id);
    setConversations((prev) => [
      { id, title, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      ...prev,
    ]);
  };

  // ── Auth gate ────────────────────────────────────────────────────────────────
  if (session === undefined) {
    return (
      <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0f0f" }}>
        <div style={{ width: 36, height: 36, border: "3px solid #d97706", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      </div>
    );
  }

  if (!session && !guestMode) {
    if (authView === "signup") {
      return <SignupPage onSwitch={() => setAuthView("login")} onGuest={() => setGuestMode(true)} />;
    }
    return <LoginPage onSwitch={() => setAuthView("signup")} onGuest={() => setGuestMode(true)} />;
  }

  // ── Main app ─────────────────────────────────────────────────────────────────
  return (
    <div className="app-root">

      {sidebarOpen && <div className="overlay" onClick={() => setSidebar(false)} />}

      {/* ── Sidebar ── */}
      <aside className={`sidebar${sidebarOpen ? " open" : ""}`}>

        {/* Brand */}
        <div style={s.brand}>
          <div style={s.logoIcon}>L</div>
          <span style={s.logoText}>Lexorion</span>
          <button className="sidebar-close" style={s.closeBtn} onClick={() => setSidebar(false)}>✕</button>
        </div>

        {/* New Chat button */}
        <div style={s.newChatWrap}>
          <button style={s.newChatBtn} onClick={handleNewChat}>
            <span style={{ fontSize: 17, lineHeight: 1, marginRight: 2 }}>+</span>
            New Chat
          </button>
        </div>

        {/* Conversation list */}
        <div style={s.convList}>
          {isLoggedIn && conversations.length > 0 ? (
            conversations.map((c) => (
              <div
                key={c.id}
                style={c.id === activeConversationId ? s.convItemActive : s.convItem}
                onClick={() => handleSelectConv(c.id)}
                title={c.title}
              >
                <span style={s.convTitle}>{c.title}</span>
                <button
                  style={s.convDelete}
                  onClick={(e) => handleDeleteConv(e, c.id)}
                  title="Delete"
                >✕</button>
              </div>
            ))
          ) : isLoggedIn ? (
            <p style={s.noConvs}>No conversations yet.<br />Start chatting!</p>
          ) : (
            <p style={s.noConvs}>
              <span style={{ fontSize: 22, display: "block", marginBottom: 8 }}>💬</span>
              Sign in to save<br />your chat history.
            </p>
          )}
        </div>

        {/* Bottom nav — Documents & Search */}
        <nav style={s.bottomNav}>
          <button
            style={tab === "documents" ? s.navActive : s.navItem}
            onClick={() => { setTab("documents"); setSidebar(false); }}
          >Documents</button>
          <button
            style={tab === "search" ? s.navActive : s.navItem}
            onClick={() => { setTab("search"); setSidebar(false); }}
          >Search</button>
        </nav>

        {/* Footer */}
        <div style={s.sidebarFooter}>
          {isLoggedIn ? (
            <div style={s.userRow}>
              <span style={s.userEmail} title={session.user.email}>{session.user.email}</span>
              <button style={s.logoutBtn} onClick={handleLogout} title="Sign out">⎋</button>
            </div>
          ) : (
            <button
              style={s.signInPrompt}
              onClick={() => { setGuestMode(false); setAuthView("login"); }}
            >
              Sign in to save history →
            </button>
          )}
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
            <button style={s.uploadBtnSm} onClick={handleNewChat}>+ New</button>
          )}
        </div>

        {/* Content */}
        <div className="content-area">
          {tab === "chat" && (
            <ChatPanel
              conversationId={activeConversationId}
              isGuest={!isLoggedIn}
              onConversationCreated={handleConversationCreated}
              onUploadClick={() => setTab("documents")}
            />
          )}
          {tab === "documents" && <UploadPanel onDocumentsChange={setDocuments} />}
          {tab === "search"    && <SearchPanel />}
        </div>
      </main>
    </div>
  );
}

const s = {
  brand: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "18px 16px", borderBottom: "1px solid #2a2a2a", flexShrink: 0,
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
  newChatWrap: { padding: "10px 10px 6px", flexShrink: 0 },
  newChatBtn: {
    display: "flex", alignItems: "center", gap: 8, width: "100%",
    padding: "9px 12px", borderRadius: 8, border: "1px solid #2a2a2a",
    background: "transparent", color: "#f5f5f5", fontSize: 14,
    fontWeight: 500, cursor: "pointer",
  },
  convList: {
    flex: 1, overflowY: "auto", padding: "4px 10px",
    display: "flex", flexDirection: "column", gap: 1,
  },
  convItem: {
    display: "flex", alignItems: "center", gap: 6,
    padding: "9px 10px", borderRadius: 8, cursor: "pointer",
    color: "#9ca3af", fontSize: 13,
    background: "transparent",
  },
  convItemActive: {
    display: "flex", alignItems: "center", gap: 6,
    padding: "9px 10px", borderRadius: 8, cursor: "pointer",
    color: "#f5f5f5", fontSize: 13, fontWeight: 500,
    background: "#2a2a2a",
  },
  convTitle: {
    flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  convDelete: {
    background: "transparent", border: "none", color: "#6b7280",
    fontSize: 10, cursor: "pointer", padding: "2px 4px", lineHeight: 1,
    borderRadius: 4, flexShrink: 0,
  },
  noConvs: {
    fontSize: 12, color: "#4b5563", textAlign: "center",
    padding: "28px 12px", lineHeight: 1.9,
  },
  bottomNav: {
    padding: "8px 10px", borderTop: "1px solid #2a2a2a",
    display: "flex", flexDirection: "column", gap: 2, flexShrink: 0,
  },
  navItem: {
    display: "flex", alignItems: "center",
    padding: "10px 12px", borderRadius: 8, border: "none",
    background: "transparent", color: "#9ca3af", fontSize: 14,
    fontWeight: 500, cursor: "pointer", textAlign: "left", width: "100%",
  },
  navActive: {
    display: "flex", alignItems: "center",
    padding: "10px 12px", borderRadius: 8, border: "none",
    background: "#2a2a2a", color: "#f5f5f5", fontSize: 14,
    fontWeight: 600, cursor: "pointer", textAlign: "left", width: "100%",
  },
  sidebarFooter: { padding: "12px 16px", borderTop: "1px solid #2a2a2a", flexShrink: 0 },
  userRow: { display: "flex", alignItems: "center", gap: 6, marginBottom: 6, minWidth: 0 },
  userEmail: {
    flex: 1, fontSize: 11, color: "#6b7280",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  logoutBtn: {
    background: "transparent", border: "1px solid #2a2a2a",
    borderRadius: 6, color: "#6b7280", cursor: "pointer",
    fontSize: 14, lineHeight: 1, padding: "3px 6px", flexShrink: 0,
  },
  signInPrompt: {
    width: "100%", padding: "8px 10px", background: "transparent",
    border: "1px solid #2a2a2a", borderRadius: 8,
    color: "#d97706", fontSize: 12, fontWeight: 600,
    cursor: "pointer", marginBottom: 6, textAlign: "left",
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
