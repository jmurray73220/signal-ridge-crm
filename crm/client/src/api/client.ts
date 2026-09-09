import axios from 'axios';

// Vite's configured base path (e.g. "/crm/"). Trailing slash stripped
// so we can build absolute paths like `${BASE}/login`.
const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

const api = axios.create({
  baseURL: '',  // Use relative URLs — Vite proxy handles routing to :3001
  withCredentials: true,
});

// Pages that must work while signed out. AuthProvider probes /auth/me on
// every page mount, so a 401 here is expected rather than an expired session.
// Redirecting would make the password-reset flow unreachable for exactly the
// people who need it — and on /reset-password it would also discard the token
// carried in the query string.
const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password', '/register'];

function isPublicPage(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === `${BASE}${p}`);
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isPublicPage(window.location.pathname)) {
      window.location.href = `${BASE}/login?expired=true`;
    }
    return Promise.reject(error);
  }
);

export default api;
