import { createHash, randomBytes } from 'node:crypto';

export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export function digestToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function expiryFromNow(ttlHours: number, from = new Date()): Date {
  return new Date(from.getTime() + ttlHours * 60 * 60 * 1000);
}
