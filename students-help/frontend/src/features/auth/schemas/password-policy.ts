export const PASSWORD_POLICY = {
  minLength: 10,
  requireLetter: true,
  requireNumber: true,
} as const;

export function getPasswordPolicyMessage(
  policy: { minLength: number; requireLetter: boolean; requireNumber: boolean } = PASSWORD_POLICY,
): string {
  return `Password must be at least ${policy.minLength} characters and include a letter and a number.`;
}

export function isPasswordPolicySatisfied(
  password: string,
  policy: { minLength: number; requireLetter: boolean; requireNumber: boolean } = PASSWORD_POLICY,
): boolean {
  if (password.length < policy.minLength) {
    return false;
  }
  if (policy.requireLetter && !/[A-Za-z]/.test(password)) {
    return false;
  }
  if (policy.requireNumber && !/\d/.test(password)) {
    return false;
  }
  return true;
}
