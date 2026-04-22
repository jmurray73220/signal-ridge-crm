import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { User, Users as UsersIcon, Mail, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Tab {
  path: string;
  label: string;
  icon: ReactNode;
  adminOnly?: boolean;
}

const TABS: Tab[] = [
  { path: '/settings/account', label: 'Account', icon: <User size={15} /> },
  { path: '/settings/users', label: 'Users', icon: <UsersIcon size={15} />, adminOnly: true },
  { path: '/settings/gmail', label: 'Gmail', icon: <Mail size={15} /> },
  { path: '/settings/recycle-bin', label: 'Recycle Bin', icon: <Trash2 size={15} />, adminOnly: true },
];

export function SettingsLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const visibleTabs = TABS.filter(t => !t.adminOnly || user?.role === 'Admin');

  return (
    <div>
      <div
        className="flex items-center gap-1 mb-6"
        style={{ borderBottom: '1px solid #30363d' }}
      >
        {visibleTabs.map(tab => {
          const active = pathname === tab.path;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm transition-colors"
              style={{
                color: active ? '#c9a84c' : '#8b949e',
                borderBottom: active ? '2px solid #c9a84c' : '2px solid transparent',
                marginBottom: '-1px',
                textDecoration: 'none',
              }}
            >
              {tab.icon} {tab.label}
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}
