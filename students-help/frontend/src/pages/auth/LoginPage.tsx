import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthShell } from '../../features/auth/components/AuthShell';
import { PasswordField } from '../../features/auth/components/PasswordField';
import { TextField } from '../../features/auth/components/TextField';
import { login } from '../../features/auth/services/auth-api';
import { userFacingAuthMessage } from '../../services/api/client';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await login({ email, password });
      if (result.user.role === 'HELP_SEEKER') {
        navigate('/help-seeker', { replace: true });
        return;
      }
      if (result.user.role === 'STUDENT') {
        navigate('/student/skills', { replace: true });
        return;
      }
      navigate('/', { replace: true });
    } catch (caught) {
      setPassword('');
      setError(userFacingAuthMessage(caught));
      setSubmitting(false);
    }
  }

  return (
    <AuthShell eyebrow="Log in">
      <section className="panel">
        <h1>Log in</h1>
        <p className="lede">Use the email and password for your Students-Help account.</p>
        <form
          className="form form--spaced"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {error ? (
            <div className="alert alert--error" role="alert" aria-live="assertive">
              {error}
            </div>
          ) : null}
          <TextField
            id="login-email"
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <PasswordField
            id="login-password"
            label="Password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button className="button" type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Log in'}
          </button>
        </form>
        <p className="form-footer">
          Need an account? <Link to="/register/help-seeker">Create a Help Seeker account</Link>
          {' · '}
          <Link to="/register/student">Register as a Student</Link>
        </p>
      </section>
    </AuthShell>
  );
}
