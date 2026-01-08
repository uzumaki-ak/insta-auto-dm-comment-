/**
 * API Service - COMPLETE & WORKING
 */
import axios from "axios";
import { supabase } from "./auth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: false, // Set to false for Bearer token auth
});

// Add auth token to requests
api.interceptors.request.use(
  async (config) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
        console.log("Adding auth token to request:", config.url);
      } else {
        console.warn("No session found for request:", config.url);
      }
    } catch (error) {
      console.error("Auth error:", error);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error(
      "API Error:",
      error.config?.url,
      error.response?.status,
      error.message
    );

    if (error.response?.status === 401) {
      // Token expired or invalid
      console.log("Token expired, signing out...");
      supabase.auth.signOut();
      window.location.href = "/";
    }
    return Promise.reject(error);
  }
);

// ============================================
// POST ENDPOINTS
// ============================================

export const getAllPosts = async () => {
  try {
    console.log("Fetching all posts...");
    const { data } = await api.get("/api/posts");
    console.log("Posts fetched:", data.posts?.length || 0);
    return data;
  } catch (error) {
    console.error("Get posts error:", error);
    throw error;
  }
};

export const getPostById = async (postId) => {
  try {
    const { data } = await api.get(`/api/posts/${postId}`);
    return data;
  } catch (error) {
    console.error("Get post error:", error);
    throw error;
  }
};

export const syncPosts = async () => {
  try {
    const { data } = await api.post("/api/posts/sync");
    return data;
  } catch (error) {
    console.error("Sync posts error:", error);
    throw error;
  }
};

export const togglePostActive = async (postId, isActive) => {
  try {
    const { data } = await api.put(`/api/posts/${postId}/toggle`, {
      is_active: isActive,
    });
    return data;
  } catch (error) {
    console.error("Toggle post error:", error);
    throw error;
  }
};

export const addKeyword = async (postId, keywordData) => {
  try {
    const { data } = await api.post(
      `/api/posts/${postId}/keywords`,
      keywordData
    );
    return data;
  } catch (error) {
    console.error("Add keyword error:", error);
    throw error;
  }
};

export const deleteKeyword = async (keywordId) => {
  try {
    const { data } = await api.delete(`/api/posts/keywords/${keywordId}`);
    return data;
  } catch (error) {
    console.error("Delete keyword error:", error);
    throw error;
  }
};

// ============================================
// STATS ENDPOINTS
// ============================================

export const getOverallStats = async () => {
  try {
    console.log("Fetching stats...");
    const { data } = await api.get("/api/stats");
    console.log("Stats fetched:", data);
    return data;
  } catch (error) {
    console.error("Get stats error:", error);
    throw error;
  }
};

export const getPostStats = async (postId) => {
  try {
    const { data } = await api.get(`/api/stats/posts/${postId}`);
    return data;
  } catch (error) {
    console.error("Get post stats error:", error);
    throw error;
  }
};

export const getRecentReplies = async (postId, limit = 50) => {
  try {
    const { data } = await api.get(`/api/stats/posts/${postId}/replies`, {
      params: { limit },
    });
    return data;
  } catch (error) {
    console.error("Get replies error:", error);
    throw error;
  }
};

export default api;
