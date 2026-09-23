import { Link } from 'react-router-dom';
import { PasswordField } from '../../auth/components/PasswordField';
import { SelectField } from '../../auth/components/SelectField';
import { TextField } from '../../auth/components/TextField';
import { useRegistrationConfig } from '../../auth/hooks/useRegistrationConfig';
import { getPasswordPolicyMessage } from '../../auth/schemas/password-policy';
import { useHelpSeekerRegister } from '../hooks/useHelpSeekerRegister';
import { PAYMENT_METHOD_LABELS, PREFERRED_PAYMENT_METHODS } from '../types';

export function HelpSeekerRegisterForm() {
  const config = useRegistrationConfig();
  const form = useHelpSeekerRegister();
  const methods = config?.preferredPaymentMethods?.length
    ? config.preferredPaymentMethods
    : [...PREFERRED_PAYMENT_METHODS];

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

      <fieldset className="form-section">
        <legend>Account</legend>
        <TextField
          id="full-name"
          label="Full name"
          name="name"
          autoComplete="name"
          value={form.fullName}
          onChange={(event) => form.patch('fullName', event.target.value)}
          error={form.fieldErrors.fullName}
        />
        <TextField
          id="email"
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          value={form.email}
          onChange={(event) => form.patch('email', event.target.value)}
          error={form.fieldErrors.email}
        />
        <PasswordField
          id="password"
          name="password"
          label="Password"
          value={form.password}
          onChange={(event) => form.patch('password', event.target.value)}
          error={form.fieldErrors.password}
          hint={getPasswordPolicyMessage(config?.passwordPolicy)}
        />
        <PasswordField
          id="confirm-password"
          name="confirmPassword"
          label="Confirm password"
          value={form.confirmPassword}
          onChange={(event) => form.patch('confirmPassword', event.target.value)}
          error={form.fieldErrors.confirmPassword}
        />
      </fieldset>

      <fieldset className="form-section">
        <legend>Contact</legend>
        <TextField
          id="phone"
          label="Phone number"
          type="tel"
          name="phone"
          autoComplete="tel"
          inputMode="tel"
          value={form.phone}
          onChange={(event) => form.patch('phone', event.target.value)}
          error={form.fieldErrors.phone}
          hint="Include a country code when possible."
        />
      </fieldset>

      <fieldset className="form-section">
        <legend>Default task address</legend>
        <TextField
          id="address"
          label="Address"
          name="address"
          autoComplete="street-address"
          value={form.address}
          onChange={(event) => form.patch('address', event.target.value)}
          error={form.fieldErrors.address}
          hint="Street, postal code, and city. This is a default location, not a payment detail."
        />
      </fieldset>

      <fieldset className="form-section">
        <legend>Payment preference</legend>
        <SelectField
          id="payment-method"
          label="Preferred payment method"
          name="preferredPaymentMethod"
          value={form.preferredPaymentMethod}
          onChange={(event) => form.patch('preferredPaymentMethod', event.target.value)}
          error={form.fieldErrors.preferredPaymentMethod}
          hint="This is a preference only. Card numbers and account credentials are not collected."
        >
          <option value="">Select a method</option>
          {methods.map((method) => (
            <option key={method} value={method}>
              {PAYMENT_METHOD_LABELS[method]}
            </option>
          ))}
        </SelectField>
      </fieldset>

      <button className="button" type="submit" disabled={form.submitting}>
        {form.submitting ? 'Creating account…' : 'Create account'}
      </button>

      <p className="form-footer">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </form>
  );
}
