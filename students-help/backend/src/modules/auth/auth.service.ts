import { UserRole, VerificationStatus } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { PASSWORD_POLICY } from '../../config/password-policy.js';
import type { EmailService } from '../../services/email/email.service.js';
import type { PasswordHasher } from '../../services/password-hasher.js';
import {
  buildVerificationUrl,
  digestVerificationToken,
  generateVerificationToken,
  verificationExpiry,
} from '../../services/verification-token.js';
import {
  emailAlreadyRegistered,
  expiredVerificationToken,
  invalidCredentials,
  invalidVerificationToken,
  unsupportedUniversityEmail,
} from '../../shared/errors.js';
import { isUniqueConstraintError } from '../../shared/prisma-errors.js';
import type {
  EmailVerificationResult,
  PublicStudentUser,
  RegistrationConfig,
  StudentRegistrationResult,
} from './auth.types.js';
import type { StudentRegistrationInput } from './auth.validation.js';
import { normalizeEmail } from './email.js';
import type { UniversityEmailValidator } from './university-email.js';

type AuthServiceDeps = {
  prisma: PrismaClient;
  passwordHasher: PasswordHasher;
  universityEmailValidator: UniversityEmailValidator;
  emailService: EmailService;
  appPublicUrl: string;
  verificationTokenTtlHours: number;
};

export class AuthService {
  constructor(private readonly deps: AuthServiceDeps) {}

  getRegistrationConfig(): RegistrationConfig {
    return {
      universityEmailDomains: this.deps.universityEmailValidator.listAllowedDomains(),
      passwordPolicy: { ...PASSWORD_POLICY },
      preferredPaymentMethods: ['CARD', 'PAYPAL', 'BANK_TRANSFER'],
    };
  }

  async registerStudent(input: StudentRegistrationInput): Promise<StudentRegistrationResult> {
    const email = this.deps.universityEmailValidator.normalizeEmail(input.email);

    if (!this.deps.universityEmailValidator.isAllowedDomain(email)) {
      throw unsupportedUniversityEmail();
    }

    const existing = await this.deps.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      throw emailAlreadyRegistered();
    }

    const passwordHash = await this.deps.passwordHasher.hash(input.password);
    const rawToken = generateVerificationToken();
    const tokenDigest = digestVerificationToken(rawToken);
    const expiresAt = verificationExpiry(this.deps.verificationTokenTtlHours);

    try {
      const user = await this.deps.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email,
            passwordHash,
            role: UserRole.STUDENT,
            verificationStatus: VerificationStatus.UNVERIFIED,
            studentProfile: { create: {} },
          },
          select: publicStudentSelect,
        });

        await tx.emailVerificationToken.create({
          data: {
            userId: created.id,
            tokenDigest,
            expiresAt,
          },
        });

        return asPublicStudent(created);
      });

      await this.deps.emailService.sendStudentVerificationEmail({
        to: user.email,
        verificationUrl: buildVerificationUrl(this.deps.appPublicUrl, rawToken),
      });

      return {
        user,
        message: 'Registration successful. Verify your university email.',
      };
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw emailAlreadyRegistered();
      }
      throw error;
    }
  }

  async verifyEmail(token: string): Promise<EmailVerificationResult> {
    const tokenDigest = digestVerificationToken(token);
    const record = await this.deps.prisma.emailVerificationToken.findFirst({
      where: { tokenDigest },
      include: {
        user: {
          select: publicStudentSelect,
        },
      },
    });

    if (!record || record.usedAt) {
      throw invalidVerificationToken();
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      throw expiredVerificationToken();
    }

    const user = await this.deps.prisma.$transaction(async (tx) => {
      const consumed = await tx.emailVerificationToken.updateMany({
        where: {
          id: record.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });

      if (consumed.count !== 1) {
        throw invalidVerificationToken();
      }

      return tx.user.update({
        where: { id: record.userId },
        data: { verificationStatus: VerificationStatus.VERIFIED },
        select: publicStudentSelect,
      });
    });

    return {
      user: asPublicStudent(user),
      message: 'University email verified.',
    };
  }

  async verifyCredentials(email: string, password: string): Promise<{
    id: string;
    email: string;
    role: UserRole;
  }> {
    const normalized = normalizeEmail(email);
    const user = await this.deps.prisma.user.findUnique({
      where: { email: normalized },
      select: { id: true, email: true, role: true, passwordHash: true },
    });

    if (!user || !(await this.deps.passwordHasher.compare(password, user.passwordHash))) {
      throw invalidCredentials();
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  }
}

const publicStudentSelect = {
  id: true,
  email: true,
  role: true,
  verificationStatus: true,
} as const;

function asPublicStudent(user: {
  id: string;
  email: string;
  role: UserRole;
  verificationStatus: VerificationStatus;
}): PublicStudentUser {
  if (user.role !== UserRole.STUDENT) {
    throw invalidVerificationToken();
  }

  return {
    id: user.id,
    email: user.email,
    role: UserRole.STUDENT,
    verificationStatus: user.verificationStatus,
  };
}

