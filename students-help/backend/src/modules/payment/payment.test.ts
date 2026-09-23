import {
  BookingStatus,
  DayOfWeek,
  ExperienceLevel,
  VerificationStatus,
} from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { loadEnv } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import { ErrorCode } from '../../shared/errors.js';
import { ensureSkillCatalog } from '../skills/skill-catalog.js';

const app = createApp({ env: loadEnv() });
const password = 'securePass12';

function uniqueLocal(label: string): string {
  return `${label}.${Date.now()}.${Math.random().toString(16).slice(2)}`;
}

async function registerHelpSeeker(email = `${uniqueLocal('seeker')}@example.com`) {
  const agent = request.agent(app);
  const response = await agent.post('/auth/register/help-seeker').send({
    fullName: 'Alex Example',
    email,
    phone: '+46701234567',
    address: 'Marienplatz 1, 80331 Munich',
    preferredPaymentMethod: 'CARD',
    password,
  });
  expect(response.status).toBe(201);
  return { agent, email };
}

async function createVerifiedStudent(email: string) {
  await request(app).post('/auth/register/student').send({ email, password }).expect(201);
  const user = await prisma.user.update({
    where: { email },
    data: { verificationStatus: VerificationStatus.VERIFIED },
    select: { id: true, studentProfile: { select: { id: true } } },
  });
  return { userId: user.id, profileId: user.studentProfile!.id, email };
}

async function addSkill(profileId: string, skillId: string) {
  await prisma.studentSkill.create({
    data: { studentProfileId: profileId, skillId, experienceLevel: ExperienceLevel.ADVANCED },
  });
}

async function addDayAvailability(profileId: string, endTime = '18:00') {
  await prisma.studentProfile.update({
    where: { id: profileId },
    data: { timezone: 'Europe/Stockholm' },
  });
  await prisma.recurringAvailability.create({
    data: {
      studentProfileId: profileId,
      dayOfWeek: DayOfWeek.WEDNESDAY,
      startTime: '09:00',
      endTime,
      isActive: true,
    },
  });
}

async function catalog(slug: string) {
  return prisma.skill.findUniqueOrThrow({ where: { slug }, select: { id: true } });
}

function taskPayload(skillIds: string[], preferredTime = '10:00', duration = 180) {
  return {
    title: 'Furniture Assembly',
    description: 'Assemble one wardrobe and two bedside tables from flat-pack packages.',
    skillIds,
    location: { addressLine: 'Marienplatz 1, 80331 Munich' },
    timezone: 'Europe/Stockholm',
    preferredDate: '2028-09-20',
    preferredTime,
    estimatedDurationMinutes: duration,
  };
}

async function acceptedBooking() {
  const furniture = await catalog('furniture-assembly');
  const { agent } = await registerHelpSeeker();
  const created = await agent.post('/tasks').send(taskPayload([furniture.id]));
  expect(created.status).toBe(201);
  const student = await createVerifiedStudent(`${uniqueLocal('stu')}@tum.de`);
  await addSkill(student.profileId, furniture.id);
  await addDayAvailability(student.profileId);
  const booked = await agent.post(`/tasks/${created.body.task.id}/bookings`).send({
    studentId: student.profileId,
  });
  expect(booked.status).toBe(201);
  const studentAgent = request.agent(app);
  await studentAgent.post('/auth/login').send({ email: student.email, password }).expect(200);
  await studentAgent.post(`/bookings/${booked.body.booking.id}/accept`).send({}).expect(200);
  return {
    seekerAgent: agent,
    student,
    studentAgent,
    taskId: created.body.task.id as string,
    bookingId: booked.body.booking.id as string,
  };
}

