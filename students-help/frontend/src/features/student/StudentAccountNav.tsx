import { NavLink } from 'react-router-dom';

export function StudentAccountNav() {
  return (
    <nav className="account-nav" aria-label="Student profile">
      <NavLink to="/student/skills">Skills</NavLink>
      <NavLink to="/student/availability">Availability</NavLink>
    </nav>
  );
}
