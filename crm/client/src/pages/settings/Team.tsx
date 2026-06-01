import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, UserCheck, UserX, X } from 'lucide-react';
import { usersApi } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import type { UserRole } from '../../types';

const ROLES: UserRole[] = ['Admin', 'Editor', 'Viewer'];

function formatDate(d?: string | null) {
  if (!d) return 'Never';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Add a Signal Ridge team member (employee/intern). Unlike the client-derived
// "Add User" flow, this is manual entry — these people are internal staff, not
// contacts under a CRM Client. The created user has no workflow client scope
// (workflowClientId = null), which is exactly what marks them as internal.
function AddTeamMemberModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [hasCrm, setHasCrm] = useState(true);
  const [crmRole, setCrmRole] = useState<UserRole>('Viewer');
  // Internal team get workflow access as Admin (all clients) or none — the
  // Editor/Viewer roles are client-scoped and don't apply to Signal Ridge staff.
  const [hasWorkflow, setHasWorkflow] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      toast.error('First name, last name, and email are required');
      return;
    }
    if (!hasCrm && !hasWorkflow) {
      toast.error('Pick at least one access type — CRM or Workflow');
      return;
    }
    setLoading(true);
    try {
      await usersApi.create({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        temporaryPassword,
        role: hasCrm ? crmRole : null,
        workflowRole: hasWorkflow ? 'WorkflowAdmin' : null,
        workflowClientId: null,
      });
      toast.success(`${firstName.trim()} added to the team`);
      onSave();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { error?: string } } };
      const status = axiosErr?.response?.status;
      const message = axiosErr?.response?.data?.error;
      if (status === 401) toast.error('Session expired — please log in again');
      else if (status === 403) toast.error('Admin access required');
      else if (status === 409) toast.error('A user with that email already exists');
      else toast.error(message || 'Failed to add team member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-md rounded-xl overflow-hidden" style={{ background: '#1c2333', border: '1px solid #30363d', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #30363d' }}>
          <h2 className="text-base font-semibold" style={{ color: '#e6edf3' }}>Add Team Member</h2>
          <button onClick={onClose} style={{ color: '#8b949e' }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">First name *</label>
              <input className="input" value={firstName} onChange={e => setFirstName(e.target.value)} required autoFocus />
            </div>
            <div>
              <label className="label">Last name *</label>
              <input className="input" value={lastName} onChange={e => setLastName(e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="label">Email *</label>
            <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>

          <div className="pt-2" style={{ borderTop: '1px solid #30363d' }}>
            <div className="text-xs uppercase tracking-wider mb-3" style={{ color: '#8b949e' }}>Access</div>

            <label className="flex items-start gap-2.5 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={hasCrm}
                onChange={e => setHasCrm(e.target.checked)}
                className="mt-0.5"
                style={{ accentColor: '#c9a84c' }}
              />
              <div className="flex-1">
                <div className="text-sm" style={{ color: '#e6edf3' }}>CRM access</div>
                {hasCrm && (
                  <select
                    className="input mt-1.5 text-sm"
                    value={crmRole}
                    onChange={e => setCrmRole(e.target.value as UserRole)}
                  >
                    {ROLES.map(r => <option key={r}>{r}</option>)}
                  </select>
                )}
                <p className="text-xs mt-1" style={{ color: '#8b949e' }}>
                  Admin: full. Editor: add/edit, no delete. Viewer: read-only.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-2.5 mb-1 cursor-pointer">
              <input
                type="checkbox"
                checked={hasWorkflow}
                onChange={e => setHasWorkflow(e.target.checked)}
                className="mt-0.5"
                style={{ accentColor: '#c9a84c' }}
              />
              <div className="flex-1">
                <div className="text-sm" style={{ color: '#e6edf3' }}>Workflow access (Admin — all clients)</div>
                <p className="text-xs mt-1" style={{ color: '#8b949e' }}>
                  Internal staff get full workflow access. Client-scoped roles are managed on the Users page.
                </p>
              </div>
            </label>
          </div>

          <div className="pt-2" style={{ borderTop: '1px solid #30363d' }}>
            <label className="label">Temporary Password *</label>
            <input
              type="password"
              className="input"
              value={temporaryPassword}
              onChange={e => setTemporaryPassword(e.target.value)}
              required
              minLength={8}
            />
            <p className="text-xs mt-1" style={{ color: '#8b949e' }}>User will be required to change this on first login.</p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button
              type="submit"
              disabled={loading || (!hasCrm && !hasWorkflow)}
              className="btn-primary"
            >
              {loading ? 'Adding…' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function Team() {
  const { user: currentUser } = useAuth();
  const qc = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const { data: allMembers = [], isLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: () => usersApi.team().then(r => r.data),
  });

  const members = showInactive ? allMembers : allMembers.filter(u => u.isActive);
  const inactiveCount = allMembers.filter(u => !u.isActive).length;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['team-members'] });
    // Keep the all-users list in sync — a team member is also a user there.
    qc.invalidateQueries({ queryKey: ['users'] });
  };

  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => usersApi.updateRole(id, role),
    onSuccess: () => { invalidate(); toast.success('CRM role updated'); },
    onError: () => toast.error('Failed to update role'),
  });

  const updateWorkflowRole = useMutation({
    mutationFn: ({ id, workflowRole }: { id: string; workflowRole: string | null }) =>
      usersApi.updateWorkflowRole(id, { workflowRole, workflowClientId: null }),
    onSuccess: () => { invalidate(); toast.success('Workflow access updated'); },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to update workflow access');
    },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => usersApi.toggleActive(id, isActive),
    onSuccess: (_, vars) => {
      invalidate();
      toast.success(vars.isActive ? 'Member reactivated' : 'Member deactivated');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to update member');
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: '#e6edf3' }}>Signal Ridge Team</h1>
          <p className="text-sm mt-0.5" style={{ color: '#8b949e' }}>
            {members.length} {showInactive ? 'members' : 'active members'}
            {!showInactive && inactiveCount > 0 && ` · ${inactiveCount} hidden`}
            {' · '}employees &amp; interns (internal staff)
          </p>
        </div>
        <div className="flex items-center gap-3">
          {inactiveCount > 0 && (
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: '#8b949e' }}>
              <input
                type="checkbox"
                checked={showInactive}
                onChange={e => setShowInactive(e.target.checked)}
              />
              Show inactive
            </label>
          )}
          <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus size={14} /> Add Member
          </button>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm" style={{ color: '#8b949e' }}>Loading…</div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: '#8b949e' }}>
            No team members yet. Click “Add Member” to add an employee or intern.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid #30363d' }}>
                {['Name', 'Email', 'CRM Role', 'Workflow', 'Status', 'Last Login', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#8b949e' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid #30363d', opacity: u.isActive ? 1 : 0.5 }}>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium" style={{ color: '#e6edf3' }}>{u.firstName} {u.lastName}</div>
                    {u.id === currentUser?.id && <div className="text-xs" style={{ color: '#c9a84c' }}>You</div>}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: '#8b949e' }}>{u.email}</td>
                  <td className="px-4 py-3">
                    {u.id === currentUser?.id ? (
                      <span className="text-sm" style={{ color: '#8b949e' }}>{u.role || '—'}</span>
                    ) : (
                      <select
                        className="input w-auto text-sm py-1"
                        value={u.role || ''}
                        onChange={e => updateRole.mutate({ id: u.id, role: e.target.value })}
                      >
                        <option value="">None</option>
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {u.id === currentUser?.id ? (
                      <span className="text-sm" style={{ color: '#8b949e' }}>
                        {u.workflowRole === 'WorkflowAdmin' ? 'Admin' : '—'}
                      </span>
                    ) : (
                      <select
                        className="input w-auto text-sm py-1"
                        value={u.workflowRole === 'WorkflowAdmin' ? 'WorkflowAdmin' : ''}
                        onChange={e => updateWorkflowRole.mutate({ id: u.id, workflowRole: e.target.value || null })}
                      >
                        <option value="">None</option>
                        <option value="WorkflowAdmin">Admin</option>
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
                        title={u.isActive ? 'Deactivate member' : 'Reactivate member'}
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
        <AddTeamMemberModal
          onClose={() => setShowAddModal(false)}
          onSave={() => {
            setShowAddModal(false);
            invalidate();
          }}
        />
      )}
    </div>
  );
}
