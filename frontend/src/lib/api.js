import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const normalizedBackend = BACKEND_URL?.replace(/\/+$/, "");
const runningInBrowser = typeof window !== "undefined";
const pageIsHttps = runningInBrowser && window.location.protocol === "https:";
const backendIsHttp = normalizedBackend?.startsWith("http://");

// Avoid mixed-content failures on production https pages:
// if env backend URL is plain http, use same-origin /api rewrite instead.
export const API = pageIsHttps && backendIsHttp
  ? "/api"
  : (normalizedBackend ? `${normalizedBackend}/api` : "/api");

export const api = axios.create({
  baseURL: API,
  withCredentials: false,
});

// Attach Cognito ID token (JWT) for API authorization.
api.interceptors.request.use(async (config) => {
  try {
    const jwt = localStorage.getItem("idTokenJwt");
    if (jwt) config.headers.Authorization = `Bearer ${jwt}`;
  } catch {}
  return config;
});

// Build a public file URL for storage paths returned by backend.
// Pass-through if value is already an absolute URL (used by demo seed data).
export const fileUrl = (path) => {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API}/files/${path}`;
};
