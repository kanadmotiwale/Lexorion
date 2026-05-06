import { useState, useEffect, useRef } from "react";
import { uploadDocument, listDocuments, deleteDocument } from "../api/client";

export default function UploadPanel({ onDocumentsChange }) {
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading]  = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [progress, setProgress]    = useState(0);
  const [error, setError]          = useState(null);
  const [success, setSuccess]      = useState(null);
  const [dragging, setDragging]    = useState(false);
  const fileRef = useRef(null);

  useEffect(() => { fetchDocs(); }, []);

  const fetchDocs = async (showSpinner = true) => {
    if (showSpinner) setLoadingDocs(true);
    try {
      const data = await listDocuments();
      const docs = data.documents || [];
      setDocuments(docs);
      onDocumentsChange?.(docs);
    } catch {}
    finally { setLoadingDocs(false); }
  };

  const handleUpload = async (file) => {
    setUploading(true); setError(null); setSuccess(null); setProgress(0);
    try {
      await uploadDocument(file, (e) =>
        setProgress(Math.round((e.loaded * 100) / e.total))
      );
      setSuccess(`"${file.name}" indexed successfully!`);
      await fetchDocs(false);
    } catch (err) {
      setError(err.response?.data?.detail || "Upload failed. Please try again.");
    } finally {
      setUploading(false); setProgress(0);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try { await deleteDocument(id); await fetchDocs(false); setSuccess("Document deleted."); }
    catch { setError("Delete failed."); }
  };

  return (
    <div style={s.wrap}>
      <div style={s.inner}>

        {/* Header */}
        <div style={s.pageHeader}>
          <h2 style={s.pageTitle}>Documents</h2>
          <p style={s.pageSub}>Upload PDF, TXT, or MD files to build your knowledge base.</p>
        </div>

        {/* Drop zone */}
        <div
          style={{
            ...s.dropZone,
            borderColor: dragging ? "#d97706" : "#e5e7eb",
            background: dragging ? "#fffbeb" : "#fafafa",
          }}
          onClick={() => !uploading && fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) handleUpload(f);
          }}
        >
          <input
            ref={fileRef} type="file" accept=".pdf,.txt,.md"
            style={{ display: "none" }}
            onChange={(e) => { if (e.target.files[0]) handleUpload(e.target.files[0]); }}
          />

          {uploading ? (
            <div style={{ width: "100%", textAlign: "center" }}>
              <p style={s.dropTitle}>Indexing… {progress}%</p>
              <div style={s.progressTrack}>
                <div style={{ ...s.progressFill, width: `${progress}%` }} />
              </div>
              <p style={s.dropSub}>Parsing, chunking, embedding your document</p>
            </div>
          ) : (
            <>
              <div style={s.uploadIconWrap}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                  stroke="#d97706" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <p style={s.dropTitle}>Drop a file or click to upload</p>
              <p style={s.dropSub}>PDF · TXT · MD &nbsp;·&nbsp; Max 10 MB</p>
              <div style={s.formatRow}>
                {["PDF", "TXT", "MD"].map((f) => (
                  <span key={f} style={s.formatTag}>{f}</span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Alerts */}
        {error && (
          <div style={s.alert}>
            <span style={{ color: "#ef4444" }}>⚠</span> {error}
          </div>
        )}
        {success && (
          <div style={{ ...s.alert, background: "#f0fdf4", borderColor: "#bbf7d0", color: "#166534" }}>
            <span>✓</span> {success}
          </div>
        )}

        {/* Document list */}
        <div style={s.tableWrap}>

          {loadingDocs ? (
            <div style={s.empty}>
              <div style={{ width: 24, height: 24, border: "3px solid #f0f0f0", borderTopColor: "#d97706", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto" }} />
            </div>
          ) : documents.length === 0 ? (
            <div style={s.empty}>
              <p style={{ fontSize: 13, color: "#9ca3af" }}>No documents yet. Upload your first file above.</p>
            </div>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={{ ...s.th, textAlign: "left" }}>Name</th>
                  <th style={{ ...s.th, textAlign: "right", width: 80 }}>Chunks</th>
                  <th style={{ ...s.th, textAlign: "center", width: 110 }}>Status</th>
                  <th style={{ ...s.th, width: 44 }}></th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} style={s.tr}
                    onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={s.tdName}>
                      <div style={s.fileIcon}>
                        {doc.filename.endsWith(".pdf") ? "PDF" : doc.filename.endsWith(".md") ? "MD" : "TXT"}
                      </div>
                      <span style={s.fileName}>{doc.filename}</span>
                    </td>
                    <td style={{ ...s.td, textAlign: "right", color: "#6b7280", fontVariantNumeric: "tabular-nums" }}>
                      {doc.total_chunks}
                    </td>
                    <td style={{ ...s.td, textAlign: "center" }}>
                      <span style={statusBadge(doc.status)}>{doc.status}</span>
                    </td>
                    <td style={{ ...s.td, textAlign: "center" }}>
                      <button
                        style={s.delBtn}
                        onClick={() => handleDelete(doc.id, doc.filename)}
                        title="Delete"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14H6L5 6"/>
                          <path d="M10 11v6M14 11v6"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}

const statusBadge = (status) => ({
  fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20,
  background: status === "indexed" ? "#f0fdf4" : status === "processing" ? "#fffbeb" : "#fef2f2",
  color: status === "indexed" ? "#166534" : status === "processing" ? "#92400e" : "#dc2626",
  border: `1px solid ${status === "indexed" ? "#bbf7d0" : status === "processing" ? "#fde68a" : "#fecaca"}`,
});

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
  dropZone: {
    border: "2px dashed", borderRadius: 16,
    padding: "40px 24px", textAlign: "center",
    cursor: "pointer", transition: "all 0.2s",
    display: "flex", flexDirection: "column",
    alignItems: "center", gap: 8,
  },
  uploadIconWrap: {
    width: 56, height: 56, borderRadius: 14,
    background: "#fff7ed", display: "flex",
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  dropTitle: { fontSize: 15, fontWeight: 600, color: "#111827" },
  dropSub: { fontSize: 13, color: "#9ca3af" },
  formatRow: { display: "flex", gap: 6, marginTop: 4 },
  formatTag: {
    fontSize: 11, padding: "2px 9px", borderRadius: 20,
    background: "#fff7ed", color: "#92400e",
    fontWeight: 600, border: "1px solid #fde68a",
  },
  progressTrack: {
    height: 4, background: "#e5e7eb", borderRadius: 99,
    overflow: "hidden", margin: "10px auto", width: "100%", maxWidth: 320,
  },
  progressFill: { height: "100%", background: "#d97706", borderRadius: 99, transition: "width 0.2s" },
  alert: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "12px 16px", borderRadius: 12, fontSize: 13, fontWeight: 500,
    background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626",
  },
  tableWrap: {
    background: "#fff", borderRadius: 16,
    border: "1px solid #f0f0f0",
    overflow: "hidden",
  },
  table: {
    width: "100%", borderCollapse: "collapse", tableLayout: "fixed",
  },
  th: {
    padding: "11px 16px",
    fontSize: 11, fontWeight: 700, color: "#9ca3af",
    textTransform: "uppercase", letterSpacing: "0.07em",
    background: "#fafafa", borderBottom: "1px solid #f0f0f0",
  },
  tr: {
    transition: "background 0.12s",
  },
  td: {
    padding: "13px 16px", fontSize: 13, color: "#374151", verticalAlign: "middle",
  },
  tdName: {
    padding: "13px 16px", fontSize: 13, verticalAlign: "middle",
    display: "flex", alignItems: "center", gap: 10,
    overflow: "hidden",
  },
  fileIcon: {
    flexShrink: 0, fontSize: 9, fontWeight: 800, letterSpacing: "0.03em",
    padding: "3px 6px", borderRadius: 5,
    background: "#fff7ed", color: "#92400e", border: "1px solid #fde68a",
  },
  fileName: {
    fontWeight: 500, color: "#111827",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  delBtn: {
    background: "transparent", border: "none",
    color: "#d1d5db", cursor: "pointer", padding: 6,
    borderRadius: 7, display: "flex", alignItems: "center",
    justifyContent: "center", transition: "color 0.15s, background 0.15s",
  },
  empty: {
    padding: "40px 24px", textAlign: "center", color: "#9ca3af",
  },
};
