import { useState } from "react";
import { semanticSearch } from "../api/client";

export default function SearchPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [topK, setTopK] = useState(5);
  const [fileType, setFileType] = useState("");

  const handleSearch = async () => {
    if (!query.trim() || loading) return;
    setLoading(true);
    try {
      const data = await semanticSearch(query, { topK, fileType: fileType || undefined });
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
          <span style={s.searchIcon}>🔍</span>
          <input
            style={s.input}
            placeholder="Search semantically across all documents..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button style={loading ? s.btnDisabled : s.btn} onClick={handleSearch} disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </button>
        </div>

        <div style={s.filters}>
          <div style={s.filterItem}>
            <label style={s.filterLabel}>Top K</label>
            <input type="number" min={1} max={20} value={topK}
              onChange={(e) => setTopK(Number(e.target.value))} style={s.numInput} />
          </div>
          <div style={s.filterItem}>
            <label style={s.filterLabel}>File type</label>
            <select value={fileType} onChange={(e) => setFileType(e.target.value)} style={s.select}>
              <option value="">All</option>
              <option value="pdf">PDF</option>
              <option value="txt">TXT</option>
              <option value="md">MD</option>
            </select>
          </div>
          {searched && <span style={s.resultCount}>{results.length} results</span>}
        </div>
      </div>

      <div style={s.results}>
        {!searched && !loading && (
          <div style={s.emptyState}>
            <p style={s.emptyIcon}>🔎</p>
            <p style={s.emptyTitle}>Search your knowledge base</p>
            <p style={s.emptySub}>Enter a query to find semantically similar content across all indexed documents.</p>
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
                <span style={s.fileIcon}>📄</span>
                <span style={s.filename}>{r.filename}</span>
                <span style={s.chunkBadge}>chunk {r.chunk_index}</span>
              </div>
              <div style={s.scoreWrap}>
                <div style={s.scoreBar}>
                  <div style={{ ...s.scoreFill, width: `${Math.round(r.score * 100)}%`, background: scoreColor(r.score) }} />
                </div>
                <span style={{ ...s.scoreLabel, color: scoreColor(r.score) }}>{r.score.toFixed(3)}</span>
              </div>
            </div>
            <p style={s.cardText}>{r.text}</p>
            <div style={s.cardMeta}>{r.token_count} tokens</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const s = {
  wrap: { padding: "24px 28px", overflowY: "auto", height: "100%", display: "flex", flexDirection: "column", gap: "16px", background: "#f9fafb" },
  searchCard: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: "14px", padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px" },
  searchRow: { display: "flex", gap: "10px", alignItems: "center" },
  searchIcon: { fontSize: "18px" },
  input: { flex: 1, padding: "10px 14px", borderRadius: "10px", border: "1px solid #e5e7eb", fontSize: "14px", fontFamily: "inherit", outline: "none", background: "#f9fafb" },
  btn: { padding: "10px 20px", background: "#d97706", color: "#fff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  btnDisabled: { padding: "10px 20px", background: "#fcd34d", color: "#fff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: 600, cursor: "not-allowed", fontFamily: "inherit" },
  filters: { display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" },
  filterItem: { display: "flex", alignItems: "center", gap: "6px" },
  filterLabel: { fontSize: "12px", color: "#9ca3af", fontWeight: 500 },
  numInput: { width: "60px", padding: "6px 10px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", fontFamily: "inherit" },
  select: { padding: "6px 10px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", fontFamily: "inherit", background: "#fff" },
  resultCount: { marginLeft: "auto", fontSize: "12px", color: "#9ca3af", fontWeight: 500 },
  results: { display: "flex", flexDirection: "column", gap: "12px" },
  emptyState: { textAlign: "center", padding: "60px 20px" },
  emptyIcon: { fontSize: "36px", margin: "0 0 12px" },
  emptyTitle: { fontSize: "15px", fontWeight: 600, color: "#374151", margin: "0 0 6px" },
  emptySub: { fontSize: "13px", color: "#9ca3af", margin: 0 },
  card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px 20px" },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" },
  cardSource: { display: "flex", alignItems: "center", gap: "6px" },
  fileIcon: { fontSize: "14px" },
  filename: { fontSize: "13px", fontWeight: 600, color: "#d97706" },
  chunkBadge: { fontSize: "11px", padding: "2px 8px", borderRadius: "20px", background: "#fef3c7", color: "#92400e" },
  scoreWrap: { display: "flex", alignItems: "center", gap: "8px" },
  scoreBar: { width: "60px", height: "4px", background: "#e5e7eb", borderRadius: "2px", overflow: "hidden" },
  scoreFill: { height: "100%", borderRadius: "2px" },
  scoreLabel: { fontSize: "12px", fontWeight: 600 },
  cardText: { fontSize: "13px", lineHeight: "1.7", color: "#374151", margin: "0 0 10px" },
  cardMeta: { fontSize: "11px", color: "#d1d5db" },
};