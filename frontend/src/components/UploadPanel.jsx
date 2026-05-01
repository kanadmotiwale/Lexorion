import { useState, useEffect, useRef } from "react";
import { uploadDocument, listDocuments, deleteDocument } from "../api/client";

export default function UploadPanel({ onDocumentsChange }) {
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => { fetchDocs(); }, []);

  const fetchDocs = async () => {
    try {
      const data = await listDocuments();
      setDocuments(data.documents || []);
      onDocumentsChange?.(data.documents || []);
    } catch {}
  };

  const handleUpload = async (file) => {
    setUploading(true); setError(null); setSuccess(null); setProgress(0);
    try {
      await uploadDocument(file, (e) => setProgress(Math.round((e.loaded * 100) / e.total)));
      setSuccess(`"${file.name}" uploaded and indexed successfully!`);
      await fetchDocs();
    } catch (err) {
      setError(err.response?.data?.detail || "Upload failed.");
    } finally {
      setUploading(false); setProgress(0);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try { await deleteDocument(id); await fetchDocs(); setSuccess(`"${name}" deleted.`); }
    catch { setError("Delete failed."); }
  };

  const statusStyle = (status) => ({
    fontSize: "12px", fontWeight: 600, padding: "3px 10px", borderRadius: "20px",
    background: status === "indexed" ? "#fef3c7" : status === "processing" ? "#fef9c3" : "#fee2e2",
    color: status === "indexed" ? "#92400e" : status === "processing" ? "#ca8a04" : "#dc2626",
  });

  return (
    <div style={s.wrap}>
      <div
        style={{ ...s.dropZone, borderColor: dragging ? "#d97706" : "#e5e7eb", background: dragging ? "#fffbeb" : "#fff" }}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleUpload(f); }}
      >
        <input ref={fileRef} type="file" accept=".pdf,.txt,.md" style={{ display: "none" }} onChange={(e) => { if (e.target.files[0]) handleUpload(e.target.files[0]); }} />
        {uploading ? (
          <div style={{ width: "100%" }}>
            <p style={s.dropTitle}>Uploading & indexing... {progress}%</p>
            <div style={s.track}><div style={{ ...s.fill, width: `${progress}%` }} /></div>
            <p style={s.dropSub}>Running ETL pipeline — parsing, chunking, embedding</p>
          </div>
        ) : (
          <>
            <div style={s.uploadIcon}>📂</div>
            <p style={s.dropTitle}>Drop a file here or click to browse</p>
            <p style={s.dropSub}>PDF, TXT, MD · Max 10MB</p>
            <div style={s.formatRow}>
              {["PDF", "TXT", "MD"].map((f) => <span key={f} style={s.formatTag}>{f}</span>)}
            </div>
          </>
        )}
      </div>

      {error && <div style={s.errorBox}>⚠️ {error}</div>}
      {success && <div style={s.successBox}>✅ {success}</div>}

      <div style={s.tableCard}>
        <div style={s.tableHead}>
          <span style={{ flex: 3 }}>Name</span>
          <span style={{ flex: 1, textAlign: "center" }}>Type</span>
          <span style={{ flex: 1, textAlign: "center" }}>Chunks</span>
          <span style={{ flex: 1, textAlign: "center" }}>Status</span>
          <span style={{ flex: 1, textAlign: "center" }}>Action</span>
        </div>
        {documents.length === 0 ? (
          <div style={s.empty}>No documents yet. Upload one above to get started.</div>
        ) : (
          documents.map((doc) => (
            <div key={doc.id} style={s.tableRow}>
              <span style={{ flex: 3, fontSize: "13px", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.filename}</span>
              <span style={{ flex: 1, textAlign: "center" }}><span style={s.typeBadge}>{doc.file_type.toUpperCase()}</span></span>
              <span style={{ flex: 1, textAlign: "center", fontSize: "13px", color: "#6b7280" }}>{doc.total_chunks}</span>
              <span style={{ flex: 1, textAlign: "center" }}><span style={statusStyle(doc.status)}>{doc.status}</span></span>
              <span style={{ flex: 1, textAlign: "center" }}>
                <button style={s.delBtn} onClick={() => handleDelete(doc.id, doc.filename)}>Delete</button>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const s = {
  wrap: { padding: "24px 28px", overflowY: "auto", height: "100%", display: "flex", flexDirection: "column", gap: "16px", background: "#f9fafb" },
  dropZone: { border: "2px dashed", borderRadius: "16px", padding: "40px 24px", textAlign: "center", cursor: "pointer", transition: "all 0.2s", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" },
  uploadIcon: { fontSize: "32px", marginBottom: "4px" },
  dropTitle: { fontSize: "15px", fontWeight: 600, margin: 0, color: "#1c1917" },
  dropSub: { fontSize: "13px", color: "#9ca3af", margin: 0 },
  formatRow: { display: "flex", gap: "6px", marginTop: "8px" },
  formatTag: { fontSize: "11px", padding: "3px 10px", borderRadius: "20px", background: "#fef3c7", color: "#92400e", fontWeight: 500, border: "1px solid #fde68a" },
  track: { height: "6px", background: "#e5e7eb", borderRadius: "3px", overflow: "hidden", margin: "10px 0" },
  fill: { height: "100%", background: "#d97706", borderRadius: "3px", transition: "width 0.2s" },
  errorBox: { background: "#fee2e2", color: "#dc2626", padding: "12px 16px", borderRadius: "10px", fontSize: "13px", fontWeight: 500 },
  successBox: { background: "#fef3c7", color: "#92400e", padding: "12px 16px", borderRadius: "10px", fontSize: "13px", fontWeight: 500 },
  tableCard: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" },
  tableHead: { display: "flex", padding: "12px 20px", background: "#f9fafb", fontSize: "11px", fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", gap: "8px", borderBottom: "1px solid #e5e7eb" },
  tableRow: { display: "flex", padding: "14px 20px", borderBottom: "1px solid #f3f4f6", alignItems: "center", gap: "8px" },
  typeBadge: { fontSize: "11px", padding: "3px 8px", borderRadius: "6px", background: "#fef3c7", color: "#92400e", fontWeight: 600 },
  delBtn: { fontSize: "12px", padding: "5px 12px", borderRadius: "6px", border: "1px solid #fecaca", background: "transparent", color: "#dc2626", cursor: "pointer", fontWeight: 500 },
  empty: { padding: "32px", textAlign: "center", fontSize: "14px", color: "#9ca3af" },
};