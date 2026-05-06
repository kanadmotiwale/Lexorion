import { useState } from "react";
import { semanticSearch } from "../api/client";

export default function SearchPanel() {
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim() || loading) return;
    setLoading(true);
    try {
      const data = await semanticSearch(query, { topK: 5 });
      setResults(data.results || []);
    } catch { setResults([]); }
    finally { setLoading(false); setSearched(true); }
  };

  const scoreColor = (score) =>
    score >= 0.75 ? "#16a34a" : score >= 0.5 ? "#46dcf0" : "#9ca3af";

  return (
    <div style={s.wrap}>
      <div style={s.inner}>

        {/* Header */}
        <div style={s.pageHeader}>
          <h2 style={s.pageTitle}>Search</h2>
          <p style={s.pageSub}>Semantic search across all your indexed documents.</p>
        </div>

        {/* Search bar */}
        <div style={s.searchBox}>
          <svg style={s.searchIcon} width="18" height="18" viewBox="0 0 24 24"
            fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            style={s.searchInput}
            placeholder="Search your knowledge base…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button
            style={loading || !query.trim() ? s.searchBtnOff : s.searchBtn}
            onClick={handleSearch}
            disabled={loading || !query.trim()}
          >
            {loading ? "…" : "Search"}
          </button>
        </div>

        {/* Results */}
        {!searched && !loading && (
          <div style={s.empty}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>🔎</p>
            <p style={s.emptyTitle}>Search your knowledge base</p>
            <p style={s.emptySub}>Find semantically similar content across all indexed documents.</p>
          </div>
        )}

        {searched && results.length === 0 && (
          <div style={s.empty}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>😕</p>
            <p style={s.emptyTitle}>No results found</p>
            <p style={s.emptySub}>Try a different query or upload more documents.</p>
          </div>
        )}

        {searched && results.length > 0 && (
          <div style={s.resultsMeta}>
            <span style={s.count}>{results.length} result{results.length !== 1 ? "s" : ""}</span>
            <span style={s.metaSep}>for</span>
            <span style={s.queryLabel}>"{query}"</span>
          </div>
        )}

        <div style={s.cards}>
          {results.map((r, i) => (
            <div key={i} style={s.card} className="msg-enter">
              <div style={s.cardTop}>
                <div style={s.cardLeft}>
                  <span style={s.filename}>
                    {r.filename.length > 28 ? r.filename.slice(0, 28) + "…" : r.filename}
                  </span>
                  <span style={s.chunkBadge}>chunk {r.chunk_index}</span>
                </div>
                <span style={{ ...s.score, color: scoreColor(r.score) }}>
                  {(r.score * 100).toFixed(0)}%
                </span>
              </div>
              <p style={s.cardText}>
                {r.text.slice(0, 300)}{r.text.length > 300 ? "…" : ""}
              </p>
              <div style={s.cardMeta}>{r.token_count} tokens</div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

const s = {
  wrap: {
    height: "100%", overflowY: "auto", background: "#fff",
    display: "flex", justifyContent: "center",
  },
  inner: {
    width: "100%", maxWidth: 680,
    padding: "40px 24px 60px",
    display: "flex", flexDirection: "column", gap: 20,
  },
  pageHeader: { marginBottom: 4 },
  pageTitle: { fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 4 },
  pageSub: { fontSize: 14, color: "#6b7280" },

  searchBox: {
    display: "flex", alignItems: "center", gap: 10,
    background: "#f9fafb", border: "1px solid #e5e7eb",
    borderRadius: 14, padding: "10px 14px",
  },
  searchIcon: { flexShrink: 0 },
  searchInput: {
    flex: 1, background: "transparent", border: "none",
    fontSize: 15, color: "#111827",
  },
  searchBtn: {
    padding: "8px 18px", background: "#46dcf0", color: "#fff",
    border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600,
    cursor: "pointer", flexShrink: 0,
  },
  searchBtnOff: {
    padding: "8px 18px", background: "#e5e7eb", color: "#9ca3af",
    border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600,
    cursor: "not-allowed", flexShrink: 0,
  },

  empty: { textAlign: "center", padding: "60px 24px" },
  emptyTitle: { fontSize: 16, fontWeight: 600, color: "#374151", marginBottom: 6 },
  emptySub: { fontSize: 13, color: "#9ca3af" },

  resultsMeta: { display: "flex", alignItems: "center", gap: 6, fontSize: 13 },
  count: { fontWeight: 700, color: "#111827" },
  metaSep: { color: "#9ca3af" },
  queryLabel: { color: "#46dcf0", fontWeight: 500 },

  cards: { display: "flex", flexDirection: "column", gap: 12 },
  card: {
    background: "#fff", border: "1px solid #e5e7eb",
    borderRadius: 14, padding: "16px 18px",
    transition: "box-shadow 0.15s",
  },
  cardTop: {
    display: "flex", justifyContent: "space-between",
    alignItems: "center", marginBottom: 10, gap: 8,
  },
  cardLeft: { display: "flex", alignItems: "center", gap: 8, flex: 1, overflow: "hidden" },
  filename: {
    fontSize: 13, fontWeight: 600, color: "#46dcf0",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  chunkBadge: {
    fontSize: 10, padding: "2px 8px", borderRadius: 20,
    background: "#ecfeff", color: "#0e7490", fontWeight: 600,
    border: "1px solid #a5f3fc", flexShrink: 0,
  },
  score: { fontSize: 13, fontWeight: 700, flexShrink: 0 },
  cardText: { fontSize: 13, lineHeight: "1.7", color: "#374151", marginBottom: 10 },
  cardMeta: { fontSize: 11, color: "#d1d5db" },
};
