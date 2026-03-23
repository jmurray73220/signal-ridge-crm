import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export function ForceChangePassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const { refetchUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await authApi.forceChangePassword(password);
      await refetchUser();
      toast.success('Password set successfully');
      navigate('/', { replace: true });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to set password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: '#0d1117' }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold mx-auto mb-4"
            style={{ background: '#c9a84c', color: '#0d1117' }}
          >
            SR
          </div>
          <h1 className="text-xl font-semibold" style={{ color: '#e6edf3' }}>Set Your Password</h1>
          <p className="text-sm mt-1" style={{ color: '#8b949e' }}>
            You must set a new password before continuing.
          </p>
        </div>
        <div className="rounded-xl p-8" style={{ background: '#161b22', border: '1px solid #30363d' }}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">New Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input"
                placeholder="Minimum 8 characters"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className="input"
                placeholder="Repeat password"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded font-medium text-sm"
              style={{ background: '#c9a84c', color: '#0d1117', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Setting password…' : 'Set Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
