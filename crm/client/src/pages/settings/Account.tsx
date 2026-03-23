import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { authApi } from '../../api';
import toast from 'react-hot-toast';

export function Account() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

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
