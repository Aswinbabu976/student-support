import { AuthShell } from '../../features/auth/components/AuthShell';
import { StudentRegisterForm } from '../../features/auth/components/StudentRegisterForm';

export function StudentRegisterPage() {
  return (
    <AuthShell>
      <div className="register-layout">
        <section className="register-layout__intro">
          <p className="eyebrow">Student account</p>
          <h1>Register with your university email</h1>
          <p className="lede">
            Students-Help lists short-term help from verified university students. Registration
            starts an unverified account until you confirm your email.
          </p>
          <ul className="note-list">
            <li>Use a supported university email address.</li>
            <li>Your account stays unverified until confirmation.</li>
            <li>A confirmation email is sent after you register.</li>
          </ul>
        </section>
        <section className="panel" aria-labelledby="register-form-heading">
          <h2 id="register-form-heading">Create your account</h2>
          <StudentRegisterForm />
        </section>
      </div>
    </AuthShell>
  );
}
