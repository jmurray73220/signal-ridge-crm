import axios from 'axios';

// Vite's configured base path (e.g. "/crm/"). Trailing slash stripped
// so we can build absolute paths like `${BASE}/login`.
const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

const api = axios.create({
  baseURL: '',  // Use relative URLs — Vite proxy handles routing to :3001
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const loginPath = `${BASE}/login`;
      const isLoginPage = window.location.pathname === loginPath;
      if (!isLoginPage) {
        window.location.href = `${loginPath}?expired=true`;
      }
    }
    return Promise.reject(error);
  }
);

export default api;
