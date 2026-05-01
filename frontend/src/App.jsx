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

  return (
    <div style={s.root}>
      <aside style={s.sidebar}>
        <div style={s.brand}>
          <div style={s.brandIcon}>L</div>
          <div>
            <div style={s.brandName}>Lexorion</div>
            <div style={s.brandSub}>RAG Assistant</div>
          </div>
        </div>

        <nav style={s.nav}>
          {TABS.map(({ id, icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
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
              <span style={s.footerVal}>Ollama</span>
            </div>
            <div style={s.footerRow}>
              <span style={s.footerLabel}>Status</span>
              <span style={{ ...s.footerVal, color: "#d97706" }}>● Online</span>
            </div>
          </div>
        </div>
      </aside>

      <main style={s.main}>
        <header style={s.header}>
          <div>
            <h1 style={s.headerTitle}>
              {activeTab === "Chat" && "Chat with your documents"}
              {activeTab === "Documents" && "Document manager"}
              {activeTab === "Search" && "Semantic search"}
            </h1>
            <p style={s.headerSub}>
              Powered by FAISS · Ollama · Pydantic AI
            </p>
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
      </main>
    </div>
  );
}

const s = {
  root: { display: "flex", height: "100vh", background: "#f9fafb", fontFamily: "'Inter', -apple-system, sans-serif", color: "#111827" },
  sidebar: { width: "240px", minWidth: "240px", background: "#1c1917", borderRight: "1px solid #292524", display: "flex", flexDirection: "column" },
  brand: { display: "flex", alignItems: "center", gap: "12px", padding: "24px 20px", borderBottom: "1px solid #292524" },
  brandIcon: { width: "36px", height: "36px", background: "#d97706", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "18px", flexShrink: 0 },
  brandName: { fontSize: "16px", fontWeight: 700, color: "#fafaf9", letterSpacing: "-0.3px" },
  brandSub: { fontSize: "11px", color: "#78716c", marginTop: "1px" },
  nav: { padding: "16px 12px", display: "flex", flexDirection: "column", gap: "4px", flex: 1 },
  navBtn: { display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "8px", border: "none", background: "transparent", fontSize: "14px", color: "#a8a29e", cursor: "pointer", textAlign: "left", fontFamily: "inherit", fontWeight: 500 },
  navActive: { display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "8px", border: "none", background: "#292524", fontSize: "14px", color: "#fbbf24", cursor: "pointer", textAlign: "left", fontFamily: "inherit", fontWeight: 600 },
  navIcon: { fontSize: "16px" },
  sidebarFooter: { padding: "16px" },
  footerCard: { background: "#292524", borderRadius: "10px", padding: "14px", border: "1px solid #44403c" },
  footerRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" },
  footerLabel: { fontSize: "12px", color: "#78716c" },
  footerVal: { fontSize: "12px", fontWeight: 600, color: "#d6d3d1" },
  main: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 28px", background: "#fff", borderBottom: "1px solid #e5e7eb" },
  headerTitle: { fontSize: "18px", fontWeight: 700, margin: 0, letterSpacing: "-0.3px", color: "#111827" },
  headerSub: { fontSize: "12px", color: "#9ca3af", margin: "3px 0 0" },
  uploadBtn: { padding: "8px 16px", background: "#d97706", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  content: { flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" },
};