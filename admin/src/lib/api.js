import axios from 'axios';
import { getToken, clearToken } from './auth';

const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE)
  || 'https://api.genweb.in';

const api = axios.create({
  baseURL: `${API_BASE}/api/admin`
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
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

export default api;
