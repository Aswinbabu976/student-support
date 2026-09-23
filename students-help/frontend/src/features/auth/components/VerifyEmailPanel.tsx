import { Link } from 'react-router-dom';
import type { VerifyView } from '../hooks/useVerifyStudentEmail';

type VerifyEmailPanelProps = {
  view: VerifyView;
  email: string;
  message: string | null;
};

export function VerifyEmailPanel({ view, email, message }: VerifyEmailPanelProps) {
  if (view === 'verifying') {
    return (
      <section className="status-block" aria-live="polite">
        <p className="eyebrow">University email</p>
        <h1>Confirming your email</h1>
        <p className="lede">Please wait while we verify your student account.</p>
      </section>
    );
  }

  if (view === 'success') {
    return (
      <section className="status-block">
        <p className="eyebrow">Verified</p>
        <h1>University email confirmed</h1>
        <p className="lede">
          <span className="email-chip">{email || 'Your university email'}</span> is verified. You
          can now continue as a Student.
        </p>
        <div className="alert alert--ok" role="status" aria-live="polite">
          Your account is no longer unverified.
        </div>
      </section>
    );
  }

  if (view === 'expired' || view === 'invalid') {
    return (
      <section className="status-block">
        <p className="eyebrow">Verification</p>
        <h1>{view === 'expired' ? 'This link has expired' : 'This link is invalid'}</h1>
        <p className="lede">
          {message ??
            (view === 'expired'
              ? 'This verification link has expired.'
              : 'This verification link is invalid.')}
        </p>
        <div className="alert alert--error" role="alert" aria-live="assertive">
          Your account stays unverified until a valid confirmation completes.
        </div>
        <p>
          <Link to="/register/student">Return to student registration</Link>
        </p>
      </section>
    );
  }

  return (
    <section className="status-block">
      <p className="eyebrow">Account created</p>
      <h1>Verify your university email</h1>
      <p className="lede">
        We created your Student account for{' '}
        <span className="email-chip">{email || 'your university email'}</span>. It remains
        unverified until you confirm the message we sent.
      </p>
      <ul className="note-list">
        <li>Open the verification link from the email.</li>
        <li>The link expires after a limited time.</li>
        <li>You cannot offer services until verification completes.</li>
      </ul>
    </section>
  );
}
