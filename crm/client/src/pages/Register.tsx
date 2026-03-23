import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../api';
import toast from 'react-hot-toast';

export function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await authApi.register({
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
        password: form.password,
      });
      toast.success('Account created! You can now sign in.');
      navigate('/login');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Registration failed');
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
            Create Account
          </h1>
          <p className="text-sm mt-1" style={{ color: '#8b949e' }}>Signal Ridge CRM</p>
        </div>

        <div className="rounded-xl p-8" style={{ background: '#161b22', border: '1px solid #30363d' }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">First Name</label>
                <input className="input" value={form.firstName} onChange={set('firstName')} required autoFocus />
              </div>
              <div>
                <label className="label">Last Name</label>
                <input className="input" value={form.lastName} onChange={set('lastName')} required />
              </div>
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={form.email} onChange={set('email')} required />
            </div>
            <div>
              <label className="label">Password</label>
              <input type="password" className="input" value={form.password} onChange={set('password')} required minLength={8} placeholder="Min. 8 characters" />
            </div>
            <div>
              <label className="label">Confirm Password</label>
              <input type="password" className="input" value={form.confirm} onChange={set('confirm')} required placeholder="••••••••" />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded font-medium text-sm transition-opacity"
              style={{ background: '#c9a84c', color: '#0d1117', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#8b949e' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#c9a84c', textDecoration: 'none' }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
