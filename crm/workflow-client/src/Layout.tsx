import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutGrid, FileText, Shield, LogOut } from 'lucide-react';
import { useAuth } from './AuthContext';

export function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const isAdmin = user?.workflowRole === 'WorkflowAdmin';

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

          <nav className="flex items-center gap-1">
            <NavItem to="/" icon={<LayoutGrid size={16} />} label="Tracks" end />
            <NavItem to="/sows" icon={<FileText size={16} />} label="SOWs" />
            {isAdmin && <NavItem to="/admin" icon={<Shield size={16} />} label="Admin" />}
          </nav>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm">{user?.firstName} {user?.lastName}</div>
              <div className="text-xs text-text-muted">{user?.workflowRole}</div>
            </div>
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

function NavItem({ to, icon, label, end }: { to: string; icon: React.ReactNode; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
          isActive ? 'bg-surface text-accent' : 'text-text-muted hover:text-text-primary hover:bg-surface'
        }`
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}
