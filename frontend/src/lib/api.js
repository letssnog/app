import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

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
