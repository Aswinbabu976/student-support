import { useLocation, useSearchParams } from 'react-router-dom';
import { AuthShell } from '../../features/auth/components/AuthShell';
import { VerifyEmailPanel } from '../../features/auth/components/VerifyEmailPanel';
import { useVerifyStudentEmail } from '../../features/auth/hooks/useVerifyStudentEmail';

export function VerifyStudentEmailPage({ success = false }: { success?: boolean }) {
  const [params] = useSearchParams();
  const location = useLocation();
  const token = success ? null : params.get('token');
  const registeredEmail =
    params.get('email') ??
    (typeof location.state === 'object' && location.state && 'email' in location.state
      ? String((location.state as { email?: string }).email ?? '')
      : '');
  const verification = useVerifyStudentEmail(token, registeredEmail);

  return (
    <AuthShell eyebrow="Email verification">
      <div className="panel">
        <VerifyEmailPanel
          view={success ? 'success' : verification.view}
          email={success ? registeredEmail || verification.email : verification.email}
          message={verification.message}
        />
      </div>
    </AuthShell>
  );
}
