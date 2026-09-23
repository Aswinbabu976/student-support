import type { UserRole } from '@prisma/client';

export {};

declare global {
  namespace Express {
    interface Request {
      auth?: {
        id: string;
        email: string;
        role: UserRole;
      };
    }
  }
}
