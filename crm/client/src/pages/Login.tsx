import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const expired = searchParams.get('expired') === 'true';

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (expired) {
      toast.error('Your session has expired. Please sign in again.');
    }
  }, [expired]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const loggedInUser = await login(email, password);
      if (loggedInUser.mustChangePassword) {
        navigate('/change-password', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Invalid credentials';
      toast.error(msg);
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
        {/* Logo / Branding */}
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold mx-auto mb-4"
            style={{ background: '#c9a84c', color: '#0d1117' }}
          >
            SR
          </div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#e6edf3' }}>
            Signal Ridge CRM
          </h1>
          <p className="text-sm mt-1" style={{ color: '#8b949e' }}>
            Signal Ridge Strategies
          </p>
          <p className="text-xs mt-0.5" style={{ color: '#8b949e' }}>
            Government Relations Intelligence Platform
          </p>
        </div>

        {/* Form */}
        <div
          className="rounded-xl p-8"
          style={{ background: '#161b22', border: '1px solid #30363d' }}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input"
                placeholder="you@signalridge.com"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded font-medium text-sm transition-opacity"
              style={{
                background: '#c9a84c',
                color: '#0d1117',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="mt-5 pt-5 flex justify-between" style={{ borderTop: '1px solid #30363d' }}>
            <Link to="/forgot-password" className="text-xs" style={{ color: '#8b949e', textDecoration: 'none' }}>
              Forgot password?
            </Link>
            <Link to="/register" className="text-xs" style={{ color: '#c9a84c', textDecoration: 'none' }}>
              Create account
            </Link>
          </div>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#8b949e' }}>
          Contact your administrator to request access.
        </p>
      </div>
    </div>
  );
}
