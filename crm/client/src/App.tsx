import { type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { ForceChangePassword } from './pages/ForceChangePassword';
import { Dashboard } from './pages/Dashboard';
import { Contacts } from './pages/Contacts';
import { ContactDetail } from './pages/ContactDetail';
import { Congressional } from './pages/Congressional';
import { Government } from './pages/Government';
import { Companies } from './pages/Companies';
import { EntityDetail } from './pages/EntityDetail';
import { Initiatives } from './pages/Initiatives';
import { InitiativeDetail } from './pages/InitiativeDetail';
import { Interactions } from './pages/Interactions';
import { Tasks } from './pages/Tasks';
import { Users } from './pages/settings/Users';
import { Account } from './pages/settings/Account';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function ProtectedRoute({ children, adminOnly = false }: { children: ReactNode; adminOnly?: boolean }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: '#0d1117' }}>
        <div className="text-sm" style={{ color: '#8b949e' }}>Loading…</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
  if (adminOnly && user.role !== 'Admin') return <Navigate to="/" replace />;

  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/change-password" element={<ForceChangePassword />} />
      <Route
        path="/"
        element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
      />
      <Route
        path="/contacts"
        element={<ProtectedRoute><Contacts /></ProtectedRoute>}
      />
      <Route
        path="/contacts/:id"
        element={<ProtectedRoute><ContactDetail /></ProtectedRoute>}
      />
      <Route
        path="/congressional"
        element={<ProtectedRoute><Congressional /></ProtectedRoute>}
      />
      <Route
        path="/government"
        element={<ProtectedRoute><Government /></ProtectedRoute>}
      />
      <Route
        path="/companies"
        element={<ProtectedRoute><Companies /></ProtectedRoute>}
      />
      <Route
        path="/entities/:id"
        element={<ProtectedRoute><EntityDetail /></ProtectedRoute>}
      />
      <Route
        path="/initiatives"
        element={<ProtectedRoute><Initiatives /></ProtectedRoute>}
      />
      <Route
        path="/initiatives/:id"
        element={<ProtectedRoute><InitiativeDetail /></ProtectedRoute>}
      />
      <Route
        path="/interactions"
        element={<ProtectedRoute><Interactions /></ProtectedRoute>}
      />
      <Route
        path="/tasks"
        element={<ProtectedRoute><Tasks /></ProtectedRoute>}
      />
      <Route
        path="/settings/users"
        element={<ProtectedRoute adminOnly><Users /></ProtectedRoute>}
      />
      <Route
        path="/settings/account"
        element={<ProtectedRoute><Account /></ProtectedRoute>}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: '#1c2333',
                color: '#e6edf3',
                border: '1px solid #30363d',
                fontFamily: 'IBM Plex Sans, sans-serif',
                fontSize: '14px',
              },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
