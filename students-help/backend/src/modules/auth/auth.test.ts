import { UserRole, VerificationStatus } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { loadEnv } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import { InMemoryEmailAdapter } from '../../services/email/in-memory-email.adapter.js';
import { digestVerificationToken, verificationExpiry } from '../../services/verification-token.js';
import { ErrorCode } from '../../shared/errors.js';

const emailService = new InMemoryEmailAdapter();
const app = createApp({
  env: loadEnv(),
  emailService,
});

function tokenFromLastEmail(): string {
  const message = emailService.lastMessage();
  expect(message).toBeDefined();
  const url = new URL(message!.verificationUrl);
  const token = url.searchParams.get('token');
  expect(token).toBeTruthy();
  return token!;
}

describe('Student registration and email verification', () => {
  beforeEach(async () => {
    emailService.clear();
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

  it('registers a student with a supported university email as UNVERIFIED', async () => {
    const response = await request(app)
      .post('/auth/register/student')
      .send({ email: '  Alex@HS-Heilbronn.de ', password: 'securePass12' });

    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({
      email: 'alex@hs-heilbronn.de',
      role: UserRole.STUDENT,
      verificationStatus: VerificationStatus.UNVERIFIED,
    });
    expect(response.body.message).toMatch(/verify/i);
    expect(response.body.user).not.toHaveProperty('password');
    expect(response.body.user).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(response.body)).not.toMatch(/securePass12/);
    expect(emailService.sent).toHaveLength(1);

    const stored = await prisma.user.findUniqueOrThrow({
      where: { email: 'alex@hs-heilbronn.de' },
    });
    expect(stored.passwordHash).not.toBe('securePass12');
    expect(stored.passwordHash.startsWith('$2')).toBe(true);
    expect(stored.role).toBe(UserRole.STUDENT);
    expect(stored.verificationStatus).toBe(VerificationStatus.UNVERIFIED);
  });

  it('rejects duplicate emails including case variants', async () => {
    await request(app)
      .post('/auth/register/student')
      .send({ email: 'student@tum.de', password: 'securePass12' })
      .expect(201);

    const response = await request(app)
      .post('/auth/register/student')
      .send({ email: 'Student@TUM.de', password: 'anotherPass99' });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe(ErrorCode.EMAIL_ALREADY_REGISTERED);
    expect(response.body.message).toBe('An account already exists for this email.');
  });

  it('rejects an unsupported university domain', async () => {
    const response = await request(app)
      .post('/auth/register/student')
      .send({ email: 'person@gmail.com', password: 'securePass12' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(ErrorCode.UNSUPPORTED_UNIVERSITY_EMAIL);
  });

  it('rejects invalid email syntax', async () => {
    const response = await request(app)
      .post('/auth/register/student')
      .send({ email: 'not-an-email', password: 'securePass12' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it('rejects a password that does not meet policy', async () => {
    const response = await request(app)
      .post('/auth/register/student')
      .send({ email: 'student@tum.de', password: 'short' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(response.body.details[0].field).toBe('password');
  });

  it('ignores client-supplied role and verification status', async () => {
    const response = await request(app)
      .post('/auth/register/student')
      .send({
        email: 'student@uni-stuttgart.de',
        password: 'securePass12',
        role: 'ADMIN',
        verificationStatus: 'VERIFIED',
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(ErrorCode.VALIDATION_ERROR);

    const accepted = await request(app)
      .post('/auth/register/student')
      .send({ email: 'student@uni-stuttgart.de', password: 'securePass12' });

    expect(accepted.status).toBe(201);
    expect(accepted.body.user.role).toBe('STUDENT');
    expect(accepted.body.user.verificationStatus).toBe('UNVERIFIED');
  });

  it('never returns a password hash or raw verification token from registration', async () => {
    const response = await request(app)
      .post('/auth/register/student')
      .send({ email: 'student@tum.de', password: 'securePass12' });

    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toMatch(/passwordHash/);
    expect(serialized).not.toMatch(/tokenDigest/);
    expect(response.body).not.toHaveProperty('token');
  });

  it('verifies a valid token and marks the student VERIFIED', async () => {
    await request(app)
      .post('/auth/register/student')
      .send({ email: 'student@tum.de', password: 'securePass12' })
      .expect(201);

    const token = tokenFromLastEmail();
    const response = await request(app).post('/auth/verify-email').send({ token });

    expect(response.status).toBe(200);
    expect(response.body.user.verificationStatus).toBe(VerificationStatus.VERIFIED);
    expect(response.body.user).not.toHaveProperty('passwordHash');

    const stored = await prisma.user.findUniqueOrThrow({
      where: { email: 'student@tum.de' },
    });
    expect(stored.verificationStatus).toBe(VerificationStatus.VERIFIED);
  });

  it('rejects an expired verification token', async () => {
    await request(app)
      .post('/auth/register/student')
      .send({ email: 'student@tum.de', password: 'securePass12' })
      .expect(201);

    const token = tokenFromLastEmail();
    await prisma.emailVerificationToken.updateMany({
      where: { tokenDigest: digestVerificationToken(token) },
      data: { expiresAt: verificationExpiry(-1) },
    });

    const response = await request(app).post('/auth/verify-email').send({ token });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe(ErrorCode.EXPIRED_VERIFICATION_TOKEN);

    const stored = await prisma.user.findUniqueOrThrow({
      where: { email: 'student@tum.de' },
    });
    expect(stored.verificationStatus).toBe(VerificationStatus.UNVERIFIED);
  });

  it('rejects a used verification token', async () => {
    await request(app)
      .post('/auth/register/student')
      .send({ email: 'student@tum.de', password: 'securePass12' })
      .expect(201);

    const token = tokenFromLastEmail();
    await request(app).post('/auth/verify-email').send({ token }).expect(200);

    const response = await request(app).post('/auth/verify-email').send({ token });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe(ErrorCode.INVALID_VERIFICATION_TOKEN);
  });

  it('rejects an invalid verification token', async () => {
    const response = await request(app).get('/auth/verify-email').query({ token: 'not-a-real-token' });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe(ErrorCode.INVALID_VERIFICATION_TOKEN);
  });
});
