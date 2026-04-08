import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Check, X, RefreshCw, Mail, Settings, ExternalLink, ChevronDown, ChevronRight, Sparkles, UserPlus, Users } from 'lucide-react';
import { gmailApi, contactsApi } from '../api';
import toast from 'react-hot-toast';

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

type Tab = 'pending' | 'approved' | 'dismissed';

export function GmailReview() {
  const [tab, setTab] = useState<Tab>('pending');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addingContactTo, setAddingContactTo] = useState<string | null>(null);
  const [contactSearch, setContactSearch] = useState('');
  const qc = useQueryClient();

  const { data: allContacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => contactsApi.list().then(r => r.data),
  });

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

  const bulkDismiss = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => gmailApi.dismiss(id)));
    },
    onSuccess: () => {
      setSelectedIds(new Set());
      qc.invalidateQueries({ queryKey: ['gmail-pending'] });
      qc.invalidateQueries({ queryKey: ['gmail-status'] });
      toast.success(`${selectedIds.size} emails dismissed`);
    },
    onError: () => toast.error('Failed to dismiss some emails'),
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i: any) => i.id)));
    }
  };

  const rematchContacts = useMutation({
    mutationFn: () => gmailApi.rematchContacts().then(r => r.data),
    onSuccess: (data) => {
      toast.success(data.message);
      qc.invalidateQueries({ queryKey: ['gmail-pending'] });
    },
    onError: () => toast.error('Re-match failed'),
  });

  const updateContacts = useMutation({
    mutationFn: ({ id, contactIds }: { id: string; contactIds: string[] }) =>
      gmailApi.updatePendingContacts(id, contactIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gmail-pending'] });
    },
  });

  const resummarizePending = useMutation({
    mutationFn: () => gmailApi.resummarizePending().then(r => r.data),
    onSuccess: (data) => {
      toast.success(data.message);
      qc.invalidateQueries({ queryKey: ['gmail-pending'] });
    },
    onError: () => toast.error('Re-summarize failed'),
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
            onClick={() => rematchContacts.mutate()}
            disabled={rematchContacts.isPending}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded"
            style={{ color: '#8b949e', border: '1px solid #30363d' }}
          >
            <Users size={14} />
            {rematchContacts.isPending ? 'Matching…' : 'Re-match Contacts'}
          </button>
          <button
            onClick={() => resummarizePending.mutate()}
            disabled={resummarizePending.isPending}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded"
            style={{ color: '#c9a84c', border: '1px solid #c9a84c' }}
          >
            <Sparkles size={14} />
            {resummarizePending.isPending ? 'Summarizing…' : 'Summarize All'}
          </button>
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

      {/* Bulk actions bar */}
      {tab === 'pending' && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-3 p-3 rounded-lg" style={{ background: '#161b22', border: '1px solid #30363d' }}>
          <span className="text-sm" style={{ color: '#e6edf3' }}>{selectedIds.size} selected</span>
          <button
            onClick={() => bulkDismiss.mutate([...selectedIds])}
            disabled={bulkDismiss.isPending}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded"
            style={{ color: '#8b949e', border: '1px solid #30363d' }}
          >
            <X size={12} /> {bulkDismiss.isPending ? 'Dismissing…' : 'Dismiss Selected'}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs"
            style={{ color: '#8b949e' }}
          >
            Clear selection
          </button>
        </div>
      )}

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
                {tab === 'pending' && (
                  <th className="px-3 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={items.length > 0 && selectedIds.size === items.length}
                      onChange={toggleSelectAll}
                      className="rounded"
                      onClick={e => e.stopPropagation()}
                    />
                  </th>
                )}
                {['', 'Date', 'From', 'Subject', 'Contact', ...(tab === 'pending' ? ['Actions'] : [])].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#8b949e' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => {
                const isExpanded = expandedId === item.id;
                const threadUrl = `https://mail.google.com/mail/u/0/#inbox/${item.threadId}`;
                return (
                  <>
                    <tr
                      key={item.id}
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="cursor-pointer transition-colors"
                      style={{ borderBottom: isExpanded ? 'none' : '1px solid #30363d' }}
                    >
                      {tab === 'pending' && (
                        <td className="px-3 py-3 w-8" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item.id)}
                            onChange={() => toggleSelect(item.id)}
                            className="rounded"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3 w-8" style={{ color: '#8b949e' }}>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#8b949e' }}>
                        {formatDate(item.emailDate)}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: '#e6edf3', maxWidth: 160 }}>
                        <div className="truncate">{item.from}</div>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium" style={{ color: '#e6edf3', maxWidth: 240 }}>
                        <div className="truncate">{item.subject}</div>
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: '#8b949e' }}>
                        {(item.matchedContacts?.length > 0) ? (
                          <div className="flex flex-wrap gap-1" onClick={e => e.stopPropagation()}>
                            {item.matchedContacts.map((c: any) => (
                              <Link
                                key={c.id}
                                to={`/contacts/${c.id}`}
                                className="text-xs px-1.5 py-0.5 rounded"
                                style={{ color: '#c9a84c', background: '#c9a84c15', textDecoration: 'none' }}
                              >
                                {c.firstName} {c.lastName}
                              </Link>
                            ))}
                          </div>
                        ) : item.contact ? (
                          <Link
                            to={`/contacts/${item.contact.id}`}
                            style={{ color: '#c9a84c', textDecoration: 'none' }}
                            onClick={e => e.stopPropagation()}
                          >
                            {item.contact.firstName} {item.contact.lastName}
                          </Link>
                        ) : (
                          <span style={{ color: '#8b949e' }}>—</span>
                        )}
                      </td>
                      {tab === 'pending' && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
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
                    {isExpanded && (
                      <tr key={`${item.id}-detail`} style={{ borderBottom: '1px solid #30363d' }}>
                        <td colSpan={tab === 'pending' ? 8 : 5} className="px-4 py-4" style={{ background: '#161b22' }}>
                          <div className="text-sm mb-3" style={{ color: '#e6edf3' }}>
                            <span className="font-medium">From:</span>{' '}
                            <span style={{ color: '#8b949e' }}>{item.from}</span>
                          </div>
                          <div className="text-sm leading-relaxed mb-3" style={{ color: '#8b949e', whiteSpace: 'pre-wrap' }}>
                            {item.snippet || '(no preview available)'}
                          </div>

                          {/* Associated contacts */}
                          <div className="mb-3 pt-3" style={{ borderTop: '1px solid #30363d' }}>
                            <div className="flex items-center gap-2 mb-2">
                              <Users size={13} style={{ color: '#8b949e' }} />
                              <span className="text-xs font-medium uppercase tracking-wider" style={{ color: '#8b949e' }}>Associated Contacts</span>
                            </div>
                            <div className="flex flex-wrap gap-2 items-center">
                              {(item.matchedContacts || []).map((c: any) => (
                                <span key={c.id} className="flex items-center gap-1 text-xs px-2 py-1 rounded" style={{ background: '#c9a84c15', color: '#c9a84c' }}>
                                  {c.firstName} {c.lastName}
                                  {tab === 'pending' && (
                                    <button
                                      onClick={() => {
                                        const ids = (item.matchedContacts || []).map((mc: any) => mc.id).filter((id: string) => id !== c.id);
                                        updateContacts.mutate({ id: item.id, contactIds: ids });
                                      }}
                                      style={{ color: '#da3633', marginLeft: 2 }}
                                      title="Remove"
                                    >×</button>
                                  )}
                                </span>
                              ))}
                              {tab === 'pending' && (
                                addingContactTo === item.id ? (
                                  <div className="flex items-center gap-1">
                                    <select
                                      className="input text-xs py-1"
                                      style={{ width: 180 }}
                                      value=""
                                      onChange={e => {
                                        if (!e.target.value) return;
                                        const existingIds = (item.matchedContacts || []).map((mc: any) => mc.id);
                                        if (!existingIds.includes(e.target.value)) {
                                          updateContacts.mutate({ id: item.id, contactIds: [...existingIds, e.target.value] });
                                        }
                                        setAddingContactTo(null);
                                        setContactSearch('');
                                      }}
                                    >
                                      <option value="">Select contact…</option>
                                      {allContacts
                                        .filter(c => {
                                          const existingIds = (item.matchedContacts || []).map((mc: any) => mc.id);
                                          if (existingIds.includes(c.id)) return false;
                                          if (!contactSearch) return true;
                                          return `${c.firstName} ${c.lastName}`.toLowerCase().includes(contactSearch.toLowerCase());
                                        })
                                        .slice(0, 20)
                                        .map(c => (
                                          <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                                        ))
                                      }
                                    </select>
                                    <button onClick={() => setAddingContactTo(null)} style={{ color: '#8b949e' }}><X size={14} /></button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setAddingContactTo(item.id)}
                                    className="flex items-center gap-1 text-xs px-2 py-1 rounded"
                                    style={{ color: '#8b949e', border: '1px solid #30363d' }}
                                  >
                                    <UserPlus size={12} /> Add
                                  </button>
                                )
                              )}
                            </div>
                          </div>

                          <a
                            href={threadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-sm"
                            style={{ color: '#c9a84c', textDecoration: 'none' }}
                          >
                            <ExternalLink size={13} /> Open full thread in Gmail
                          </a>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
