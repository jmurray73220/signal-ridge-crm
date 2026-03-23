import { useState, Fragment, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Building2,
  Landmark,
  Factory,
  Target,
  MessageSquare,
  CheckSquare,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface NavItem {
  path: string;
  icon: ReactNode;
  label: string;
  section?: string;
}

const navItems: NavItem[] = [
  { path: '/', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
  { path: '/contacts', icon: <Users size={18} />, label: 'Contacts' },
  { path: '/congressional', icon: <Landmark size={18} />, label: 'Congressional', section: 'Entities' },
  { path: '/government', icon: <Building2 size={18} />, label: 'Government Orgs' },
  { path: '/companies', icon: <Factory size={18} />, label: 'Companies' },
  { path: '/initiatives', icon: <Target size={18} />, label: 'Initiatives' },
  { path: '/interactions', icon: <MessageSquare size={18} />, label: 'Interactions' },
  { path: '/tasks', icon: <CheckSquare size={18} />, label: 'Tasks' },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();
  const { user, logout } = useAuth();

  return (
    <aside
      className="flex flex-col h-screen sticky top-0 transition-all duration-200"
      style={{
        width: collapsed ? 56 : 220,
        background: '#161b22',
        borderRight: '1px solid #30363d',
        minWidth: collapsed ? 56 : 220,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-4" style={{ borderBottom: '1px solid #30363d' }}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold"
              style={{ background: '#c9a84c', color: '#0d1117' }}
            >
              SR
            </div>
            <span className="text-sm font-semibold" style={{ color: '#e6edf3' }}>
              Signal Ridge
            </span>
          </div>
        )}
        {collapsed && (
          <div
            className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold mx-auto"
            style={{ background: '#c9a84c', color: '#0d1117' }}
          >
            SR
          </div>
        )}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="p-1 rounded hover:bg-surface transition-colors"
            style={{ color: '#8b949e' }}
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="p-2 flex justify-center hover:bg-surface transition-colors"
          style={{ color: '#8b949e', borderBottom: '1px solid #30363d' }}
        >
          <ChevronRight size={16} />
        </button>
      )}

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {navItems.map((item, i) => {
          const showSection = item.section && (i === 0 || navItems[i - 1]?.section !== item.section);
          const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));

          return (
            <Fragment key={item.path}>
              {showSection && !collapsed && (
                <div className="px-3 py-2 mt-2">
                  <span className="text-xs font-medium uppercase tracking-widest" style={{ color: '#8b949e' }}>
                    {item.section}
                  </span>
                </div>
              )}
              <Link
                to={item.path}
                title={collapsed ? item.label : undefined}
                className="flex items-center gap-3 px-3 py-2 mx-1 rounded transition-colors"
                style={{
                  color: isActive ? '#c9a84c' : '#8b949e',
                  background: isActive ? 'rgba(201, 168, 76, 0.1)' : 'transparent',
                  textDecoration: 'none',
                }}
              >
                <span style={{ flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
              </Link>
            </Fragment>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: '1px solid #30363d' }}>
        <Link
          to="/settings/account"
          className="flex items-center gap-3 px-3 py-2 mx-1 my-1 rounded transition-colors"
          style={{ color: '#8b949e', textDecoration: 'none' }}
        >
          <Settings size={18} />
          {!collapsed && <span className="text-sm">Settings</span>}
        </Link>
        {!collapsed && user && (
          <div className="px-3 py-2 flex items-center justify-between">
            <div>
              <div className="text-xs font-medium" style={{ color: '#e6edf3' }}>
                {user.firstName} {user.lastName}
              </div>
              <div className="text-xs" style={{ color: '#8b949e' }}>
                {user.role}
              </div>
            </div>
            <button
              onClick={() => logout()}
              className="p-1 rounded hover:bg-surface transition-colors"
              style={{ color: '#8b949e' }}
              title="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
