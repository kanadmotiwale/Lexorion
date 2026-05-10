import axios from "axios";
import { supabase } from "../lib/supabase";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

// ── Guest session ID ──────────────────────────────────────────────────────────
// Each browser gets a unique ID stored in localStorage so guest documents
// are private to that browser session and not shared across all guests.
function getGuestId() {
  let id = localStorage.getItem("lexorion_guest_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("lexorion_guest_id", id);
  }
  return id;
}

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT for logged-in users, or X-Guest-Id for guests.
// Wrapped in try/catch so a Supabase outage doesn't kill all API requests.
api.interceptors.request.use(async (config) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    } else {
      config.headers["X-Guest-Id"] = getGuestId();
    }
  } catch {
    // Supabase unreachable — fall back to guest mode so the app still works
    config.headers["X-Guest-Id"] = getGuestId();
  }
  return config;
});

// ── Chat ──────────────────────────────────────────────────────────────────────

export const sendMessage = async (question, options = {}) => {
  const response = await api.post("/chat", {
    question,
    top_k:           options.topK           || 5,
    score_threshold: options.scoreThreshold || 0.0,
    conversation_id: options.conversationId || null,
  });
  return response.data;
};

// ── Documents ─────────────────────────────────────────────────────────────────

export const uploadDocument = async (file, onUploadProgress) => {
  const { data: { session } } = await supabase.auth.getSession();
  const formData = new FormData();
  formData.append("file", file);
  const response = await axios.post(`${BASE_URL}/upload`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
      ...(session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : { "X-Guest-Id": getGuestId() }),
    },
    onUploadProgress,
  });
  return response.data;
};

export const listDocuments = async () => {
  const response = await api.get("/documents");
  return response.data;
};

export const getDocument = async (documentId) => {
  const response = await api.get(`/documents/${documentId}`);
  return response.data;
};

export const deleteDocument = async (documentId) => {
  const response = await api.delete(`/documents/${documentId}`);
  return response.data;
};

// ── Search ────────────────────────────────────────────────────────────────────

export const semanticSearch = async (query, options = {}) => {
  const response = await api.get("/search", {
    params: {
      query,
      top_k:           options.topK           || 5,
      score_threshold: options.scoreThreshold || 0.0,
      file_type:       options.fileType       || undefined,
    },
  });
  return response.data;
};

export const getIndexStats = async () => {
  const response = await api.get("/search/stats");
  return response.data;
};

// ── Conversations ─────────────────────────────────────────────────────────────

export const listConversations = async () => {
  const response = await api.get("/conversations");
  return response.data;
};

export const getConversationMessages = async (conversationId) => {
  const response = await api.get(`/conversations/${conversationId}/messages`);
  return response.data;
};

export const deleteConversation = async (conversationId) => {
  const response = await api.delete(`/conversations/${conversationId}`);
  return response.data;
};
