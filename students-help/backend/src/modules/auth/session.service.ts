import type { PrismaClient, UserRole } from '@prisma/client';
import { digestToken, expiryFromNow, generateOpaqueToken } from '../../services/secure-token.js';

export type SessionUser = {
  id: string;
  email: string;
  role: UserRole;
};

type SessionStore = {
  session: {
    create: PrismaClient['session']['create'];
  };
};

export class SessionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly ttlHours: number,
  ) {}

  async createSession(
    userId: string,
    store: SessionStore = this.prisma,
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = generateOpaqueToken();
    const expiresAt = expiryFromNow(this.ttlHours);

    await store.session.create({
      data: {
        userId,
        tokenDigest: digestToken(token),
        expiresAt,
      },
    });

    return { token, expiresAt };
  }

  async authenticate(token: string | undefined): Promise<SessionUser | null> {
    if (!token) {
      return null;
    }

    const record = await this.prisma.session.findUnique({
      where: { tokenDigest: digestToken(token) },
      include: {
        user: {
          select: { id: true, email: true, role: true },
        },
      },
    });

    if (!record || record.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    return record.user;
  }
}
