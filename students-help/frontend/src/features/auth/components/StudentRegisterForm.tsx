import { getPasswordPolicyMessage } from '../schemas/student-register';
import { useRegistrationConfig } from '../hooks/useRegistrationConfig';
import { useStudentRegister } from '../hooks/useStudentRegister';
import { PasswordField } from './PasswordField';
import { TextField } from './TextField';

export function StudentRegisterForm() {
  const config = useRegistrationConfig();
  const form = useStudentRegister();
  const passwordHint = getPasswordPolicyMessage(config?.passwordPolicy);

  return (
    <form
      className="form"
      noValidate
      aria-busy={form.submitting}
      onSubmit={(event) => {
        event.preventDefault();
        void form.submit();
      }}
    >
      {form.formError ? (
        <div className="alert alert--error" role="alert" aria-live="assertive">
          {form.formError}
        </div>
      ) : null}

      <TextField
        id="university-email"
        label="University email"
        type="email"
        name="email"
        autoComplete="email"
        inputMode="email"
        value={form.email}
        onChange={(event) => form.setEmail(event.target.value)}
        error={form.fieldErrors.email}
        hint={
          config?.universityEmailDomains.length ? (
            <>
              Use an email from a supported university domain.
              <ul className="domain-list">
                {config.universityEmailDomains.map((domain) => (
                  <li key={domain}>{domain}</li>
                ))}
              </ul>
            </>
          ) : (
            'Use an email from a supported university domain.'
          )
        }
      />

      <PasswordField
        id="password"
        name="password"
        label="Password"
        value={form.password}
        onChange={(event) => form.setPassword(event.target.value)}
        error={form.fieldErrors.password}
        hint={passwordHint}
      />

      <PasswordField
        id="confirm-password"
        name="confirmPassword"
        label="Confirm password"
        value={form.confirmPassword}
        onChange={(event) => form.setConfirmPassword(event.target.value)}
        error={form.fieldErrors.confirmPassword}
      />

      <button className="button" type="submit" disabled={form.submitting}>
        {form.submitting ? 'Creating account…' : 'Create student account'}
      </button>
    </form>
  );
}
