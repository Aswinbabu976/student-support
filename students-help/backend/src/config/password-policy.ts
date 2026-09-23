export const PASSWORD_POLICY = {
  minLength: 10,
  requireLetter: true,
  requireNumber: true,
} as const;

export function getPasswordPolicyMessage(): string {
  return `Password must be at least ${PASSWORD_POLICY.minLength} characters and include a letter and a number.`;
}

export function isPasswordPolicySatisfied(password: string): boolean {
  if (password.length < PASSWORD_POLICY.minLength) {
    return false;
  }
  if (PASSWORD_POLICY.requireLetter && !/[A-Za-z]/.test(password)) {
    return false;
  }
  if (PASSWORD_POLICY.requireNumber && !/\d/.test(password)) {
    return false;
  }
  return true;
}
