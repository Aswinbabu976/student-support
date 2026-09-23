import { PreferredPaymentMethod, UserRole } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { loadEnv } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import { ErrorCode } from '../../shared/errors.js';

const app = createApp({ env: loadEnv() });

const validRegistration = {
  fullName: 'Alex Example',
  email: 'alex@example.com',
  phone: '+46 70 123 45 67',
  address: 'Example Street 10, 111 22 Stockholm',
  preferredPaymentMethod: 'CARD',
  password: 'securePass12',
};

function uniqueEmail(label: string): string {
  return `${label}.${Date.now()}.${Math.random().toString(16).slice(2)}@example.com`;
}

describe('Help Seeker registration', () => {
  beforeEach(async () => {
    await prisma.session.deleteMany();
    await prisma.unavailablePeriod.deleteMany();
    await prisma.recurringAvailability.deleteMany();
    await prisma.studentSkill.deleteMany();
    await prisma.studentProfile.deleteMany();
    await prisma.taskSkill.deleteMany();
    await prisma.task.deleteMany();
    await prisma.address.deleteMany();
    await prisma.helpSeekerProfile.deleteMany();
    await prisma.emailVerificationToken.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('registers a Help Seeker with profile, address, payment preference, hashed password, and session', async () => {
    const agent = request.agent(app);
    const response = await agent.post('/auth/register/help-seeker').send({
      ...validRegistration,
      email: '  Alex@Example.com ',
    });

    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({
      email: 'alex@example.com',
      role: UserRole.HELP_SEEKER,
    });
    expect(response.body.profile).toMatchObject({
      fullName: 'Alex Example',
      phone: '+46701234567',
      preferredPaymentMethod: PreferredPaymentMethod.CARD,
    });
    expect(response.body.session.expiresAt).toBeTruthy();
    expect(response.body).not.toHaveProperty('sessionToken');
    expect(response.body.user).not.toHaveProperty('password');
    expect(response.body.user).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(response.body)).not.toMatch(/securePass12/);
    const cookies = response.headers['set-cookie'];
    const cookieHeader = Array.isArray(cookies) ? cookies.join('; ') : cookies;
    expect(cookieHeader).toMatch(/students_help_session=/);

    const stored = await prisma.user.findUniqueOrThrow({
      where: { email: 'alex@example.com' },
      include: { helpSeekerProfile: { include: { addresses: true } }, sessions: true },
    });
    expect(stored.role).toBe(UserRole.HELP_SEEKER);
    expect(stored.passwordHash).not.toBe('securePass12');
    expect(stored.passwordHash.startsWith('$2')).toBe(true);
    expect(stored.helpSeekerProfile?.fullName).toBe('Alex Example');
    expect(stored.helpSeekerProfile?.phone).toBe('+46701234567');
    expect(stored.helpSeekerProfile?.preferredPaymentMethod).toBe(PreferredPaymentMethod.CARD);
    expect(stored.helpSeekerProfile?.addresses).toEqual([
      expect.objectContaining({
        addressLine: 'Example Street 10, 111 22 Stockholm',
        isDefault: true,
      }),
    ]);
    expect(stored.sessions).toHaveLength(1);
  });

  it('rejects a duplicate email including a Student account and case variants', async () => {
    await request(app)
      .post('/auth/register/student')
      .send({ email: 'person@tum.de', password: 'securePass12' })
      .expect(201);

    const studentClash = await request(app)
      .post('/auth/register/help-seeker')
      .send({ ...validRegistration, email: 'Person@TUM.de' });
    expect(studentClash.status).toBe(409);
    expect(studentClash.body.code).toBe(ErrorCode.EMAIL_ALREADY_REGISTERED);

    await request(app)
      .post('/auth/register/help-seeker')
      .send({ ...validRegistration, email: 'seeker@example.com' })
      .expect(201);

    const sameCase = await request(app)
      .post('/auth/register/help-seeker')
      .send({ ...validRegistration, email: 'Seeker@Example.com' });
    expect(sameCase.status).toBe(409);
    expect(sameCase.body.code).toBe(ErrorCode.EMAIL_ALREADY_REGISTERED);
    expect(sameCase.body.message).toBe('An account already exists for this email.');
  });

  it('rejects invalid and missing required fields', async () => {
    const invalidEmail = await request(app)
      .post('/auth/register/help-seeker')
      .send({ ...validRegistration, email: 'not-an-email' });
    expect(invalidEmail.status).toBe(400);
    expect(invalidEmail.body.code).toBe(ErrorCode.VALIDATION_ERROR);

    const missingName = await request(app)
      .post('/auth/register/help-seeker')
      .send({ ...validRegistration, fullName: '   ' });
    expect(missingName.status).toBe(400);
    expect(missingName.body.details[0].field).toBe('fullName');

    const missingPhone = await request(app)
      .post('/auth/register/help-seeker')
      .send({ ...validRegistration, phone: '' });
    expect(missingPhone.status).toBe(400);
    expect(missingPhone.body.details[0].field).toBe('phone');

    const missingAddress = await request(app)
      .post('/auth/register/help-seeker')
      .send({ ...validRegistration, address: 'short' });
    expect(missingAddress.status).toBe(400);
    expect(missingAddress.body.details[0].field).toBe('address');
  });

  it('rejects an unsupported payment preference', async () => {
    const response = await request(app)
      .post('/auth/register/help-seeker')
      .send({ ...validRegistration, preferredPaymentMethod: 'CRYPTO' });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe(ErrorCode.INVALID_PAYMENT_METHOD);
  });

  it('ignores a client-supplied ADMIN role', async () => {
    const response = await request(app)
      .post('/auth/register/help-seeker')
      .send({ ...validRegistration, email: uniqueEmail('role'), role: 'ADMIN' });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe(ErrorCode.VALIDATION_ERROR);

    const accepted = await request(app)
      .post('/auth/register/help-seeker')
      .send({ ...validRegistration, email: uniqueEmail('ok-role') });
    expect(accepted.status).toBe(201);
    expect(accepted.body.user.role).toBe(UserRole.HELP_SEEKER);
  });

  it('lets a newly registered Help Seeker access Help Seeker routes and blocks Student and Admin routes', async () => {
    const agent = request.agent(app);
    await agent
      .post('/auth/register/help-seeker')
      .send({ ...validRegistration, email: uniqueEmail('authz') })
      .expect(201);

    const own = await agent.get('/help-seeker/account');
    expect(own.status).toBe(200);
    expect(own.body.user.role).toBe(UserRole.HELP_SEEKER);
    expect(own.body.address.isDefault).toBe(true);

    const studentOnly = await agent.get('/student/account');
    expect(studentOnly.status).toBe(403);
    expect(studentOnly.body.code).toBe(ErrorCode.FORBIDDEN);

    const adminOnly = await agent.get('/admin/account');
    expect(adminOnly.status).toBe(403);
    expect(adminOnly.body.code).toBe(ErrorCode.FORBIDDEN);
  });

  it('rolls back the user when profile creation fails', async () => {
    const email = uniqueEmail('rollback');
    const failingPrisma = prisma.$extends({
      query: {
        helpSeekerProfile: {
          async create() {
            throw new Error('forced profile failure');
          },
        },
      },
    });

    const failingApp = createApp({
      env: loadEnv(),
      prisma: failingPrisma as unknown as typeof prisma,
    });

    const response = await request(failingApp)
      .post('/auth/register/help-seeker')
      .send({ ...validRegistration, email });

    expect(response.status).toBe(500);
    expect(response.body.code).toBe(ErrorCode.REGISTRATION_FAILED);
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
  });
});
