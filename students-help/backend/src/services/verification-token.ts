import { generateOpaqueToken, digestToken, expiryFromNow } from './secure-token.js';

export const generateVerificationToken = generateOpaqueToken;
export const digestVerificationToken = digestToken;
export const verificationExpiry = expiryFromNow;

export function buildVerificationUrl(appPublicUrl: string, token: string): string {
  const url = new URL('/verify-email', appPublicUrl);
  url.searchParams.set('token', token);
  return url.toString();
}
