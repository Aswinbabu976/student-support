import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, userFacingAuthMessage } from '../../../services/api/client';
import { verifyStudentEmail } from '../services/auth-api';

export type VerifyView = 'pending' | 'verifying' | 'invalid' | 'expired' | 'success';

const processedTokens = new Set<string>();

export function resetProcessedVerificationTokens(): void {
  processedTokens.clear();
}

export function useVerifyStudentEmail(token: string | null, registeredEmail: string | null) {
  const navigate = useNavigate();
  const [view, setView] = useState<VerifyView>(token ? 'verifying' : 'pending');
  const [email, setEmail] = useState(registeredEmail ?? '');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token || processedTokens.has(token)) {
      return;
    }
    processedTokens.add(token);

    verifyStudentEmail(token)
      .then((result) => {
        setEmail(result.user.email);
        navigate('/verify-email/success', {
          replace: true,
          state: { email: result.user.email },
        });
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.code === 'EXPIRED_VERIFICATION_TOKEN') {
          setView('expired');
        } else {
          setView('invalid');
        }
        setMessage(userFacingAuthMessage(error));
      });
  }, [navigate, token]);

  return { view, email, message };
}
