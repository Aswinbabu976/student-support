import { NavLink } from 'react-router-dom';

export function HelpSeekerAccountNav() {
  return (
    <nav className="account-nav" aria-label="Help Seeker account">
      <NavLink to="/help-seeker" end>
        Account
      </NavLink>
      <NavLink to="/help-seeker/tasks/create">Create task</NavLink>
    </nav>
  );
}
