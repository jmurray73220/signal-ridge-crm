import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api';
import toast from 'react-hot-toast';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetUrl, setResetUrl] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.forgotPassword(email);
      setSubmitted(true);
      if (res.data.resetUrl) {
        setResetUrl(res.data.resetUrl);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Something went wrong');
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
            Reset Password
          </h1>
          <p className="text-sm mt-1" style={{ color: '#8b949e' }}>Signal Ridge CRM</p>
        </div>

        <div className="rounded-xl p-8" style={{ background: '#161b22', border: '1px solid #30363d' }}>
          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-sm" style={{ color: '#8b949e' }}>
                Enter your email address and we'll generate a password reset link.
              </p>
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  placeholder="you@signalridge.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded font-medium text-sm transition-opacity"
                style={{ background: '#c9a84c', color: '#0d1117', opacity: loading ? 0.7 : 1 }}
              >
                {loading ? 'Generating link…' : 'Generate Reset Link'}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm" style={{ color: '#8b949e' }}>
                A reset link has been generated. Copy and open it to set a new password.
              </p>
              {resetUrl && (
                <div>
                  <label className="label">Reset Link</label>
                  <div
                    className="rounded p-3 text-xs break-all select-all"
                    style={{ background: '#0d1117', color: '#c9a84c', border: '1px solid #30363d' }}
                  >
                    {resetUrl}
                  </div>
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(resetUrl); toast.success('Copied!'); }}
                    className="mt-2 text-xs"
                    style={{ color: '#8b949e' }}
                  >
                    Copy to clipboard
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#8b949e' }}>
          <Link to="/login" style={{ color: '#c9a84c', textDecoration: 'none' }}>Back to Sign In</Link>
        </p>
      </div>
    </div>
  );
}
