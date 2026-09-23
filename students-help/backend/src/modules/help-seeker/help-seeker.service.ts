import { UserRole } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import type { PasswordHasher } from '../../services/password-hasher.js';
import { AppError, emailAlreadyRegistered, registrationFailed } from '../../shared/errors.js';
import { isUniqueConstraintError } from '../../shared/prisma-errors.js';
import { normalizeEmail } from '../auth/email.js';
import type { SessionService } from '../auth/session.service.js';
import type {
  HelpSeekerAccountResult,
  HelpSeekerRegistrationResult,
  PublicHelpSeekerUser,
} from './help-seeker.types.js';
import type { HelpSeekerRegistrationInput } from './help-seeker.validation.js';

type HelpSeekerServiceDeps = {
  prisma: PrismaClient;
  passwordHasher: PasswordHasher;
  sessionService: SessionService;
};

export class HelpSeekerService {
  constructor(private readonly deps: HelpSeekerServiceDeps) {}

  async register(input: HelpSeekerRegistrationInput): Promise<HelpSeekerRegistrationResult> {
    const email = normalizeEmail(input.email);

    const existing = await this.deps.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      throw emailAlreadyRegistered();
    }

    const passwordHash = await this.deps.passwordHasher.hash(input.password);

    try {
      const created = await this.deps.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            passwordHash,
            role: UserRole.HELP_SEEKER,
          },
          select: { id: true, email: true, role: true },
        });

        const profile = await tx.helpSeekerProfile.create({
          data: {
            userId: user.id,
            fullName: input.fullName,
            phone: input.phone,
            preferredPaymentMethod: input.preferredPaymentMethod,
            addresses: {
              create: {
                addressLine: input.address,
                isDefault: true,
              },
            },
          },
          select: {
            fullName: true,
            phone: true,
            preferredPaymentMethod: true,
          },
        });

        const session = await this.deps.sessionService.createSession(user.id, tx);

        return { user: asPublicHelpSeeker(user), profile, session };
      });

      return {
        user: created.user,
        profile: created.profile,
        session: { expiresAt: created.session.expiresAt.toISOString() },
        sessionToken: created.session.token,
        message: 'Help Seeker account created.',
      };
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw emailAlreadyRegistered();
      }
      if (error instanceof AppError) {
        throw error;
      }
      throw registrationFailed();
    }
  }

  async getAccount(userId: string): Promise<HelpSeekerAccountResult> {
    const user = await this.deps.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        helpSeekerProfile: {
          select: {
            fullName: true,
            phone: true,
            preferredPaymentMethod: true,
            addresses: {
              where: { isDefault: true },
              take: 1,
              select: { addressLine: true, isDefault: true },
            },
          },
        },
      },
    });

    const profile = user.helpSeekerProfile;
    return {
      user: asPublicHelpSeeker(user),
      profile: {
        fullName: profile?.fullName ?? '',
        phone: profile?.phone ?? '',
        preferredPaymentMethod: profile?.preferredPaymentMethod ?? 'CARD',
      },
      address: profile?.addresses[0] ?? null,
    };
  }
}

function asPublicHelpSeeker(user: {
  id: string;
  email: string;
  role: UserRole;
}): PublicHelpSeekerUser {
  if (user.role !== UserRole.HELP_SEEKER) {
    throw registrationFailed();
  }

  return {
    id: user.id,
    email: user.email,
    role: UserRole.HELP_SEEKER,
  };
}
