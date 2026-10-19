import { useState } from 'react';
import { useAuth } from '../auth.jsx';

const DEMO = [
  ['admin@oasbay.ug', 'admin123', 'Administrator'],
  ['senior@oasbay.ug', 'senior123', 'Senior technician'],
  ['reception@oasbay.ug', 'reception123', 'Receptionist'],
];

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-logo">OAS</div>
          <div>
            <h1>Oyera Auto Service Bay</h1>
            <p>Records Management System</p>
          </div>
        </div>

        <form onSubmit={submit}>
          {error && <div className="alert alert-error">{error}</div>}
          <label className="field">
            <span className="field-label">Email</span>
            <input
              className="input"
              type="email"
              autoComplete="username"
              value={email}
              placeholder="you@oasbay.ug"
              required
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field" style={{ marginTop: 12 }}>
            <span className="field-label">Password</span>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              placeholder="••••••••"
              required
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}
            disabled={busy}
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="login-demo">
          <span className="field-label">Demo accounts</span>
          {DEMO.map(([mail, pass, role]) => (
            <button
              key={mail}
              type="button"
              className="demo-line"
              onClick={() => {
                setEmail(mail);
                setPassword(pass);
                setError('');
              }}
            >
              <code>{mail}</code> · <code>{pass}</code>
              <span className="muted"> → {role}</span>
            </button>
          ))}
          <p className="muted small">Click an account to fill the form.</p>
        </div>
      </div>
    </div>
  );
}
