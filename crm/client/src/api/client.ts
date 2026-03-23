import axios from 'axios';

const api = axios.create({
  baseURL: '',  // Use relative URLs — Vite proxy handles routing to :3001
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isLoginPage = window.location.pathname === '/login';
      if (!isLoginPage) {
        window.location.href = '/login?expired=true';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
