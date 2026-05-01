import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

export const sendMessage = async (question, options = {}) => {
  const response = await api.post("/chat", {
    question,
    top_k: options.topK || 5,
    score_threshold: options.scoreThreshold || 0.0,
  });
  return response.data;
};

export const uploadDocument = async (file, onUploadProgress) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await axios.post(`${BASE_URL}/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress,
  });
  return response.data;
};

export const listDocuments = async () => {
  const response = await api.get("/documents");
  return response.data;
};

export const deleteDocument = async (documentId) => {
  const response = await api.delete(`/documents/${documentId}`);
  return response.data;
};

export const semanticSearch = async (query, options = {}) => {
  const response = await api.get("/search", {
    params: {
      query,
      top_k: options.topK || 5,
      score_threshold: options.scoreThreshold || 0.0,
      file_type: options.fileType || undefined,
    },
  });
  return response.data;
};

export const getIndexStats = async () => {
  const response = await api.get("/search/stats");
  return response.data;
};