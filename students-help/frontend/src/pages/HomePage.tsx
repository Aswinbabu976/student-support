import { Link } from 'react-router-dom';
import { AuthShell } from '../features/auth/components/AuthShell';

export function HomePage() {
  return (
    <AuthShell eyebrow="Marketplace">
      <section className="home-intro">
        <p className="eyebrow">Students-Help</p>
        <h1>Short-term local help from university students</h1>
        <p className="lede">
          Students offer help. Help Seekers post tasks. Choose the account that matches how you use
          the marketplace.
        </p>
        <div className="home-actions">
          <Link className="button" to="/register/help-seeker">
            Create a Help Seeker account
          </Link>
          <Link className="button button--quiet" to="/register/student">
            Register as a Student
          </Link>
        </div>
        <p className="form-footer">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </section>
    </AuthShell>
  );
}
