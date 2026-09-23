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

async function inProgressBooking() {
  const setup = await acceptedBooking();
  const authorized = await setup.seekerAgent
    .post(`/bookings/${setup.bookingId}/payment/authorization`)
    .send({});
  expect(authorized.status).toBe(200);
  const started = await setup.studentAgent.post(`/bookings/${setup.bookingId}/start`).send({});
  expect(started.status).toBe(200);
  expect(started.body.booking.status).toBe(BookingStatus.IN_PROGRESS);
  return {
    ...setup,
    startedAt: started.body.booking.startedAt as string,
    paymentId: authorized.body.payment.id as string,
  };
}

describe('Student mark task done', () => {
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

  it('lets the assigned Student submit an IN_PROGRESS task for sign-off', async () => {
    const setup = await inProgressBooking();
    const before = Date.now();
    const response = await setup.studentAgent.post(`/bookings/${setup.bookingId}/done`).send({});
    const after = Date.now();

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Task submitted for confirmation.');
    expect(response.body.booking.status).toBe(BookingStatus.AWAITING_SIGNOFF);
    expect(response.body.booking.startedAt).toBe(setup.startedAt);
    expect(response.body.booking.submittedForSignoffAt).toEqual(expect.any(String));
    const submittedAt = new Date(response.body.booking.submittedForSignoffAt as string).getTime();
    expect(submittedAt).toBeGreaterThanOrEqual(before - 1000);
    expect(submittedAt).toBeLessThanOrEqual(after + 1000);
    expect(response.body.booking.status).not.toBe(BookingStatus.COMPLETED);
    expect(JSON.stringify(response.body)).not.toMatch(/sk_(test|live)_/);
    expect(JSON.stringify(response.body)).not.toMatch(/providerPaymentId/);

    const stored = await prisma.booking.findUniqueOrThrow({
      where: { id: setup.bookingId },
      select: { status: true, startedAt: true, submittedForSignoffAt: true },
    });
    expect(stored.status).toBe(BookingStatus.AWAITING_SIGNOFF);
    expect(stored.startedAt?.toISOString()).toBe(setup.startedAt);
    expect(stored.submittedForSignoffAt?.toISOString()).toBe(response.body.booking.submittedForSignoffAt);

    await expect(
      prisma.bookingStatusHistory.count({
        where: {
          bookingId: setup.bookingId,
          fromStatus: BookingStatus.IN_PROGRESS,
          toStatus: BookingStatus.AWAITING_SIGNOFF,
          changedByUserId: setup.student.userId,
        },
      }),
    ).resolves.toBe(1);

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { id: setup.paymentId },
    });
    expect(payment.status).toBe(PaymentStatus.AUTHORIZED);

    const seekerView = await setup.seekerAgent.get(`/bookings/${setup.bookingId}`);
    expect(seekerView.status).toBe(200);
    expect(seekerView.body.booking.status).toBe(BookingStatus.AWAITING_SIGNOFF);
    expect(seekerView.body.booking.submittedForSignoffAt).toBe(response.body.booking.submittedForSignoffAt);
  });

  it('rejects a Help Seeker marking the task done', async () => {
    const setup = await inProgressBooking();
    const response = await setup.seekerAgent.post(`/bookings/${setup.bookingId}/done`).send({});
    expect(response.status).toBe(403);
    expect(response.body.code).toBe(ErrorCode.FORBIDDEN);
  });

  it('rejects another Student marking the task done', async () => {
    const setup = await inProgressBooking();
    const other = await createVerifiedStudent(`${uniqueLocal('other')}@tum.de`);
    const otherAgent = request.agent(app);
    await otherAgent.post('/auth/login').send({ email: other.email, password }).expect(200);
    const response = await otherAgent.post(`/bookings/${setup.bookingId}/done`).send({});
    expect(response.status).toBe(403);
    expect(response.body.code).toBe(ErrorCode.FORBIDDEN);
  });

  it('rejects an unauthenticated request', async () => {
    const setup = await inProgressBooking();
    const response = await request(app).post(`/bookings/${setup.bookingId}/done`).send({});
    expect(response.status).toBe(401);
    expect(response.body.code).toBe(ErrorCode.UNAUTHORIZED);
  });

  it('rejects an unknown booking', async () => {
    const student = await createVerifiedStudent(`${uniqueLocal('miss')}@tum.de`);
    const studentAgent = request.agent(app);
    await studentAgent.post('/auth/login').send({ email: student.email, password }).expect(200);
    const response = await studentAgent.post('/bookings/does-not-exist/done').send({});
    expect(response.status).toBe(404);
    expect(response.body.code).toBe(ErrorCode.BOOKING_NOT_FOUND);
  });

  it('rejects PENDING, ACCEPTED, and CONFIRMED bookings', async () => {
    const pending = await pendingBooking();
    expect((await pending.studentAgent.post(`/bookings/${pending.bookingId}/done`).send({})).body.code).toBe(
      ErrorCode.TASK_NOT_IN_PROGRESS,
    );

    const accepted = await acceptedBooking();
    expect((await accepted.studentAgent.post(`/bookings/${accepted.bookingId}/done`).send({})).body.code).toBe(
      ErrorCode.TASK_NOT_IN_PROGRESS,
    );

    await accepted.seekerAgent.post(`/bookings/${accepted.bookingId}/payment/authorization`).send({});
    const confirmed = await prisma.booking.findUniqueOrThrow({
      where: { id: accepted.bookingId },
      select: { status: true, startedAt: true },
    });
    expect(confirmed.status).toBe(BookingStatus.CONFIRMED);
    expect(confirmed.startedAt).toBeNull();
    const confirmedDone = await accepted.studentAgent.post(`/bookings/${accepted.bookingId}/done`).send({});
    expect(confirmedDone.status).toBe(409);
    expect(confirmedDone.body.code).toBe(ErrorCode.TASK_NOT_IN_PROGRESS);
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
      const response = await setup.studentAgent.post(`/bookings/${setup.bookingId}/done`).send({});
      expect(response.status).toBe(409);
      expect(response.body.code).toBe(item.code);
    }
  });

  it('rejects IN_PROGRESS without startedAt', async () => {
    const setup = await acceptedBooking();
    await prisma.booking.update({
      where: { id: setup.bookingId },
      data: { status: BookingStatus.IN_PROGRESS, startedAt: null },
    });
    const response = await setup.studentAgent.post(`/bookings/${setup.bookingId}/done`).send({});
    expect(response.status).toBe(409);
    expect(response.body.code).toBe(ErrorCode.TASK_NOT_STARTED);
  });

  it('rejects a second submission and keeps a single timestamp', async () => {
    const setup = await inProgressBooking();
    const first = await setup.studentAgent.post(`/bookings/${setup.bookingId}/done`).send({});
    expect(first.status).toBe(200);
    const submittedAt = first.body.booking.submittedForSignoffAt as string;
    const second = await setup.studentAgent.post(`/bookings/${setup.bookingId}/done`).send({});
    expect(second.status).toBe(409);
    expect(second.body.code).toBe(ErrorCode.TASK_ALREADY_SUBMITTED);
    const stored = await prisma.booking.findUniqueOrThrow({
      where: { id: setup.bookingId },
      select: { status: true, startedAt: true, submittedForSignoffAt: true },
    });
    expect(stored.status).toBe(BookingStatus.AWAITING_SIGNOFF);
    expect(stored.startedAt?.toISOString()).toBe(setup.startedAt);
    expect(stored.submittedForSignoffAt?.toISOString()).toBe(submittedAt);
    await expect(
      prisma.bookingStatusHistory.count({
        where: {
          bookingId: setup.bookingId,
          toStatus: BookingStatus.AWAITING_SIGNOFF,
        },
      }),
    ).resolves.toBe(1);
  });

  it('ignores client-supplied status, timestamp, paymentStatus, and studentId', async () => {
    const setup = await inProgressBooking();
    const response = await setup.studentAgent.post(`/bookings/${setup.bookingId}/done`).send({
      studentId: 'student_other',
      status: BookingStatus.AWAITING_SIGNOFF,
      completedAt: '2020-01-01T00:00:00.000Z',
      submittedForSignoffAt: '2020-01-01T00:00:00.000Z',
      paymentStatus: 'PAID',
    });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    const stored = await prisma.booking.findUniqueOrThrow({
      where: { id: setup.bookingId },
      select: { status: true, submittedForSignoffAt: true },
    });
    expect(stored.status).toBe(BookingStatus.IN_PROGRESS);
    expect(stored.submittedForSignoffAt).toBeNull();
  });

  it('allows only one concurrent Done request to succeed', async () => {
    const setup = await inProgressBooking();
    const [first, second] = await Promise.all([
      setup.studentAgent.post(`/bookings/${setup.bookingId}/done`).send({}),
      setup.studentAgent.post(`/bookings/${setup.bookingId}/done`).send({}),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);
    const winner = first.status === 200 ? first : second;
    const loser = first.status === 409 ? first : second;
    expect(winner.body.booking.status).toBe(BookingStatus.AWAITING_SIGNOFF);
    expect(loser.body.code).toBe(ErrorCode.TASK_ALREADY_SUBMITTED);

    const stored = await prisma.booking.findUniqueOrThrow({
      where: { id: setup.bookingId },
      select: { status: true, startedAt: true, submittedForSignoffAt: true },
    });
    expect(stored.status).toBe(BookingStatus.AWAITING_SIGNOFF);
    expect(stored.startedAt?.toISOString()).toBe(setup.startedAt);
    expect(stored.submittedForSignoffAt?.toISOString()).toBe(winner.body.booking.submittedForSignoffAt);
    await expect(
      prisma.bookingStatusHistory.count({
        where: {
          bookingId: setup.bookingId,
          fromStatus: BookingStatus.IN_PROGRESS,
          toStatus: BookingStatus.AWAITING_SIGNOFF,
        },
      }),
    ).resolves.toBe(1);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: setup.paymentId } });
    expect(payment.status).toBe(PaymentStatus.AUTHORIZED);
  });
});
