import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { authApi, settingsApi } from '../../api';
import toast from 'react-hot-toast';

export function Account() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CRM Settings
  const { data: settings } = useQuery({
    queryKey: ['crm-settings'],
    queryFn: () => settingsApi.get().then(r => r.data),
  });

  const [majorityParty, setMajorityParty] = useState('Republican');

  useEffect(() => {
    if (settings?.majorityParty) setMajorityParty(settings.majorityParty);
  }, [settings]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      toast.success('Password updated');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const handleMajorityChange = async (party: string) => {
    setMajorityParty(party);
    try {
      await settingsApi.update({ majorityParty: party });
      qc.invalidateQueries({ queryKey: ['crm-settings'] });
      toast.success(`Majority party set to ${party}`);
    } catch {
      toast.error('Failed to update');
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    const formData = new FormData();
    formData.append('logo', file);
    try {
      await settingsApi.uploadLogo(formData);
      qc.invalidateQueries({ queryKey: ['crm-settings'] });
      qc.invalidateQueries({ queryKey: ['crm-logo'] });
      toast.success('Logo uploaded');
    } catch {
      toast.error('Failed to upload logo');
    }
  };

  const handleDeleteLogo = async () => {
    try {
      await settingsApi.deleteLogo();
      qc.invalidateQueries({ queryKey: ['crm-settings'] });
      qc.invalidateQueries({ queryKey: ['crm-logo'] });
      toast.success('Logo removed');
    } catch {
      toast.error('Failed to remove logo');
    }
  };

  const minorityParty = majorityParty === 'Republican' ? 'Democrat' : 'Republican';

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold mb-6" style={{ color: '#e6edf3' }}>Account Settings</h1>

      <div className="card mb-6">
        <h2 className="text-base font-medium mb-4" style={{ color: '#e6edf3' }}>Profile</h2>
        <div className="text-sm" style={{ color: '#8b949e' }}>
          <p>{user?.firstName} {user?.lastName}</p>
          <p>{user?.email}</p>
          <p>Role: {user?.role}</p>
        </div>
      </div>

      {/* CRM Settings - Admin only */}
      {user?.role === 'Admin' && (
        <>
          <div className="card mb-6">
            <h2 className="text-base font-medium mb-4" style={{ color: '#e6edf3' }}>Congressional Majority</h2>
            <p className="text-sm mb-3" style={{ color: '#8b949e' }}>
              Which party currently holds the majority? This affects how contacts are grouped in initiative views.
            </p>
            <div className="flex gap-3">
              {(['Republican', 'Democrat'] as const).map(party => (
                <button
                  key={party}
                  onClick={() => handleMajorityChange(party)}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: majorityParty === party
                      ? (party === 'Republican' ? 'rgba(248,113,113,0.2)' : 'rgba(96,165,250,0.2)')
                      : 'transparent',
                    color: majorityParty === party
                      ? (party === 'Republican' ? '#f87171' : '#60a5fa')
                      : '#8b949e',
                    border: `1px solid ${majorityParty === party
                      ? (party === 'Republican' ? 'rgba(248,113,113,0.4)' : 'rgba(96,165,250,0.4)')
                      : '#30363d'}`,
                  }}
                >
                  {party}
                </button>
              ))}
            </div>
            <p className="text-xs mt-2" style={{ color: '#8b949e' }}>
              Majority: <strong style={{ color: majorityParty === 'Republican' ? '#f87171' : '#60a5fa' }}>{majorityParty}</strong>
              {' · '}Minority: <strong style={{ color: minorityParty === 'Republican' ? '#f87171' : '#60a5fa' }}>{minorityParty}</strong>
            </p>
          </div>

          <div className="card mb-6">
            <h2 className="text-base font-medium mb-4" style={{ color: '#e6edf3' }}>Company Logo</h2>
            <p className="text-sm mb-3" style={{ color: '#8b949e' }}>
              Upload your logo to personalize the CRM sidebar and client briefing documents.
            </p>
            <div className="flex items-center gap-3">
              {settings?.hasLogo && (
                <img
                  src={`${settingsApi.logoUrl}?t=${Date.now()}`}
                  alt="Company logo"
                  className="h-10 object-contain rounded"
                  style={{ maxWidth: 160, background: '#0d1117', padding: 4 }}
                />
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary flex items-center gap-1.5 text-sm"
              >
                <Upload size={14} /> {settings?.hasLogo ? 'Replace' : 'Upload'} Logo
              </button>
              {settings?.hasLogo && (
                <button
                  onClick={handleDeleteLogo}
                  className="btn-secondary flex items-center gap-1.5 text-sm"
                  style={{ color: '#da3633' }}
                >
                  <Trash2 size={14} /> Remove
                </button>
              )}
            </div>
          </div>
        </>
      )}

      <div className="card">
        <h2 className="text-base font-medium mb-4" style={{ color: '#e6edf3' }}>Change Password</h2>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="label">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className="input"
              required
            />
          </div>
          <div>
            <label className="label">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="input"
              required
              minLength={8}
            />
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="input"
              required
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
