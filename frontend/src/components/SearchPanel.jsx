import { useState } from "react";
import { semanticSearch } from "../api/client";

export default function SearchPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [topK, setTopK] = useState(5);

  const handleSearch = async () => {
    if (!query.trim() || loading) return;
    setLoading(true);
    try {
      const data = await semanticSearch(query, { topK });
      setResults(data.results || []);
    } catch { setResults([]); }
    finally { setLoading(false); setSearched(true); }
  };

  const scoreColor = (score) =>
    score >= 0.8 ? "#d97706" : score >= 0.5 ? "#ca8a04" : "#9ca3af";

  return (
    <div style={s.wrap}>
      <div style={s.searchCard}>
        <div style={s.searchRow}>
          <input
            style={s.input}
            placeholder="Search your documents..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button style={loading ? s.btnDisabled : s.btn} onClick={handleSearch} disabled={loading}>
            {loading ? "..." : "🔍"}
          </button>
        </div>
        <div style={s.filters}>
          <label style={s.filterLabel}>Top K</label>
          <input type="number" min={1} max={20} value={topK}
            onChange={(e) => setTopK(Number(e.target.value))} style={s.numInput} />
          {searched && <span style={s.resultCount}>{results.length} results</span>}
        </div>
      </div>

      <div style={s.results}>
        {!searched && !loading && (
          <div style={s.emptyState}>
            <p style={s.emptyIcon}>🔎</p>
            <p style={s.emptyTitle}>Search your knowledge base</p>
            <p style={s.emptySub}>Find semantically similar content across all indexed documents.</p>
          </div>
        )}

        {searched && results.length === 0 && (
          <div style={s.emptyState}>
            <p style={s.emptyIcon}>😕</p>
            <p style={s.emptyTitle}>No results found</p>
            <p style={s.emptySub}>Try a different query or upload more documents.</p>
          </div>
        )}

        {results.map((r, i) => (
          <div key={i} style={s.card} className="fade-in">
            <div style={s.cardTop}>
              <div style={s.cardSource}>
                <span style={s.filename}>
                  {r.filename.length > 20 ? r.filename.slice(0, 20) + "..." : r.filename}
                </span>
                <span style={s.chunkBadge}>chunk {r.chunk_index}</span>
              </div>
              <span style={{ ...s.scoreLabel, color: scoreColor(r.score) }}>
                {r.score.toFixed(2)}
              </span>
            </div>
            <p style={s.cardText}>{r.text.slice(0, 200)}{r.text.length > 200 ? "..." : ""}</p>
            <div style={s.cardMeta}>{r.token_count} tokens</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const s = {
  wrap: { padding: "16px", overflowY: "auto", height: "100%", display: "flex", flexDirection: "column", gap: "14px", background: "#f9fafb" },
  searchCard: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" },
  searchRow: { display: "flex", gap: "8px" },
  input: { flex: 1, padding: "10px 12px", borderRadius: "10px", border: "1px solid #e5e7eb", fontSize: "14px", fontFamily: "inherit", outline: "none", background: "#f9fafb" },
  btn: { width: "44px", height: "44px", background: "#d97706", color: "#fff", border: "none", borderRadius: "10px", fontSize: "18px", cursor: "pointer", flexShrink: 0 },
  btnDisabled: { width: "44px", height: "44px", background: "#fcd34d", color: "#fff", border: "none", borderRadius: "10px", fontSize: "18px", cursor: "not-allowed", flexShrink: 0 },
  filters: { display: "flex", alignItems: "center", gap: "10px" },
  filterLabel: { fontSize: "12px", color: "#9ca3af" },
  numInput: { width: "56px", padding: "6px 8px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", fontFamily: "inherit" },
  resultCount: { marginLeft: "auto", fontSize: "12px", color: "#9ca3af", fontWeight: 500 },
  results: { display: "flex", flexDirection: "column", gap: "10px" },
  emptyState: { textAlign: "center", padding: "48px 16px" },
  emptyIcon: { fontSize: "32px", margin: "0 0 10px" },
  emptyTitle: { fontSize: "15px", fontWeight: 600, color: "#374151", margin: "0 0 6px" },
  emptySub: { fontSize: "13px", color: "#9ca3af", margin: 0 },
  card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "14px" },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" },
  cardSource: { display: "flex", alignItems: "center", gap: "6px", flex: 1, overflow: "hidden" },
  filename: { fontSize: "13px", fontWeight: 600, color: "#d97706", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  chunkBadge: { fontSize: "10px", padding: "2px 7px", borderRadius: "20px", background: "#fef3c7", color: "#92400e", flexShrink: 0 },
  scoreLabel: { fontSize: "12px", fontWeight: 700, flexShrink: 0 },
  cardText: { fontSize: "13px", lineHeight: "1.6", color: "#374151", margin: "0 0 8px" },
  cardMeta: { fontSize: "11px", color: "#d1d5db" },
};