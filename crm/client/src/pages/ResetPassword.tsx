import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../api';
import toast from 'react-hot-toast';

export function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [loading, setLoading] = useState(false);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) { toast.error('Invalid reset link'); return; }
    if (form.password !== form.confirm) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    try {
      await authApi.resetPassword(token, form.password);
      toast.success('Password reset successfully');
      navigate('/login');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d1117' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold mx-auto mb-4"
            style={{ background: '#c9a84c', color: '#0d1117' }}
          >
            SR
          </div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#e6edf3' }}>
            Set New Password
          </h1>
          <p className="text-sm mt-1" style={{ color: '#8b949e' }}>Signal Ridge CRM</p>
        </div>

        <div className="rounded-xl p-8" style={{ background: '#161b22', border: '1px solid #30363d' }}>
          {!token ? (
            <p className="text-sm text-center" style={{ color: '#f87171' }}>
              Invalid or missing reset token.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="label">New Password</label>
                <input
                  type="password"
                  className="input"
                  value={form.password}
                  onChange={set('password')}
                  required
                  minLength={8}
                  autoFocus
                  placeholder="Min. 8 characters"
                />
              </div>
              <div>
                <label className="label">Confirm Password</label>
                <input
                  type="password"
                  className="input"
                  value={form.confirm}
                  onChange={set('confirm')}
                  required
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded font-medium text-sm transition-opacity"
                style={{ background: '#c9a84c', color: '#0d1117', opacity: loading ? 0.7 : 1 }}
              >
                {loading ? 'Resetting…' : 'Reset Password'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#8b949e' }}>
          <Link to="/login" style={{ color: '#c9a84c', textDecoration: 'none' }}>Back to Sign In</Link>
        </p>
      </div>
    </div>
  );
}
