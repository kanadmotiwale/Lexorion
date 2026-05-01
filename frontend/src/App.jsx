import { useState } from "react";
import ChatPanel from "./components/ChatPanel";
import UploadPanel from "./components/UploadPanel";
import SearchPanel from "./components/SearchPanel";

const TABS = [
  { id: "Chat", icon: "💬" },
  { id: "Documents", icon: "📄" },
  { id: "Search", icon: "🔍" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("Chat");
  const [documents, setDocuments] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = () => setSidebarOpen(false);
  const openSidebar = () => setSidebarOpen(true);

  return (
    <div style={s.root}>

      {/* Overlay — closes sidebar when tapping outside */}
      {sidebarOpen && (
        <div
          style={s.overlay}
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside style={{
        ...s.sidebar,
        transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
      }}>
        <div style={s.brand}>
          <div style={s.brandIcon}>L</div>
          <div style={{ flex: 1 }}>
            <div style={s.brandName}>Lexorion</div>
            <div style={s.brandSub}>RAG Assistant</div>
          </div>
          <button
            style={s.closeBtn}
            onClick={closeSidebar}
          >
            ✕
          </button>
        </div>

        <nav style={s.nav}>
          {TABS.map(({ id, icon }) => (
            <button
              key={id}
              onClick={() => {
                setActiveTab(id);
                closeSidebar();
              }}
              style={activeTab === id ? s.navActive : s.navBtn}
            >
              <span style={s.navIcon}>{icon}</span>
              {id}
            </button>
          ))}
        </nav>

        <div style={s.sidebarFooter}>
          <div style={s.footerCard}>
            <div style={s.footerRow}>
              <span style={s.footerLabel}>Documents</span>
              <span style={s.footerVal}>{documents.length}</span>
            </div>
            <div style={s.footerRow}>
              <span style={s.footerLabel}>Engine</span>
              <span style={s.footerVal}>Groq</span>
            </div>
            <div style={s.footerRow}>
              <span style={s.footerLabel}>Status</span>
              <span style={{ ...s.footerVal, color: "#d97706" }}>● Online</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={s.main}>
        <header style={s.header}>
          <div style={s.headerLeft}>
            <button style={s.menuBtn} onClick={openSidebar}>☰</button>
            <div>
              <h1 style={s.headerTitle}>
                {activeTab === "Chat" && "Chat"}
                {activeTab === "Documents" && "Documents"}
                {activeTab === "Search" && "Search"}
              </h1>
              <p style={s.headerSub}>Powered by FAISS · Groq · Pydantic AI</p>
            </div>
          </div>
          {activeTab === "Chat" && (
            <button style={s.uploadBtn} onClick={() => setActiveTab("Documents")}>
              Upload docs
            </button>
          )}
        </header>

        <div style={s.content}>
          {activeTab === "Chat" && <ChatPanel documents={documents} />}
          {activeTab === "Documents" && <UploadPanel onDocumentsChange={setDocuments} />}
          {activeTab === "Search" && <SearchPanel />}
        </div>

        {/* Bottom nav for mobile */}
        <nav style={s.bottomNav}>
          {TABS.map(({ id, icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={s.bottomNavBtn}
            >
              <span style={s.bottomNavIcon}>{icon}</span>
              <span style={{
                ...s.bottomNavLabel,
                color: activeTab === id ? "#fbbf24" : "#a8a29e",
                fontWeight: activeTab === id ? 600 : 400,
              }}>
                {id}
              </span>
            </button>
          ))}
        </nav>
      </main>
    </div>
  );
}

const s = {
  root: {
    display: "flex",
    height: "100dvh",
    background: "#f9fafb",
    fontFamily: "'Inter', -apple-system, sans-serif",
    color: "#111827",
    overflow: "hidden",
    position: "relative",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    zIndex: 40,
  },
  sidebar: {
    width: "240px",
    minWidth: "240px",
    background: "#1c1917",
    borderRight: "1px solid #292524",
    display: "flex",
    flexDirection: "column",
    position: "fixed",
    top: 0,
    left: 0,
    height: "100dvh",
    zIndex: 50,
    transition: "transform 0.25s ease",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "20px 16px",
    borderBottom: "1px solid #292524",
  },
  brandIcon: {
    width: "34px", height: "34px", background: "#d97706",
    borderRadius: "9px", display: "flex", alignItems: "center",
    justifyContent: "center", color: "#fff", fontWeight: 700,
    fontSize: "17px", flexShrink: 0,
  },
  brandName: { fontSize: "15px", fontWeight: 700, color: "#fafaf9", letterSpacing: "-0.3px" },
  brandSub: { fontSize: "10px", color: "#78716c", marginTop: "1px" },
  closeBtn: {
    background: "transparent",
    border: "none",
    color: "#a8a29e",
    fontSize: "18px",
    cursor: "pointer",
    padding: "6px",
    lineHeight: 1,
    borderRadius: "6px",
    flexShrink: 0,
  },
  nav: { padding: "14px 10px", display: "flex", flexDirection: "column", gap: "3px", flex: 1 },
  navBtn: {
    display: "flex", alignItems: "center", gap: "10px",
    padding: "11px 12px", borderRadius: "8px", border: "none",
    background: "transparent", fontSize: "14px", color: "#a8a29e",
    cursor: "pointer", textAlign: "left", fontFamily: "inherit", fontWeight: 500,
  },
  navActive: {
    display: "flex", alignItems: "center", gap: "10px",
    padding: "11px 12px", borderRadius: "8px", border: "none",
    background: "#292524", fontSize: "14px", color: "#fbbf24",
    cursor: "pointer", textAlign: "left", fontFamily: "inherit", fontWeight: 600,
  },
  navIcon: { fontSize: "16px" },
  sidebarFooter: { padding: "14px" },
  footerCard: {
    background: "#292524", borderRadius: "10px",
    padding: "12px", border: "1px solid #44403c",
  },
  footerRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "7px" },
  footerLabel: { fontSize: "12px", color: "#78716c" },
  footerVal: { fontSize: "12px", fontWeight: 600, color: "#d6d3d1" },
  main: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", width: "100%" },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 16px", background: "#fff", borderBottom: "1px solid #e5e7eb", gap: "10px",
  },
  headerLeft: { display: "flex", alignItems: "center", gap: "12px" },
  menuBtn: {
    background: "transparent", border: "none", fontSize: "22px",
    cursor: "pointer", padding: "4px", color: "#374151", flexShrink: 0,
    lineHeight: 1,
  },
  headerTitle: { fontSize: "16px", fontWeight: 700, margin: 0, letterSpacing: "-0.3px", color: "#111827" },
  headerSub: { fontSize: "11px", color: "#9ca3af", margin: "2px 0 0" },
  uploadBtn: {
    padding: "8px 14px", background: "#d97706", color: "#fff",
    border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0,
  },
  content: { flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" },
  bottomNav: {
    display: "flex", background: "#1c1917",
    borderTop: "1px solid #292524", padding: "6px 0 10px",
  },
  bottomNavBtn: {
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
    gap: "3px", background: "transparent", border: "none",
    cursor: "pointer", padding: "6px 4px", fontFamily: "inherit",
  },
  bottomNavIcon: { fontSize: "20px" },
  bottomNavLabel: { fontSize: "10px", fontWeight: 500 },
};