// Admin token-based auth client.
import axios from 'axios';

const STORAGE_KEY = 'gw_jwt_admin';

const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE)
  || 'https://api.genweb.in';
axios.defaults.baseURL = API_BASE;

export function getToken() {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

export function setToken(token) {
  try { localStorage.setItem(STORAGE_KEY, token); } catch {}
}

export function clearToken() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

function decodePayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch { return null; }
}

export function getCurrentUser() {
  const t = getToken();
  if (!t) return null;
  const payload = decodePayload(t);
  if (!payload) return null;
  if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) {
    clearToken();
    return null;
  }
  return { uid: payload.uid, email: payload.email, isAdmin: !!payload.is_admin };
}

export async function sendOtp(email) {
  return axios.post('/api/auth/send-otp', { email });
}

export async function verifyOtp({ email, code }) {
  const { data } = await axios.post('/api/auth/verify-otp', { email, code });
  if (data.token) setToken(data.token);
  return data;
}

export async function logout() {
  clearToken();
}
