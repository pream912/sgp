// Token-based auth client. Replaces Firebase Auth.
import axios from 'axios';

const STORAGE_KEY = 'gw_jwt';

// Point all relative axios calls at the API origin.
// Vite injects VITE_API_BASE at build time; default to production api.genweb.in.
const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE)
  || 'https://api.genweb.in';
axios.defaults.baseURL = API_BASE;

export function getToken() {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

export function setToken(token) {
  try { localStorage.setItem(STORAGE_KEY, token); } catch {}
  // Mirror to cookie so iframe previews (/sites/:id) can authenticate.
  try { document.cookie = `access_token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`; } catch {}
}

export function clearToken() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  try { document.cookie = 'access_token=; path=/; max-age=0'; } catch {}
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

// Axios instance with Bearer auto-attached.
export const api = axios.create();
api.interceptors.request.use((cfg) => {
  const t = getToken();
  if (t) {
    cfg.headers = cfg.headers || {};
    cfg.headers.Authorization = `Bearer ${t}`;
  }
  return cfg;
});
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response && err.response.status === 401) {
      clearToken();
      if (location.pathname !== '/login') location.replace('/login');
    }
    return Promise.reject(err);
  }
);

// Default axios also gets the header so existing axios.get/post calls work.
axios.interceptors.request.use((cfg) => {
  const t = getToken();
  if (t) {
    cfg.headers = cfg.headers || {};
    if (!cfg.headers.Authorization) cfg.headers.Authorization = `Bearer ${t}`;
  }
  return cfg;
});

export async function sendOtp(email) {
  return axios.post('/api/auth/send-otp', { email });
}

export async function verifyOtp({ email, code, name, referralCode }) {
  const { data } = await axios.post('/api/auth/verify-otp', { email, code, name, referralCode });
  if (data.token) setToken(data.token);
  return data;
}

export async function logout() {
  try { await axios.post('/api/auth/logout'); } catch {}
  clearToken();
}
