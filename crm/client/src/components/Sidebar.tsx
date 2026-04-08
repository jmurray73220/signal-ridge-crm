import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Users,
  Building2,
  Landmark,
  Factory,
  Briefcase,
  Target,
  MessageSquare,
  Bell,
  Mail,
  Tag,
  ChevronLeft,
  ChevronRight,
  LogOut,
  BrainCircuit,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { gmailApi, settingsApi } from '../api';

interface NavItem {
  path: string;
  icon: ReactNode;
  label: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    title: '',
    items: [
      { path: '/', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
      { path: '/contacts', icon: <Users size={18} />, label: 'Contacts' },
    ],
  },
  {
    title: 'Entities',
    items: [
      { path: '/congressional', icon: <Landmark size={18} />, label: 'Congressional' },
      { path: '/government', icon: <Building2 size={18} />, label: 'Government Orgs' },
      { path: '/industry', icon: <Factory size={18} />, label: 'Industry' },
      { path: '/clients', icon: <Briefcase size={18} />, label: 'Clients' },
    ],
  },
  {
    title: 'Activity',
    items: [
      { path: '/initiatives', icon: <Target size={18} />, label: 'Initiatives' },
      { path: '/interactions', icon: <MessageSquare size={18} />, label: 'Interactions' },
      { path: '/reminders', icon: <Bell size={18} />, label: 'Reminders' },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { path: '/budget-analyzer', icon: <BrainCircuit size={18} />, label: 'Budget Analyzer' },
    ],
  },
  {
    title: 'Tools',
    items: [
      { path: '/tags', icon: <Tag size={18} />, label: 'Tags' },
      { path: '/gmail/review', icon: <Mail size={18} />, label: 'Gmail Review' },
    ],
  },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();
  const { user, logout } = useAuth();

  const { data: crmSettings } = useQuery({
    queryKey: ['crm-settings'],
    queryFn: () => settingsApi.get().then(r => r.data),
    enabled: !!user,
  });

  const { data: gmailStatus } = useQuery({
    queryKey: ['gmail-status'],
    queryFn: () => gmailApi.status().then(r => r.data),
    refetchInterval: 60_000,
    enabled: !!user,
  });
  const gmailBadge = gmailStatus?.connected ? (gmailStatus.pendingCount ?? 0) : 0;

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
            {crmSettings?.hasLogo ? (
              <img src={`${settingsApi.logoUrl}?v=1`} alt="Logo" className="h-7 object-contain" />
            ) : (
              <div
                className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold"
                style={{ background: '#c9a84c', color: '#0d1117' }}
              >
                SR
              </div>
            )}
            <span className="text-sm font-semibold" style={{ color: '#e6edf3' }}>
              Signal Ridge
            </span>
          </div>
        )}
        {collapsed && (
          crmSettings?.hasLogo ? (
            <img src={`${settingsApi.logoUrl}?v=1`} alt="Logo" className="h-7 object-contain mx-auto" />
          ) : (
            <div
              className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold mx-auto"
              style={{ background: '#c9a84c', color: '#0d1117' }}
            >
              SR
            </div>
          )
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
        {sections.map((section) => (
          <div key={section.title || '_top'}>
            {section.title && !collapsed && (
              <div className="px-3 py-2 mt-2">
                <span className="text-xs font-medium uppercase tracking-widest" style={{ color: '#8b949e' }}>
                  {section.title}
                </span>
              </div>
            )}
            {section.title && collapsed && <div style={{ borderTop: '1px solid #30363d', margin: '4px 8px' }} />}
            {section.items.map(item => {
              const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
              const hasGmailBadge = item.path === '/gmail/review' && gmailBadge > 0;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  title={collapsed ? item.label : undefined}
                  className="flex items-center gap-3 px-3 py-2 mx-1 rounded transition-colors"
                  style={{
                    color: isActive ? '#c9a84c' : '#8b949e',
                    background: isActive ? 'rgba(201, 168, 76, 0.1)' : 'transparent',
                    textDecoration: 'none',
                  }}
                >
                  <span style={{ flexShrink: 0, position: 'relative' }}>
                    {item.icon}
                    {hasGmailBadge && (
                      <span
                        style={{
                          position: 'absolute',
                          top: -5,
                          right: -6,
                          background: '#c9a84c',
                          color: '#0d1117',
                          borderRadius: '99px',
                          fontSize: 9,
                          fontWeight: 700,
                          minWidth: 14,
                          height: 14,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0 3px',
                        }}
                      >
                        {gmailBadge > 99 ? '99+' : gmailBadge}
                      </span>
                    )}
                  </span>
                  {!collapsed && (
                    <span className="flex items-center gap-2 text-sm font-medium" style={{ flex: 1 }}>
                      {item.label}
                      {hasGmailBadge && (
                        <span
                          className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                          style={{ background: '#c9a84c20', color: '#c9a84c' }}
                        >
                          {gmailBadge}
                        </span>
                      )}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: '1px solid #30363d' }}>
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
        {collapsed && (
          <button
            onClick={() => logout()}
            className="w-full p-2 flex justify-center hover:bg-surface transition-colors"
            style={{ color: '#8b949e' }}
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        )}
      </div>
    </aside>
  );
}
