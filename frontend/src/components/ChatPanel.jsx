import { useState, useRef, useEffect } from "react";
import { sendMessage } from "../api/client";

export default function ChatPanel() {
  const [messages, setMessages] = useState([
    { role: "ai", text: "Hi! I'm Lexorion. Upload documents and ask me anything about them.", sources: [], confidence: null },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const question = input.trim();
    setInput("");
    setMessages((p) => [...p, { role: "user", text: question }]);
    setLoading(true);
    try {
      const result = await sendMessage(question, { topK: 5 });
      setMessages((p) => [...p, {
        role: "ai",
        text: result.answer,
        sources: result.sources || [],
        confidence: result.confidence,
      }]);
    } catch {
      setMessages((p) => [...p, {
        role: "ai",
        text: "Something went wrong. Is the backend running?",
        sources: [],
        confidence: null,
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.wrap}>
      <div style={s.messages}>
        {messages.map((msg, i) => (
          <div key={i} style={{ ...s.row, justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }} className="fade-in">
            {msg.role === "ai" && <div style={s.avatar}>L</div>}
            <div style={msg.role === "user" ? s.userBubble : s.aiBubble}>
              <p style={{ ...s.text, color: msg.role === "user" ? "#fff" : "#1c1917" }}>{msg.text}</p>
              {msg.sources?.length > 0 && (
                <div style={s.sources}>
                  {msg.sources.slice(0, 3).map((src, j) => (
                    <span key={j} style={s.chip}>
                      📄 {src.filename.length > 15 ? src.filename.slice(0, 15) + "..." : src.filename} · {src.chunk_index}
                    </span>
                  ))}
                </div>
              )}
              {msg.confidence != null && (
                <div style={s.confRow}>
                  <div style={s.confBar}>
                    <div style={{ ...s.confFill, width: `${Math.round(msg.confidence * 100)}%` }} />
                  </div>
                  <span style={s.confLabel}>{Math.round(msg.confidence * 100)}%</span>
                </div>
              )}
            </div>
            {msg.role === "user" && <div style={s.userAvatar}>You</div>}
          </div>
        ))}
        {loading && (
          <div style={{ ...s.row, justifyContent: "flex-start" }}>
            <div style={s.avatar}>L</div>
            <div style={s.aiBubble}>
              <p style={{ ...s.text, color: "#a8a29e" }} className="pulse">Searching documents...</p>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={s.inputArea}>
        <div style={s.inputRow}>
          <textarea
            style={s.textarea}
            placeholder="Ask anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            rows={1}
          />
          <button onClick={handleSend} disabled={loading} style={loading ? s.sendDisabled : s.sendBtn}>
            →
          </button>
        </div>
        <p style={s.hint}>Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}

const s = {
  wrap: { display: "flex", flexDirection: "column", height: "100%", background: "#f9fafb" },
  messages: { flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "16px" },
  row: { display: "flex", gap: "8px", alignItems: "flex-start" },
  avatar: { width: "30px", height: "30px", borderRadius: "50%", background: "#d97706", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, flexShrink: 0 },
  userAvatar: { width: "30px", height: "30px", borderRadius: "50%", background: "#e5e7eb", color: "#374151", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 600, flexShrink: 0 },
  aiBubble: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: "16px", borderTopLeftRadius: "4px", padding: "12px 14px", maxWidth: "80%", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" },
  userBubble: { background: "#1c1917", borderRadius: "16px", borderTopRightRadius: "4px", padding: "12px 14px", maxWidth: "80%" },
  text: { margin: 0, fontSize: "14px", lineHeight: "1.6", whiteSpace: "pre-wrap" },
  sources: { display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "10px" },
  chip: { fontSize: "10px", padding: "3px 8px", borderRadius: "20px", background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", fontWeight: 500 },
  confRow: { display: "flex", alignItems: "center", gap: "6px", marginTop: "8px" },
  confBar: { height: "3px", width: "60px", background: "#e5e7eb", borderRadius: "2px", overflow: "hidden" },
  confFill: { height: "100%", background: "#d97706", borderRadius: "2px" },
  confLabel: { fontSize: "10px", color: "#9ca3af" },
  inputArea: { padding: "12px 16px 16px", background: "#fff", borderTop: "1px solid #e5e7eb" },
  inputRow: { display: "flex", gap: "8px", alignItems: "flex-end" },
  textarea: { flex: 1, padding: "11px 14px", borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: "14px", fontFamily: "inherit", resize: "none", background: "#f9fafb", lineHeight: "1.5", maxHeight: "120px" },
  sendBtn: { width: "42px", height: "42px", background: "#d97706", color: "#fff", border: "none", borderRadius: "12px", fontSize: "18px", fontWeight: 700, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" },
  sendDisabled: { width: "42px", height: "42px", background: "#fcd34d", color: "#fff", border: "none", borderRadius: "12px", fontSize: "18px", cursor: "not-allowed", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" },
  hint: { fontSize: "10px", color: "#d1d5db", margin: "6px 0 0", textAlign: "center" },
};