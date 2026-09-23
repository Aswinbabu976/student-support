import {
  BookingStatus,
  DayOfWeek,
  ExperienceLevel,
  PaymentStatus,
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

async function pendingBooking() {
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
  return {
    seekerAgent: agent,
    student,
    studentAgent,
    taskId: created.body.task.id as string,
    bookingId: booked.body.booking.id as string,
  };
}

async function acceptedBooking() {
  const setup = await pendingBooking();
  await setup.studentAgent.post(`/bookings/${setup.bookingId}/accept`).send({}).expect(200);
  return setup;
}

async function confirmedBooking() {
  const setup = await acceptedBooking();
  const authorized = await setup.seekerAgent
    .post(`/bookings/${setup.bookingId}/payment/authorization`)
    .send({});
  expect(authorized.status).toBe(200);
  expect(authorized.body.payment.status).toBe('AUTHORIZED');
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: setup.bookingId },
    select: { status: true },
  });
  expect(booking.status).toBe(BookingStatus.CONFIRMED);
  return setup;
}

describe('Student start task', () => {
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

  it('lets the assigned Student start a funded CONFIRMED booking', async () => {
    const setup = await confirmedBooking();
    const before = Date.now();
    const response = await setup.studentAgent.post(`/bookings/${setup.bookingId}/start`).send({});
    const after = Date.now();

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Task started.');
    expect(response.body.booking.id).toBe(setup.bookingId);
    expect(response.body.booking.task.id).toBe(setup.taskId);
    expect(response.body.booking.status).toBe(BookingStatus.IN_PROGRESS);
    expect(response.body.booking.startedAt).toEqual(expect.any(String));
    const startedAt = new Date(response.body.booking.startedAt as string).getTime();
    expect(startedAt).toBeGreaterThanOrEqual(before - 1000);
    expect(startedAt).toBeLessThanOrEqual(after + 1000);
    expect(response.body.booking).not.toHaveProperty('studentProfileId');
    expect(JSON.stringify(response.body)).not.toMatch(/sk_(test|live)_/);
    expect(JSON.stringify(response.body)).not.toMatch(/providerPaymentId/);
    expect(JSON.stringify(response.body)).not.toMatch(/idempotencyKey/);

    const stored = await prisma.booking.findUniqueOrThrow({
      where: { id: setup.bookingId },
      select: { status: true, startedAt: true },
    });
    expect(stored.status).toBe(BookingStatus.IN_PROGRESS);
    expect(stored.startedAt?.toISOString()).toBe(response.body.booking.startedAt);

    await expect(
      prisma.bookingStatusHistory.count({
        where: {
          bookingId: setup.bookingId,
          fromStatus: BookingStatus.CONFIRMED,
          toStatus: BookingStatus.IN_PROGRESS,
          changedByUserId: setup.student.userId,
        },
      }),
    ).resolves.toBe(1);

    const seekerView = await setup.seekerAgent.get(`/bookings/${setup.bookingId}`);
    expect(seekerView.status).toBe(200);
    expect(seekerView.body.booking.status).toBe(BookingStatus.IN_PROGRESS);
    expect(seekerView.body.booking.startedAt).toBe(response.body.booking.startedAt);
  });

  it('rejects a Help Seeker starting the task', async () => {
    const setup = await confirmedBooking();
    const response = await setup.seekerAgent.post(`/bookings/${setup.bookingId}/start`).send({});
    expect(response.status).toBe(403);
    expect(response.body.code).toBe(ErrorCode.FORBIDDEN);
  });

  it('rejects another Student starting the task', async () => {
    const setup = await confirmedBooking();
    const other = await createVerifiedStudent(`${uniqueLocal('other')}@tum.de`);
    const otherAgent = request.agent(app);
    await otherAgent.post('/auth/login').send({ email: other.email, password }).expect(200);
    const response = await otherAgent.post(`/bookings/${setup.bookingId}/start`).send({});
    expect(response.status).toBe(403);
    expect(response.body.code).toBe(ErrorCode.FORBIDDEN);
  });

  it('rejects an unauthenticated request', async () => {
    const setup = await confirmedBooking();
    const response = await request(app).post(`/bookings/${setup.bookingId}/start`).send({});
    expect(response.status).toBe(401);
    expect(response.body.code).toBe(ErrorCode.UNAUTHORIZED);
  });

  it('rejects an unknown booking', async () => {
    const student = await createVerifiedStudent(`${uniqueLocal('miss')}@tum.de`);
    const studentAgent = request.agent(app);
    await studentAgent.post('/auth/login').send({ email: student.email, password }).expect(200);
    const response = await studentAgent.post('/bookings/does-not-exist/start').send({});
    expect(response.status).toBe(404);
    expect(response.body.code).toBe(ErrorCode.BOOKING_NOT_FOUND);
  });

  it('rejects a PENDING booking', async () => {
    const setup = await pendingBooking();
    const response = await setup.studentAgent.post(`/bookings/${setup.bookingId}/start`).send({});
    expect(response.status).toBe(409);
    expect(response.body.code).toBe(ErrorCode.BOOKING_NOT_CONFIRMED);
  });

  it('rejects an ACCEPTED unfunded booking', async () => {
    const setup = await acceptedBooking();
    const response = await setup.studentAgent.post(`/bookings/${setup.bookingId}/start`).send({});
    expect(response.status).toBe(409);
    expect(response.body.code).toBe(ErrorCode.BOOKING_NOT_CONFIRMED);
    const stored = await prisma.booking.findUniqueOrThrow({
      where: { id: setup.bookingId },
      select: { status: true, startedAt: true },
    });
    expect(stored.status).toBe(BookingStatus.ACCEPTED);
    expect(stored.startedAt).toBeNull();
  });

  it('rejects a CONFIRMED booking without payment authorization', async () => {
    const setup = await acceptedBooking();
    await prisma.booking.update({
      where: { id: setup.bookingId },
      data: { status: BookingStatus.CONFIRMED },
    });
    const response = await setup.studentAgent.post(`/bookings/${setup.bookingId}/start`).send({});
    expect(response.status).toBe(409);
    expect(response.body.code).toBe(ErrorCode.PAYMENT_NOT_AUTHORIZED);
    const stored = await prisma.booking.findUniqueOrThrow({
      where: { id: setup.bookingId },
      select: { status: true, startedAt: true },
    });
    expect(stored.status).toBe(BookingStatus.CONFIRMED);
    expect(stored.startedAt).toBeNull();
    await expect(
      prisma.bookingStatusHistory.count({
        where: {
          bookingId: setup.bookingId,
          toStatus: BookingStatus.IN_PROGRESS,
        },
      }),
    ).resolves.toBe(0);
  });

  it('rejects REJECTED, CANCELLED, and COMPLETED bookings', async () => {
    const cases = [
      { status: BookingStatus.REJECTED, code: ErrorCode.BOOKING_REJECTED },
      { status: BookingStatus.CANCELLED, code: ErrorCode.TASK_CANCELLED },
      { status: BookingStatus.COMPLETED, code: ErrorCode.INVALID_STATE_TRANSITION },
    ] as const;

    for (const item of cases) {
      const setup = await acceptedBooking();
      await prisma.booking.update({
        where: { id: setup.bookingId },
        data: { status: item.status },
      });
      const response = await setup.studentAgent.post(`/bookings/${setup.bookingId}/start`).send({});
      expect(response.status).toBe(409);
      expect(response.body.code).toBe(item.code);
    }
  });

  it('rejects a second start and keeps a single startedAt', async () => {
    const setup = await confirmedBooking();
    const first = await setup.studentAgent.post(`/bookings/${setup.bookingId}/start`).send({});
    expect(first.status).toBe(200);
    const startedAt = first.body.booking.startedAt as string;
    const second = await setup.studentAgent.post(`/bookings/${setup.bookingId}/start`).send({});
    expect(second.status).toBe(409);
    expect(second.body.code).toBe(ErrorCode.TASK_ALREADY_STARTED);
    const stored = await prisma.booking.findUniqueOrThrow({
      where: { id: setup.bookingId },
      select: { status: true, startedAt: true },
    });
    expect(stored.status).toBe(BookingStatus.IN_PROGRESS);
    expect(stored.startedAt?.toISOString()).toBe(startedAt);
    await expect(
      prisma.bookingStatusHistory.count({
        where: {
          bookingId: setup.bookingId,
          toStatus: BookingStatus.IN_PROGRESS,
        },
      }),
    ).resolves.toBe(1);
  });

  it('ignores client-supplied status, startedAt, paymentStatus, and studentId', async () => {
    const setup = await confirmedBooking();
    const response = await setup.studentAgent.post(`/bookings/${setup.bookingId}/start`).send({
      studentId: 'student_other',
      status: BookingStatus.IN_PROGRESS,
      startedAt: '2020-01-01T00:00:00.000Z',
      paymentStatus: PaymentStatus.AUTHORIZED,
    });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    const stored = await prisma.booking.findUniqueOrThrow({
      where: { id: setup.bookingId },
      select: { status: true, startedAt: true },
    });
    expect(stored.status).toBe(BookingStatus.CONFIRMED);
    expect(stored.startedAt).toBeNull();
  });

  it('allows only one concurrent start to succeed', async () => {
    const setup = await confirmedBooking();
    const [first, second] = await Promise.all([
      setup.studentAgent.post(`/bookings/${setup.bookingId}/start`).send({}),
      setup.studentAgent.post(`/bookings/${setup.bookingId}/start`).send({}),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);
    const winner = first.status === 200 ? first : second;
    const loser = first.status === 409 ? first : second;
    expect(winner.body.booking.status).toBe(BookingStatus.IN_PROGRESS);
    expect(loser.body.code).toBe(ErrorCode.TASK_ALREADY_STARTED);

    const stored = await prisma.booking.findUniqueOrThrow({
      where: { id: setup.bookingId },
      select: { status: true, startedAt: true },
    });
    expect(stored.status).toBe(BookingStatus.IN_PROGRESS);
    expect(stored.startedAt).not.toBeNull();
    expect(stored.startedAt?.toISOString()).toBe(winner.body.booking.startedAt);
    await expect(
      prisma.bookingStatusHistory.count({
        where: {
          bookingId: setup.bookingId,
          fromStatus: BookingStatus.CONFIRMED,
          toStatus: BookingStatus.IN_PROGRESS,
        },
      }),
    ).resolves.toBe(1);
  });
});
