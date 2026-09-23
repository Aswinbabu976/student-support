import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type AuthShellProps = {
  children: ReactNode;
  eyebrow?: string;
};

export function AuthShell({ children, eyebrow = 'Student registration' }: AuthShellProps) {
  return (
    <div className="auth-shell">
      <header className="auth-shell__bar">
        <Link className="auth-shell__mark" to="/">
          Students-Help
        </Link>
        <p className="auth-shell__meta">{eyebrow}</p>
      </header>
      <main className="auth-shell__main">{children}</main>
      <footer className="auth-shell__footer">University student marketplace</footer>
    </div>
  );
}
