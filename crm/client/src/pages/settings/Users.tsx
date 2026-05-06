import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, UserCheck, UserX, X } from 'lucide-react';
import { usersApi } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import type { UserRole, WorkflowRole } from '../../types';

const ROLES: UserRole[] = ['Admin', 'Editor', 'Viewer'];
const WORKFLOW_ROLES: Array<WorkflowRole | ''> = ['', 'WorkflowAdmin', 'WorkflowEditor', 'WorkflowViewer'];

function wfLabel(r: WorkflowRole | '' | null | undefined) {
  if (!r) return '—';
  return r.replace('Workflow', '');
}

function formatDate(d?: string | null) {
  if (!d) return 'Never';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function AddUserModal({
  onClose,
  onSave,
  workflowClients,
}: {
  onClose: () => void;
  onSave: () => void;
  workflowClients: Array<{ id: string; name: string }>;
}) {
  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ['client-contacts-for-user'],
    queryFn: () => usersApi.clientContacts().then(r => r.data),
  });

  const [contactId, setContactId] = useState('');
  const [hasCrm, setHasCrm] = useState(true);
  const [crmRole, setCrmRole] = useState<UserRole>('Viewer');
  const [hasWorkflow, setHasWorkflow] = useState(false);
  const [workflowRole, setWorkflowRole] = useState<WorkflowRole | ''>('');
  const [workflowClientId, setWorkflowClientId] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const picked = contacts.find(c => c.id === contactId) || null;
  const requiresClient = workflowRole === 'WorkflowEditor' || workflowRole === 'WorkflowViewer';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!picked) {
      toast.error('Pick a CRM contact');
      return;
    }
    if (!hasCrm && !hasWorkflow) {
      toast.error('Pick at least one access type — CRM or Workflow');
      return;
    }
    if (hasWorkflow && !workflowRole) {
      toast.error('Pick a Workflow role');
      return;
    }
    if (hasWorkflow && requiresClient && !workflowClientId) {
      toast.error('Workflow Editor/Viewer needs a Client Space');
      return;
    }
    setLoading(true);
    try {
      await usersApi.create({
        firstName: picked.firstName,
        lastName: picked.lastName,
        email: picked.email,
        temporaryPassword,
        role: hasCrm ? crmRole : null,
        workflowRole: hasWorkflow ? workflowRole : null,
        workflowClientId: hasWorkflow && requiresClient ? workflowClientId : null,
      });
      toast.success(`User ${picked.email} created`);
      onSave();
    } catch (err: unknown) {
      console.error('Create user error:', err);
      const axiosErr = err as { response?: { status?: number; data?: { error?: string } } };
      const status = axiosErr?.response?.status;
      const message = axiosErr?.response?.data?.error;
      if (status === 401) toast.error('Session expired — please log in again');
      else if (status === 403) toast.error('Admin access required');
      else toast.error(message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-md rounded-xl overflow-hidden" style={{ background: '#1c2333', border: '1px solid #30363d', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #30363d' }}>
          <h2 className="text-base font-semibold" style={{ color: '#e6edf3' }}>Add User</h2>
          <button onClick={onClose} style={{ color: '#8b949e' }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">CRM Contact *</label>
            {contactsLoading ? (
              <div className="text-sm" style={{ color: '#8b949e' }}>Loading contacts…</div>
            ) : contacts.length === 0 ? (
              <div className="text-sm" style={{ color: '#8b949e' }}>
                No eligible contacts. Add a CRM contact under a Client entity (with an email) first.
              </div>
            ) : (
              <select
                className="input"
                value={contactId}
                onChange={e => setContactId(e.target.value)}
                required
              >
                <option value="">Select a contact…</option>
                {contacts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName} — {c.entity.name}
                  </option>
                ))}
              </select>
            )}
            <p className="text-xs mt-1" style={{ color: '#8b949e' }}>
              Only contacts working for a CRM Client are eligible. Name and email are pulled from their record.
            </p>
          </div>

          {picked && (
            <div className="rounded p-3" style={{ background: '#0d1117', border: '1px solid #30363d' }}>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs uppercase tracking-wider" style={{ color: '#8b949e' }}>Name</div>
                  <div style={{ color: '#e6edf3' }}>{picked.firstName} {picked.lastName}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider" style={{ color: '#8b949e' }}>Email</div>
                  <div style={{ color: '#e6edf3' }}>{picked.email}</div>
                </div>
                {picked.title && (
                  <div className="col-span-2">
                    <div className="text-xs uppercase tracking-wider" style={{ color: '#8b949e' }}>Title</div>
                    <div style={{ color: '#e6edf3' }}>{picked.title}</div>
                  </div>
                )}
                <div className="col-span-2">
                  <div className="text-xs uppercase tracking-wider" style={{ color: '#8b949e' }}>Client</div>
                  <div style={{ color: '#e6edf3' }}>{picked.entity.name}</div>
                </div>
              </div>
            </div>
          )}

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
                <div className="text-sm" style={{ color: '#e6edf3' }}>Workflow access</div>
                {hasWorkflow && (
                  <>
                    <select
                      className="input mt-1.5 text-sm"
                      value={workflowRole}
                      onChange={e => setWorkflowRole(e.target.value as WorkflowRole | '')}
                    >
                      <option value="">Select a workflow role…</option>
                      <option value="WorkflowAdmin">Workflow Admin (all clients)</option>
                      <option value="WorkflowEditor">Workflow Editor</option>
                      <option value="WorkflowViewer">Workflow Viewer</option>
                    </select>
                    {requiresClient && (
                      <select
                        className="input mt-1.5 text-sm"
                        value={workflowClientId}
                        onChange={e => setWorkflowClientId(e.target.value)}
                        required
                      >
                        <option value="">Select a Client Space…</option>
                        {workflowClients.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    )}
                  </>
                )}
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
              disabled={loading || !picked || (!hasCrm && !hasWorkflow)}
              className="btn-primary"
            >
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
  const [showInactive, setShowInactive] = useState(false);

  const { data: allUsers = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then(r => r.data),
  });

  const users = showInactive ? allUsers : allUsers.filter(u => u.isActive);
  const inactiveCount = allUsers.filter(u => !u.isActive).length;

  const { data: workflowClients = [] } = useQuery({
    queryKey: ['workflow-clients'],
    queryFn: () => usersApi.workflowClients().then(r => r.data),
  });

  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => usersApi.updateRole(id, role),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Role updated'); },
    onError: () => toast.error('Failed to update role'),
  });

  const updateWorkflowRole = useMutation({
    mutationFn: ({ id, workflowRole, workflowClientId }: { id: string; workflowRole: string | null; workflowClientId: string | null }) =>
      usersApi.updateWorkflowRole(id, { workflowRole, workflowClientId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Workflow role updated'); },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to update workflow role');
    },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => usersApi.toggleActive(id, isActive),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(vars.isActive ? 'User reactivated' : 'User deactivated');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to update user');
    },
  });


  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: '#e6edf3' }}>User Management</h1>
          <p className="text-sm mt-0.5" style={{ color: '#8b949e' }}>
            {users.length} {showInactive ? 'users' : 'active users'}
            {!showInactive && inactiveCount > 0 && ` · ${inactiveCount} hidden`}
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
            <Plus size={14} /> Add User
          </button>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm" style={{ color: '#8b949e' }}>Loading…</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid #30363d' }}>
                {['Name', 'Email', 'CRM Role', 'Workflow', 'Client', 'Status', 'Last Login', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#8b949e' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const wfRequiresClient = u.workflowRole === 'WorkflowEditor' || u.workflowRole === 'WorkflowViewer';
                return (
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
                      <select
                        className="input w-auto text-sm py-1"
                        value={u.workflowRole || ''}
                        onChange={e => {
                          const newRole = e.target.value || null;
                          const needsClient = newRole === 'WorkflowEditor' || newRole === 'WorkflowViewer';
                          updateWorkflowRole.mutate({
                            id: u.id,
                            workflowRole: newRole,
                            workflowClientId: needsClient ? (u.workflowClientId || null) : null,
                          });
                        }}
                      >
                        {WORKFLOW_ROLES.map(r => (
                          <option key={r || 'none'} value={r}>{r ? wfLabel(r) : 'None'}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {wfRequiresClient ? (
                        <select
                          className="input w-auto text-sm py-1"
                          value={u.workflowClientId || ''}
                          onChange={e => updateWorkflowRole.mutate({
                            id: u.id,
                            workflowRole: u.workflowRole || null,
                            workflowClientId: e.target.value || null,
                          })}
                        >
                          <option value="">— select —</option>
                          {workflowClients.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-sm" style={{ color: '#8b949e' }}>
                          {u.workflowRole === 'WorkflowAdmin' ? 'All clients' : '—'}
                        </span>
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
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showAddModal && (
        <AddUserModal
          workflowClients={workflowClients}
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
