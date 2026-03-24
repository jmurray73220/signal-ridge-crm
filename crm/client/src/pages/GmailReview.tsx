import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Check, X, RefreshCw, Mail, Settings } from 'lucide-react';
import { gmailApi } from '../api';
import toast from 'react-hot-toast';

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

type Tab = 'pending' | 'approved' | 'dismissed';

export function GmailReview() {
  const [tab, setTab] = useState<Tab>('pending');
  const qc = useQueryClient();

  const { data: statusData } = useQuery({
    queryKey: ['gmail-status'],
    queryFn: () => gmailApi.status().then(r => r.data),
    refetchInterval: 30_000,
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['gmail-pending', tab],
    queryFn: () => gmailApi.pending(tab).then(r => r.data),
  });

  const sync = useMutation({
    mutationFn: () => gmailApi.triggerSync().then(r => r.data),
    onSuccess: (data) => {
      toast.success(data.message);
      qc.invalidateQueries({ queryKey: ['gmail-pending'] });
      qc.invalidateQueries({ queryKey: ['gmail-status'] });
    },
    onError: () => toast.error('Sync failed'),
  });

  const approve = useMutation({
    mutationFn: (id: string) => gmailApi.approve(id),
    onSuccess: () => {
      toast.success('Email imported as interaction');
      qc.invalidateQueries({ queryKey: ['gmail-pending'] });
      qc.invalidateQueries({ queryKey: ['gmail-status'] });
    },
    onError: () => toast.error('Failed to approve'),
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => gmailApi.dismiss(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gmail-pending'] });
      qc.invalidateQueries({ queryKey: ['gmail-status'] });
    },
    onError: () => toast.error('Failed to dismiss'),
  });

  if (!statusData?.connected) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Mail size={40} style={{ color: '#8b949e' }} />
        <p className="text-sm" style={{ color: '#8b949e' }}>Gmail is not connected.</p>
        <Link to="/settings/gmail" className="btn-primary text-sm">
          Connect Gmail
        </Link>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'pending', label: `Pending Review${statusData?.pendingCount ? ` (${statusData.pendingCount})` : ''}` },
    { key: 'approved', label: 'Approved' },
    { key: 'dismissed', label: 'Dismissed' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: '#e6edf3' }}>Gmail Review Queue</h1>
          {statusData?.lastSyncAt && (
            <p className="text-sm mt-0.5" style={{ color: '#8b949e' }}>
              Last synced {formatDate(statusData.lastSyncAt)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/settings/gmail"
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded"
            style={{ color: '#8b949e', border: '1px solid #30363d' }}
          >
            <Settings size={14} /> Settings
          </Link>
          <button
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
            className="btn-primary flex items-center gap-1.5 text-sm"
          >
            <RefreshCw size={14} className={sync.isPending ? 'animate-spin' : ''} />
            {sync.isPending ? 'Syncing…' : 'Sync Now'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4" style={{ borderBottom: '1px solid #30363d' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-4 py-2 text-sm font-medium transition-colors"
            style={{
              color: tab === t.key ? '#c9a84c' : '#8b949e',
              borderBottom: tab === t.key ? '2px solid #c9a84c' : '2px solid transparent',
              background: 'transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm" style={{ color: '#8b949e' }}>Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <Mail size={32} className="mx-auto mb-3" style={{ color: '#8b949e' }} />
            <p className="text-sm" style={{ color: '#8b949e' }}>
              {tab === 'pending' ? 'No emails pending review. Run a sync to check for new emails.' : `No ${tab} emails.`}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid #30363d' }}>
                {['Date', 'From', 'Subject', 'Contact', 'Snippet', ...(tab === 'pending' ? ['Actions'] : [])].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#8b949e' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #30363d' }}>
                  <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#8b949e' }}>
                    {formatDate(item.emailDate)}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: '#e6edf3', maxWidth: 160 }}>
                    <div className="truncate">{item.from}</div>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: '#e6edf3', maxWidth: 200 }}>
                    <div className="truncate">{item.subject}</div>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: '#8b949e' }}>
                    {item.contact ? (
                      <Link to={`/contacts/${item.contact.id}`} style={{ color: '#c9a84c', textDecoration: 'none' }}>
                        {item.contact.firstName} {item.contact.lastName}
                      </Link>
                    ) : (
                      <span style={{ color: '#8b949e' }}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: '#8b949e', maxWidth: 240 }}>
                    <div className="truncate">{item.snippet}</div>
                  </td>
                  {tab === 'pending' && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => approve.mutate(item.id)}
                          disabled={approve.isPending}
                          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded transition-colors"
                          style={{ background: '#0f2d0f', color: '#238636', border: '1px solid #238636' }}
                          title="Import as interaction"
                        >
                          <Check size={12} /> Approve
                        </button>
                        <button
                          onClick={() => dismiss.mutate(item.id)}
                          disabled={dismiss.isPending}
                          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded transition-colors"
                          style={{ color: '#8b949e', border: '1px solid #30363d' }}
                          title="Dismiss"
                        >
                          <X size={12} /> Dismiss
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
