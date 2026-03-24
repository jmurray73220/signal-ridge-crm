import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, UserCheck, UserX } from 'lucide-react';
import { usersApi } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import type { UserRole } from '../../types';

const ROLES: UserRole[] = ['Admin', 'Editor', 'Viewer'];

function formatDate(d?: string | null) {
  if (!d) return 'Never';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function AddUserModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', role: 'Viewer' as UserRole, temporaryPassword: '' });
  const [loading, setLoading] = useState(false);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await usersApi.create(form);
      toast.success(`User ${form.email} created`);
      onSave();
    } catch (err: unknown) {
      console.error('Create user error:', err);
      const axiosErr = err as { response?: { status?: number; data?: { error?: string } } };
      const status = axiosErr?.response?.status;
      const message = axiosErr?.response?.data?.error;
      if (status === 401) {
        toast.error('Session expired — please log in again');
      } else if (status === 403) {
        toast.error('Admin access required');
      } else {
        toast.error(message || 'Failed to create user');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-md rounded-xl overflow-hidden" style={{ background: '#1c2333', border: '1px solid #30363d' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #30363d' }}>
          <h2 className="text-base font-semibold" style={{ color: '#e6edf3' }}>Add User</h2>
          <button onClick={onClose} style={{ color: '#8b949e' }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">First Name *</label>
              <input className="input" value={form.firstName} onChange={set('firstName')} required />
            </div>
            <div>
              <label className="label">Last Name *</label>
              <input className="input" value={form.lastName} onChange={set('lastName')} required />
            </div>
          </div>
          <div>
            <label className="label">Email *</label>
            <input type="email" className="input" value={form.email} onChange={set('email')} required />
          </div>
          <div>
            <label className="label">Role *</label>
            <select className="input" value={form.role} onChange={set('role')}>
              {ROLES.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Temporary Password *</label>
            <input type="password" className="input" value={form.temporaryPassword} onChange={set('temporaryPassword')} required minLength={8} />
            <p className="text-xs mt-1" style={{ color: '#8b949e' }}>User will be required to change this on first login.</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function Users() {
  const { user: currentUser } = useAuth();
  const qc = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then(r => r.data),
  });

  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => usersApi.updateRole(id, role),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Role updated'); },
    onError: () => toast.error('Failed to update role'),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => usersApi.toggleActive(id, isActive),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(vars.isActive ? 'User reactivated' : 'User deactivated');
    },
    onError: (err: unknown) => {
      const message = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      toast.error(message || 'Failed to update user');
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: '#e6edf3' }}>User Management</h1>
          <p className="text-sm mt-0.5" style={{ color: '#8b949e' }}>{users.length} users</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-1.5 text-sm">
          <Plus size={14} /> Add User
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm" style={{ color: '#8b949e' }}>Loading…</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid #30363d' }}>
                {['Name', 'Email', 'Role', 'Status', 'Last Login', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#8b949e' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid #30363d', opacity: u.isActive ? 1 : 0.5 }}>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium" style={{ color: '#e6edf3' }}>{u.firstName} {u.lastName}</div>
                    {u.id === currentUser?.id && <div className="text-xs" style={{ color: '#c9a84c' }}>You</div>}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: '#8b949e' }}>{u.email}</td>
                  <td className="px-4 py-3">
                    {u.id === currentUser?.id ? (
                      <span className="text-sm" style={{ color: '#8b949e' }}>{u.role}</span>
                    ) : (
                      <select
                        className="input w-auto text-sm py-1"
                        value={u.role}
                        onChange={e => updateRole.mutate({ id: u.id, role: e.target.value })}
                      >
                        {ROLES.map(r => <option key={r}>{r}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="badge"
                      style={{
                        background: u.isActive ? '#0f2d0f' : '#2d0f0f',
                        color: u.isActive ? '#238636' : '#da3633',
                      }}
                    >
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: '#8b949e' }}>{formatDate(u.lastLogin)}</td>
                  <td className="px-4 py-3">
                    {u.id !== currentUser?.id && (
                      <button
                        onClick={() => toggleActive.mutate({ id: u.id, isActive: !u.isActive })}
                        className="flex items-center gap-1.5 text-xs hover:opacity-80"
                        style={{ color: u.isActive ? '#da3633' : '#238636' }}
                        title={u.isActive ? 'Deactivate user' : 'Reactivate user'}
                      >
                        {u.isActive ? <><UserX size={14} /> Deactivate</> : <><UserCheck size={14} /> Reactivate</>}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAddModal && (
        <AddUserModal
          onClose={() => setShowAddModal(false)}
          onSave={() => {
            setShowAddModal(false);
            qc.invalidateQueries({ queryKey: ['users'] });
          }}
        />
      )}
    </div>
  );
}