describe('Payment authorization foundation', () => {
  beforeAll(async () => {
    await ensureSkillCatalog(prisma);
  });

  beforeEach(async () => {
    await prisma.session.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.bookingStatusHistory.deleteMany();
    await prisma.booking.deleteMany();
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

  it('lets the owning Help Seeker prepare payment for an ACCEPTED booking', async () => {
    const setup = await acceptedBooking();
    const response = await setup.seekerAgent
      .post(`/bookings/${setup.bookingId}/payment/authorization`)
      .send({});
    expect(response.status).toBe(200);
    expect(response.body.payment.bookingId).toBe(setup.bookingId);
    expect(response.body.payment.status).toBe('AUTHORIZED');
    expect(response.body.payment.amountMinor).toBe(4950);
    expect(response.body.payment.platformFeeMinor).toBe(450);
    expect(response.body.payment.currency).toBe('EUR');
    expect(response.body.payment.provider).toBe('MOCK');
    expect(response.body.payment.authorizedAt).toEqual(expect.any(String));
    expect(response.body.payment.providerPaymentId).toBeUndefined();
    expect(response.body.payment.idempotencyKey).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toMatch(/sk_(test|live)_/);
    expect(JSON.stringify(response.body)).not.toMatch(/cvv/i);
    expect(JSON.stringify(response.body)).not.toMatch(/cardNumber/);

    const stored = await prisma.payment.findFirstOrThrow({
      where: { bookingId: setup.bookingId },
    });
    expect(stored.amountMinor).toBe(4950);
    expect(stored.platformFeeMinor).toBe(450);
    expect(stored.currency).toBe('EUR');
    expect(stored.providerPaymentId).toMatch(/^mock_auth_/);
    expect(stored.status).toBe('AUTHORIZED');

    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: setup.bookingId },
      select: { status: true },
    });
    expect(booking.status).toBe(BookingStatus.CONFIRMED);
    await expect(
      prisma.bookingStatusHistory.count({
        where: {
          bookingId: setup.bookingId,
          fromStatus: BookingStatus.ACCEPTED,
          toStatus: BookingStatus.CONFIRMED,
        },
      }),
    ).resolves.toBe(1);
  });

  it('rejects a Student initiating payment', async () => {
    const setup = await acceptedBooking();
    const response = await setup.studentAgent
      .post(`/bookings/${setup.bookingId}/payment/authorization`)
      .send({});
    expect(response.status).toBe(403);
    expect(response.body.code).toBe(ErrorCode.FORBIDDEN);
  });

  it('rejects an unrelated Help Seeker', async () => {
    const setup = await acceptedBooking();
    const other = await registerHelpSeeker();
    const response = await other.agent
      .post(`/bookings/${setup.bookingId}/payment/authorization`)
      .send({});
    expect(response.status).toBe(403);
    expect(response.body.code).toBe(ErrorCode.FORBIDDEN);
  });

  it('rejects an unauthenticated request', async () => {
    const setup = await acceptedBooking();
    const response = await request(app)
      .post(`/bookings/${setup.bookingId}/payment/authorization`)
      .send({});
    expect(response.status).toBe(401);
    expect(response.body.code).toBe(ErrorCode.UNAUTHORIZED);
  });

  it('rejects a PENDING booking', async () => {
    const furniture = await catalog('furniture-assembly');
    const { agent } = await registerHelpSeeker();
    const created = await agent.post('/tasks').send(taskPayload([furniture.id]));
    const student = await createVerifiedStudent(`${uniqueLocal('stu')}@tum.de`);
    await addSkill(student.profileId, furniture.id);
    await addDayAvailability(student.profileId);
    const booked = await agent.post(`/tasks/${created.body.task.id}/bookings`).send({
      studentId: student.profileId,
    });
    expect(booked.body.booking.status).toBe(BookingStatus.PENDING);
    const response = await agent
      .post(`/bookings/${booked.body.booking.id}/payment/authorization`)
      .send({});
    expect(response.status).toBe(409);
    expect(response.body.code).toBe(ErrorCode.BOOKING_NOT_PAYMENT_ELIGIBLE);
  });

  it('rejects a REJECTED booking', async () => {
    const furniture = await catalog('furniture-assembly');
    const { agent } = await registerHelpSeeker();
    const created = await agent.post('/tasks').send(taskPayload([furniture.id]));
    const student = await createVerifiedStudent(`${uniqueLocal('stu')}@tum.de`);
    await addSkill(student.profileId, furniture.id);
    await addDayAvailability(student.profileId);
    const booked = await agent.post(`/tasks/${created.body.task.id}/bookings`).send({
      studentId: student.profileId,
    });
    const studentAgent = request.agent(app);
    await studentAgent.post('/auth/login').send({ email: student.email, password }).expect(200);
    await studentAgent
      .post(`/bookings/${booked.body.booking.id}/reject`)
      .send({ reason: 'The schedule no longer works for me.' })
      .expect(200);
    const response = await agent
      .post(`/bookings/${booked.body.booking.id}/payment/authorization`)
      .send({});
    expect(response.status).toBe(409);
    expect(response.body.code).toBe(ErrorCode.BOOKING_NOT_PAYMENT_ELIGIBLE);
  });

  it('rejects an unknown booking', async () => {
    const { agent } = await registerHelpSeeker();
    const response = await agent.post('/bookings/missing-booking/payment/authorization').send({});
    expect(response.status).toBe(404);
    expect(response.body.code).toBe(ErrorCode.BOOKING_NOT_FOUND);
  });

  it('rejects client-supplied amount, currency, and platform fee', async () => {
    const setup = await acceptedBooking();
    const response = await setup.seekerAgent
      .post(`/bookings/${setup.bookingId}/payment/authorization`)
      .send({
        amount: 10,
        currency: 'USD',
        platformFee: 0,
        bookingStatus: 'CONFIRMED',
      });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    await expect(prisma.payment.count({ where: { bookingId: setup.bookingId } })).resolves.toBe(0);
  });

  it('returns the existing authorization on a duplicate request', async () => {
    const setup = await acceptedBooking();
    const first = await setup.seekerAgent
      .post(`/bookings/${setup.bookingId}/payment/authorization`)
      .send({});
    const second = await setup.seekerAgent
      .post(`/bookings/${setup.bookingId}/payment/authorization`)
      .send({});
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.payment.id).toBe(first.body.payment.id);
    expect(second.body.payment.status).toBe('AUTHORIZED');
    await expect(prisma.payment.count({ where: { bookingId: setup.bookingId } })).resolves.toBe(1);
  });

  it('does not create two authorizations for concurrent requests', async () => {
    const setup = await acceptedBooking();
    const [first, second] = await Promise.all([
      setup.seekerAgent.post(`/bookings/${setup.bookingId}/payment/authorization`).send({}),
      setup.seekerAgent.post(`/bookings/${setup.bookingId}/payment/authorization`).send({}),
    ]);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.payment.id).toBe(second.body.payment.id);
    await expect(
      prisma.payment.count({
        where: { bookingId: setup.bookingId, status: 'AUTHORIZED' },
      }),
    ).resolves.toBe(1);
  });

  it('handles a declined mock authorization without confirming the booking', async () => {
    const setup = await acceptedBooking();
    const response = await setup.seekerAgent
      .post(`/bookings/${setup.bookingId}/payment/authorization`)
      .send({ paymentMethodRef: 'pm_test_declined' });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe(ErrorCode.PAYMENT_AUTHORIZATION_FAILED);
    const stored = await prisma.payment.findFirstOrThrow({
      where: { bookingId: setup.bookingId },
    });
    expect(stored.status).toBe('FAILED');
    expect(stored.failureCode).toBe('DECLINED');
    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: setup.bookingId },
      select: { status: true },
    });
    expect(booking.status).toBe(BookingStatus.ACCEPTED);
  });

  it('handles a mock provider failure', async () => {
    const setup = await acceptedBooking();
    const response = await setup.seekerAgent
      .post(`/bookings/${setup.bookingId}/payment/authorization`)
      .send({ paymentMethodRef: 'pm_test_error' });
    expect(response.status).toBe(502);
    expect(response.body.code).toBe(ErrorCode.PAYMENT_PROVIDER_ERROR);
    const stored = await prisma.payment.findFirstOrThrow({
      where: { bookingId: setup.bookingId },
    });
    expect(stored.status).toBe('FAILED');
    expect(stored.failureCode).toBe('PROVIDER_ERROR');
  });

  it('returns the current payment without secrets on GET', async () => {
    const setup = await acceptedBooking();
    await setup.seekerAgent.post(`/bookings/${setup.bookingId}/payment/authorization`).send({});
    const response = await setup.seekerAgent.get(`/bookings/${setup.bookingId}/payment`);
    expect(response.status).toBe(200);
    expect(response.body.payment.status).toBe('AUTHORIZED');
    expect(response.body.payment.amountMinor).toBe(4950);
    expect(response.body.payment.providerPaymentId).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toMatch(/sk_(test|live)_/);
  });

  it('returns payment null when authorization has not started', async () => {
    const setup = await acceptedBooking();
    const response = await setup.seekerAgent.get(`/bookings/${setup.bookingId}/payment`);
    expect(response.status).toBe(200);
    expect(response.body.payment).toBeNull();
  });
});
