import { AuthShell } from '../../features/auth/components/AuthShell';
import { HelpSeekerRegisterForm } from '../../features/help-seeker/components/HelpSeekerRegisterForm';

export function HelpSeekerRegisterPage() {
  return (
    <AuthShell eyebrow="Help Seeker registration">
      <div className="register-layout">
        <section className="register-layout__intro">
          <p className="eyebrow">Help Seeker account</p>
          <h1>Create your Help Seeker account</h1>
          <p className="lede">
            Create tasks, find suitable Students, and manage bookings from one account.
          </p>
        </section>
        <section className="panel" aria-labelledby="help-seeker-form-heading">
          <h2 id="help-seeker-form-heading">Account details</h2>
          <HelpSeekerRegisterForm />
        </section>
      </div>
    </AuthShell>
  );
}
