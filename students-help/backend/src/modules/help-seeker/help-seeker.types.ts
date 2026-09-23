import type { PreferredPaymentMethod } from '@prisma/client';

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

export type HelpSeekerAddressView = {
  addressLine: string;
  isDefault: boolean;
};

export type HelpSeekerRegistrationResult = {
  user: PublicHelpSeekerUser;
  profile: HelpSeekerProfileView;
  session: {
    expiresAt: string;
  };
  sessionToken: string;
  message: string;
};

export type HelpSeekerAccountResult = {
  user: PublicHelpSeekerUser;
  profile: HelpSeekerProfileView;
  address: HelpSeekerAddressView | null;
};
