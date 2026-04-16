import { type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './AuthContext';
import { Layout } from './Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { TrackDetail } from './pages/TrackDetail';
import { ActionItemDetail } from './pages/ActionItemDetail';
import { SOWList } from './pages/SOWList';
import { SOWDetail } from './pages/SOWDetail';
import { Admin } from './pages/Admin';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 20_000 },
  },
});

function Protected({ children, adminOnly = false }: { children: ReactNode; adminOnly?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg">
        <div className="text-text-muted text-sm">Loading…</div>
      </div>
    );
  }
  if (!user || !user.workflowRole) return <Navigate to="/login" replace />;
  if (adminOnly && user.workflowRole !== 'WorkflowAdmin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter basename="/workflow">
          <Toaster
            position="top-right"
            toastOptions={{
              style: { background: '#12213a', color: '#e6edf3', border: '1px solid #24375a' },
            }}
          />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <Protected>
                  <Layout />
                </Protected>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="tracks/:id" element={<TrackDetail />} />
              <Route path="action-items/:id" element={<ActionItemDetail />} />
              <Route path="sows" element={<SOWList />} />
              <Route path="sows/:id" element={<SOWDetail />} />
              <Route
                path="admin"
                element={
                  <Protected adminOnly>
                    <Admin />
                  </Protected>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
