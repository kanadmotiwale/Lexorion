import { useState, useRef, useEffect } from "react";
import { sendMessage } from "../api/client";

export default function ChatPanel({ onUploadClick }) {
  const [messages, setMessages] = useState([
    {
      role: "ai",
      text: "Hi! I'm Lexorion. Upload your documents and ask me anything about them.",
      sources: [],
      confidence: null,
    },
  ]);
  const [input, setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [input]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const question = input.trim();
    setInput("");
    setMessages((p) => [...p, { role: "user", text: question }]);
    setLoading(true);
    try {
      const result = await sendMessage(question, { topK: 5 });
      setMessages((p) => [
        ...p,
        {
          role: "ai",
          text: result.answer,
          sources: result.sources || [],
          confidence: result.confidence,
        },
      ]);
    } catch {
      setMessages((p) => [
        ...p,
        { role: "ai", text: "Something went wrong. Please try again.", sources: [], confidence: null },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div style={s.wrap}>
      {/* Messages */}
      <div style={s.messages}>
        {messages.map((msg, i) => (
          <div key={i} className="msg-enter" style={msg.role === "user" ? s.userRow : s.aiRow}>
            {msg.role === "ai" ? (
              <>
                <div style={s.aiAvatar}>L</div>
                <div style={s.aiBody}>
                  <p style={s.aiText}>{msg.text}</p>
                  {msg.sources?.length > 0 && (
                    <div style={s.sources}>
                      {msg.sources.slice(0, 4).map((src, j) => (
                        <span key={j} style={s.sourceChip}>
                          📄 {src.filename.length > 18
                            ? src.filename.slice(0, 18) + "…"
                            : src.filename}
                          <span style={s.chunkNum}> ·{src.chunk_index}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  {msg.confidence != null && (
                    <div style={s.confRow}>
                      <div style={s.confTrack}>
                        <div style={{ ...s.confFill, width: `${Math.round(msg.confidence * 100)}%` }} />
                      </div>
                      <span style={s.confLabel}>{Math.round(msg.confidence * 100)}% confidence</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={s.userBubble}>
                <p style={s.userText}>{msg.text}</p>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={s.aiRow}>
            <div style={s.aiAvatar}>L</div>
            <div style={s.aiBody}>
              <div style={s.dots}>
                <span style={{ ...s.dot, animationDelay: "0ms" }} />
                <span style={{ ...s.dot, animationDelay: "160ms" }} />
                <span style={{ ...s.dot, animationDelay: "320ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={s.inputWrap}>
        <div style={s.inputBox}>
          <textarea
            ref={textareaRef}
            style={s.textarea}
            placeholder="Ask anything about your documents…"
            value={input}
            rows={1}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
          />
          <button
            style={input.trim() && !loading ? s.sendBtn : s.sendBtnOff}
            onClick={handleSend}
            disabled={!input.trim() || loading}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13" /><path d="M22 2L15 22 11 13 2 9l20-7z" />
            </svg>
          </button>
        </div>
        <p style={s.hint}>Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}

/* ── Dot typing indicator ── */
const dotKeyframes = `
@keyframes dotBounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
  40% { transform: translateY(-6px); opacity: 1; }
}`;
if (!document.querySelector("#dot-style")) {
  const tag = document.createElement("style");
  tag.id = "dot-style";
  tag.textContent = dotKeyframes;
  document.head.appendChild(tag);
}

const s = {
  wrap: {
    display: "flex", flexDirection: "column", height: "100%",
    background: "#fff",
  },
  messages: {
    flex: 1, overflowY: "auto", padding: "32px 0 16px",
    display: "flex", flexDirection: "column", gap: 0,
  },

  /* AI row */
  aiRow: {
    display: "flex", gap: 14, padding: "16px 24px",
    alignItems: "flex-start", maxWidth: 780, width: "100%",
    margin: "0 auto",
  },
  aiAvatar: {
    width: 34, height: 34, borderRadius: 10, background: "#d97706",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#fff", fontWeight: 800, fontSize: 14, flexShrink: 0, marginTop: 2,
  },
  aiBody: { flex: 1, minWidth: 0 },
  aiText: {
    fontSize: 15, lineHeight: "1.75", color: "#111827",
    whiteSpace: "pre-wrap", margin: 0,
  },

  /* User row */
  userRow: {
    display: "flex", justifyContent: "flex-end",
    padding: "12px 24px", maxWidth: 780, width: "100%", margin: "0 auto",
  },
  userBubble: {
    background: "#f4f4f4", borderRadius: 18,
    borderBottomRightRadius: 4,
    padding: "12px 16px", maxWidth: "72%",
  },
  userText: { fontSize: 15, lineHeight: "1.65", color: "#111827", margin: 0 },

  /* Sources */
  sources: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 },
  sourceChip: {
    fontSize: 11, padding: "3px 9px", borderRadius: 20,
    background: "#fff7ed", color: "#92400e",
    border: "1px solid #fde68a", fontWeight: 500,
  },
  chunkNum: { opacity: 0.6 },

  /* Confidence */
  confRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 10 },
  confTrack: { height: 3, width: 64, background: "#e5e7eb", borderRadius: 99, overflow: "hidden" },
  confFill: { height: "100%", background: "#d97706", borderRadius: 99, transition: "width 0.3s" },
  confLabel: { fontSize: 11, color: "#9ca3af" },

  /* Typing dots */
  dots: { display: "flex", gap: 5, padding: "8px 0" },
  dot: {
    width: 7, height: 7, borderRadius: "50%", background: "#d97706",
    animation: "dotBounce 1.2s ease infinite",
    display: "inline-block",
  },

  /* Input */
  inputWrap: {
    padding: "12px 24px 20px",
    background: "#fff",
    borderTop: "1px solid #f0f0f0",
  },
  inputBox: {
    display: "flex", alignItems: "flex-end", gap: 10,
    background: "#f9fafb", border: "1px solid #e5e7eb",
    borderRadius: 16, padding: "10px 12px",
    maxWidth: 780, margin: "0 auto",
    transition: "border-color 0.15s, box-shadow 0.15s",
  },
  textarea: {
    flex: 1, background: "transparent", border: "none",
    resize: "none", fontSize: 15, lineHeight: "1.55",
    color: "#111827", maxHeight: 160, overflowY: "auto",
    padding: "2px 4px",
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 10,
    background: "#d97706", color: "#fff",
    border: "none", cursor: "pointer", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "background 0.15s",
  },
  sendBtnOff: {
    width: 36, height: 36, borderRadius: 10,
    background: "#e5e7eb", color: "#9ca3af",
    border: "none", cursor: "not-allowed", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  hint: { fontSize: 11, color: "#d1d5db", textAlign: "center", marginTop: 8 },
};
