import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Mail, CheckCircle, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import { gmailApi } from '../../api';
import toast from 'react-hot-toast';

export function GmailSettings() {
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const [intervalMinutes, setIntervalMinutes] = useState(60);
  const [enabled, setEnabled] = useState(false);

  const { data: status, isLoading } = useQuery({
    queryKey: ['gmail-status'],
    queryFn: () => gmailApi.status().then(r => r.data),
  });

  // Sync local state with fetched settings
  useEffect(() => {
    if (status) {
      setEnabled(status.enabled);
      setIntervalMinutes(status.syncIntervalMinutes);
    }
  }, [status]);

  // Handle OAuth redirect params
  useEffect(() => {
    const result = searchParams.get('gmail');
    if (result === 'connected') {
      toast.success('Gmail connected successfully');
      qc.invalidateQueries({ queryKey: ['gmail-status'] });
    } else if (result === 'error') {
      toast.error('Gmail connection failed. Please try again.');
    }
  }, [searchParams, qc]);

  const saveSettings = useMutation({
    mutationFn: () => gmailApi.updateSettings({ enabled, syncIntervalMinutes: intervalMinutes }).then(r => r.data),
    onSuccess: () => {
      toast.success('Gmail sync settings saved');
      qc.invalidateQueries({ queryKey: ['gmail-status'] });
    },
    onError: () => toast.error('Failed to save settings'),
  });

  const sync = useMutation({
    mutationFn: () => gmailApi.triggerSync().then(r => r.data),
    onSuccess: (data) => {
      toast.success(data.message);
      qc.invalidateQueries({ queryKey: ['gmail-status'] });
      qc.invalidateQueries({ queryKey: ['gmail-pending'] });
    },
    onError: () => toast.error('Sync failed'),
  });

  const disconnect = useMutation({
    mutationFn: () => gmailApi.disconnect(),
    onSuccess: () => {
      toast.success('Gmail disconnected');
      qc.invalidateQueries({ queryKey: ['gmail-status'] });
    },
    onError: () => toast.error('Failed to disconnect'),
  });

  const resummarize = useMutation({
    mutationFn: () => gmailApi.resummarize().then(r => r.data),
    onSuccess: (data) => {
      toast.success(data.message);
    },
    onError: () => toast.error('Re-summarize failed'),
  });

  if (isLoading) {
    return <div className="text-sm p-8" style={{ color: '#8b949e' }}>Loading…</div>;
  }

  const isConnected = status?.connected;

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold" style={{ color: '#e6edf3' }}>Gmail Sync</h1>
        <p className="text-sm mt-1" style={{ color: '#8b949e' }}>
          Automatically import emails from known contacts into your review queue.
        </p>
      </div>

      {/* Connection status */}
      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail size={20} style={{ color: isConnected ? '#238636' : '#8b949e' }} />
            <div>
              <div className="text-sm font-medium" style={{ color: '#e6edf3' }}>
                Gmail Account
              </div>
              <div className="text-xs mt-0.5 flex items-center gap-1" style={{ color: isConnected ? '#238636' : '#8b949e' }}>
                {isConnected ? (
                  <><CheckCircle size={11} /> Connected</>
                ) : (
                  <><AlertCircle size={11} /> Not connected</>
                )}
              </div>
            </div>
          </div>
          {isConnected ? (
            <button
              onClick={() => disconnect.mutate()}
              disabled={disconnect.isPending}
              className="text-sm px-3 py-1.5 rounded"
              style={{ color: '#da3633', border: '1px solid #da3633' }}
            >
              Disconnect
            </button>
          ) : (
            <a
              href="/auth/gmail"
              className="btn-primary text-sm"
            >
              Connect Gmail
            </a>
          )}
        </div>
      </div>

      {/* Sync settings */}
      <div className="card p-6">
        <h2 className="text-base font-medium mb-4" style={{ color: '#e6edf3' }}>Auto-Sync Settings</h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium" style={{ color: '#e6edf3' }}>Enable automatic sync</div>
              <div className="text-xs mt-0.5" style={{ color: '#8b949e' }}>
                Periodically check Gmail for emails from known contacts
              </div>
            </div>
            <button
              onClick={() => setEnabled(!enabled)}
              disabled={!isConnected}
              className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
              style={{
                background: enabled && isConnected ? '#c9a84c' : '#30363d',
                opacity: !isConnected ? 0.5 : 1,
                cursor: !isConnected ? 'not-allowed' : 'pointer',
              }}
            >
              <span
                className="inline-block h-3.5 w-3.5 rounded-full transition-transform"
                style={{
                  background: '#fff',
                  transform: enabled && isConnected ? 'translateX(18px)' : 'translateX(2px)',
                }}
              />
            </button>
          </div>

          <div>
            <label className="label">Sync frequency</label>
            <select
              className="input w-auto"
              value={intervalMinutes}
              onChange={e => setIntervalMinutes(Number(e.target.value))}
              disabled={!isConnected || !enabled}
            >
              <option value={15}>Every 15 minutes</option>
              <option value={30}>Every 30 minutes</option>
              <option value={60}>Every hour</option>
              <option value={360}>Every 6 hours</option>
              <option value={1440}>Once a day</option>
            </select>
          </div>

          {status?.lastSyncAt && (
            <div className="text-xs" style={{ color: '#8b949e' }}>
              Last synced: {new Date(status.lastSyncAt).toLocaleString()}
              {status.pendingCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs font-medium"
                  style={{ background: '#c9a84c20', color: '#c9a84c' }}>
                  {status.pendingCount} pending
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-6 pt-4" style={{ borderTop: '1px solid #30363d' }}>
          <button
            onClick={() => sync.mutate()}
            disabled={!isConnected || sync.isPending}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded"
            style={{
              color: '#8b949e',
              border: '1px solid #30363d',
              opacity: !isConnected ? 0.5 : 1,
              cursor: !isConnected ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw size={14} className={sync.isPending ? 'animate-spin' : ''} />
            {sync.isPending ? 'Syncing…' : 'Sync Now'}
          </button>
          <button
            onClick={() => saveSettings.mutate()}
            disabled={saveSettings.isPending}
            className="btn-primary text-sm"
          >
            {saveSettings.isPending ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Re-summarize card */}
      {isConnected && (
        <div className="card p-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium" style={{ color: '#e6edf3' }}>Re-summarize Gmail interactions</div>
              <div className="text-xs mt-0.5" style={{ color: '#8b949e' }}>
                Uses Claude to re-generate summaries for all previously approved Gmail emails.
              </div>
            </div>
            <button
              onClick={() => resummarize.mutate()}
              disabled={resummarize.isPending}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded"
              style={{ color: '#c9a84c', border: '1px solid #c9a84c' }}
            >
              <Sparkles size={14} />
              {resummarize.isPending ? 'Summarizing…' : 'Re-summarize All'}
            </button>
          </div>
        </div>
      )}

      {!isConnected && (
        <p className="text-xs mt-3" style={{ color: '#8b949e' }}>
          Connect your Gmail account to enable automatic sync. You'll need to authorize read-only access.
        </p>
      )}
    </div>
  );
}
