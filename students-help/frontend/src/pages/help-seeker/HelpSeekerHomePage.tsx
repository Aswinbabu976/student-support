import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthShell } from '../../features/auth/components/AuthShell';
import { getHelpSeekerAccount } from '../../features/auth/services/auth-api';
import { HelpSeekerAccountNav } from '../../features/help-seeker/HelpSeekerAccountNav';
import { PAYMENT_METHOD_LABELS } from '../../features/help-seeker/types';
import type { HelpSeekerAccountResponse } from '../../features/help-seeker/types';
import { ApiError } from '../../services/api/client';

type LocationSeed = {
  user?: { email: string; fullName: string };
};

export function HelpSeekerHomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const seed = (location.state ?? null) as LocationSeed | null;
  const [account, setAccount] = useState<HelpSeekerAccountResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getHelpSeekerAccount()
      .then((value) => {
        if (!cancelled) {
          setAccount(value);
        }
      })
      .catch((caught: unknown) => {
        if (cancelled) {
          return;
        }
        if (caught instanceof ApiError && (caught.status === 401 || caught.status === 403)) {
          if (!seed?.user) {
            navigate('/register/help-seeker', { replace: true });
          }
          return;
        }
        setError('Your account could not be loaded.');
      });
    return () => {
      cancelled = true;
    };
  }, [navigate, seed?.user]);

  return (
    <AuthShell eyebrow="Help Seeker">
      <section className="account-page">
        <HelpSeekerAccountNav />
        <section className="panel status-block">
        <p className="eyebrow">Signed in</p>
        <h1>Your Help Seeker account</h1>
        {error ? (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        ) : null}
        {account ? (
          <>
            <p className="lede">
              {account.profile.fullName} · {account.user.email}
            </p>
            <ul className="note-list">
              <li>Phone: {account.profile.phone}</li>
              <li>
                Default address: {account.address?.addressLine ?? 'Not saved'}
              </li>
              <li>
                Payment preference:{' '}
                {PAYMENT_METHOD_LABELS[account.profile.preferredPaymentMethod]}
              </li>
            </ul>
          </>
        ) : seed?.user ? (
          <p className="lede">
            {seed.user.fullName} · {seed.user.email}
          </p>
        ) : (
          <p className="lede">Loading your account…</p>
        )}
        <p>
          <Link className="button" to="/help-seeker/tasks/create">
            Create a task
          </Link>
        </p>
        <p>
          <Link to="/">Back to Students-Help</Link>
        </p>
      </section>
      </section>
    </AuthShell>
  );
}
