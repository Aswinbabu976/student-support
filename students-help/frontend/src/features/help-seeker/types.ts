export const PREFERRED_PAYMENT_METHODS = ['CARD', 'PAYPAL', 'BANK_TRANSFER'] as const;

export type PreferredPaymentMethod = (typeof PREFERRED_PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PreferredPaymentMethod, string> = {
  CARD: 'Card',
  PAYPAL: 'PayPal',
  BANK_TRANSFER: 'Bank transfer',
};

export type PublicHelpSeekerUser = {
  id: string;
  email: string;
  role: 'HELP_SEEKER';
};

export type HelpSeekerProfileView = {
  fullName: string;
  phone: string;
  preferredPaymentMethod: PreferredPaymentMethod;
};

export type HelpSeekerRegistrationResponse = {
  user: PublicHelpSeekerUser;
  profile: HelpSeekerProfileView;
  session: { expiresAt: string };
  message: string;
};

export type HelpSeekerAccountResponse = {
  user: PublicHelpSeekerUser;
  profile: HelpSeekerProfileView;
  address: { addressLine: string; isDefault: boolean } | null;
};
