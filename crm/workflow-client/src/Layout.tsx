import { Link, Outlet, useNavigate } from 'react-router-dom';
import { Settings, LogOut } from 'lucide-react';
import { useAuth } from './AuthContext';
import { useClientContext } from './ClientContext';

export function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const isAdmin = user?.workflowRole === 'WorkflowAdmin';
  const { clients, selectedClientId, setSelectedClientId, canSwitch } = useClientContext();

  async function handleLogout() {
    await logout();
    nav('/login');
  }

  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col">
      <header className="border-b border-border bg-bg-deep">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-accent flex items-center justify-center text-bg font-bold">
              SR
            </div>
            <div>
              <div className="text-sm font-semibold tracking-wide text-accent">
                SIGNAL RIDGE
              </div>
              <div className="text-xs text-text-muted -mt-0.5">Workflow</div>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            {canSwitch && clients.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted uppercase tracking-wider">Viewing</span>
                <select
                  value={selectedClientId || ''}
                  onChange={e => setSelectedClientId(e.target.value || null)}
                  className="bg-surface border border-border text-sm rounded px-2 py-1 text-text-primary focus:outline-none focus:border-accent"
                >
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="text-right">
              <div className="text-sm">{user?.firstName} {user?.lastName}</div>
              <div className="text-xs text-text-muted">{user?.workflowRole}</div>
            </div>
            {isAdmin && (
              <Link
                to="/admin"
                className="btn-ghost p-1.5 rounded hover:text-accent"
                title="Admin"
                aria-label="Admin"
              >
                <Settings size={16} />
              </Link>
            )}
            <button onClick={handleLogout} className="btn-ghost flex items-center gap-1">
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-border text-xs text-text-muted py-3 text-center">
        Signal Ridge Strategies · Workflow Collaboration
      </footer>
    </div>
  );
}

