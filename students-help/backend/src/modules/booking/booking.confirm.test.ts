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
  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
    select: { id: true },
  });
  return { agent, email, userId: user.id };
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
  const { agent, userId } = await registerHelpSeeker();
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
    seekerUserId: userId,
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

async function awaitingSignoffBooking() {
  const setup = await acceptedBooking();
  const authorized = await setup.seekerAgent
    .post(`/bookings/${setup.bookingId}/payment/authorization`)
    .send({});
  expect(authorized.status).toBe(200);
  const started = await setup.studentAgent.post(`/bookings/${setup.bookingId}/start`).send({});
  expect(started.status).toBe(200);
  const done = await setup.studentAgent.post(`/bookings/${setup.bookingId}/done`).send({});
  expect(done.status).toBe(200);
  expect(done.body.booking.status).toBe(BookingStatus.AWAITING_SIGNOFF);
  return {
    ...setup,
    startedAt: done.body.booking.startedAt as string,
    submittedForSignoffAt: done.body.booking.submittedForSignoffAt as string,
    paymentId: authorized.body.payment.id as string,
  };
}

describe('Help Seeker confirm completion', () => {
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

  it('lets the owning Help Seeker confirm an AWAITING_SIGNOFF booking', async () => {
    const setup = await awaitingSignoffBooking();
    const before = Date.now();
    const response = await setup.seekerAgent
      .post(`/bookings/${setup.bookingId}/confirm-completion`)
      .send({});
    const after = Date.now();

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Task completion confirmed.');
    expect(response.body.booking.status).toBe(BookingStatus.COMPLETED);
    expect(response.body.booking.startedAt).toBe(setup.startedAt);
    expect(response.body.booking.submittedForSignoffAt).toBe(setup.submittedForSignoffAt);
    expect(response.body.booking.completedAt).toEqual(expect.any(String));
    const completedAt = new Date(response.body.booking.completedAt as string).getTime();
    expect(completedAt).toBeGreaterThanOrEqual(before - 1000);
    expect(completedAt).toBeLessThanOrEqual(after + 1000);
    expect(response.body.message).not.toMatch(/paid/i);
    expect(JSON.stringify(response.body)).not.toMatch(/sk_(test|live)_/);
    expect(JSON.stringify(response.body)).not.toMatch(/providerPaymentId/);

    const stored = await prisma.booking.findUniqueOrThrow({
      where: { id: setup.bookingId },
      select: {
        status: true,
        startedAt: true,
        submittedForSignoffAt: true,
        completedAt: true,
      },
    });
    expect(stored.status).toBe(BookingStatus.COMPLETED);
    expect(stored.startedAt?.toISOString()).toBe(setup.startedAt);
    expect(stored.submittedForSignoffAt?.toISOString()).toBe(setup.submittedForSignoffAt);
    expect(stored.completedAt?.toISOString()).toBe(response.body.booking.completedAt);

    await expect(
      prisma.bookingStatusHistory.count({
        where: {
          bookingId: setup.bookingId,
          fromStatus: BookingStatus.AWAITING_SIGNOFF,
          toStatus: BookingStatus.COMPLETED,
          changedByUserId: setup.seekerUserId,
        },
      }),
    ).resolves.toBe(1);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: setup.paymentId } });
    expect(payment.status).toBe(PaymentStatus.CAPTURED);
    expect(payment.capturedAt).toBeInstanceOf(Date);
    expect(payment.authorizedAt).toBeInstanceOf(Date);

    const studentView = await setup.studentAgent.get(`/bookings/${setup.bookingId}`);
    expect(studentView.status).toBe(200);
    expect(studentView.body.booking.status).toBe(BookingStatus.COMPLETED);
    expect(studentView.body.booking.completedAt).toBe(response.body.booking.completedAt);

    const timeline = await setup.studentAgent.get(`/bookings/${setup.bookingId}/payment-timeline`);
    expect(timeline.status).toBe(200);
    expect(timeline.body.paymentTimeline.paymentStatus).toBe('CAPTURED');
    expect(timeline.body.paymentTimeline.headline).toBe('PAYMENT_RELEASED');
    expect(JSON.stringify(timeline.body)).not.toMatch(/sk_(test|live)_/);
    expect(JSON.stringify(timeline.body)).not.toMatch(/providerPaymentId/);
  });

  it('keeps execution complete without faking capture when the gateway cannot capture', async () => {
    const setup = await awaitingSignoffBooking();
    await prisma.payment.update({
      where: { id: setup.paymentId },
      data: { providerPaymentId: `missing_auth_${setup.paymentId}` },
    });

    const response = await setup.seekerAgent
      .post(`/bookings/${setup.bookingId}/confirm-completion`)
      .send({});
    expect(response.status).toBe(200);
    expect(response.body.booking.status).toBe(BookingStatus.COMPLETED);
    expect(response.body.message).not.toMatch(/paid/i);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: setup.paymentId } });
    expect(payment.status).toBe(PaymentStatus.AUTHORIZED);
    expect(payment.capturedAt).toBeNull();

    const timeline = await setup.studentAgent.get(`/bookings/${setup.bookingId}/payment-timeline`);
    expect(timeline.body.paymentTimeline.headline).toBe('AWAITING_PAYOUT');
    expect(
      timeline.body.paymentTimeline.timeline.find((step: { key: string }) => step.key === 'PAID')
        .status,
    ).toBe('CURRENT');
  });

  it('rejects a Student confirming completion', async () => {
    const setup = await awaitingSignoffBooking();
    const response = await setup.studentAgent
      .post(`/bookings/${setup.bookingId}/confirm-completion`)
      .send({});
    expect(response.status).toBe(403);
    expect(response.body.code).toBe(ErrorCode.FORBIDDEN);
  });

  it('rejects another Help Seeker confirming completion', async () => {
    const setup = await awaitingSignoffBooking();
    const other = await registerHelpSeeker(`${uniqueLocal('other')}@example.com`);
    const response = await other.agent.post(`/bookings/${setup.bookingId}/confirm-completion`).send({});
    expect(response.status).toBe(403);
    expect(response.body.code).toBe(ErrorCode.FORBIDDEN);
  });

  it('rejects an unauthenticated request', async () => {
    const setup = await awaitingSignoffBooking();
    const response = await request(app)
      .post(`/bookings/${setup.bookingId}/confirm-completion`)
      .send({});
    expect(response.status).toBe(401);
    expect(response.body.code).toBe(ErrorCode.UNAUTHORIZED);
  });

  it('rejects an unknown booking', async () => {
    const { agent } = await registerHelpSeeker();
    const response = await agent.post('/bookings/does-not-exist/confirm-completion').send({});
    expect(response.status).toBe(404);
    expect(response.body.code).toBe(ErrorCode.BOOKING_NOT_FOUND);
  });

  it('rejects PENDING, ACCEPTED, CONFIRMED, and IN_PROGRESS bookings', async () => {
    const pending = await pendingBooking();
    expect(
      (await pending.seekerAgent.post(`/bookings/${pending.bookingId}/confirm-completion`).send({}))
        .body.code,
    ).toBe(ErrorCode.TASK_NOT_AWAITING_SIGNOFF);

    const accepted = await acceptedBooking();
    expect(
      (await accepted.seekerAgent.post(`/bookings/${accepted.bookingId}/confirm-completion`).send({}))
        .body.code,
    ).toBe(ErrorCode.TASK_NOT_AWAITING_SIGNOFF);

    await accepted.seekerAgent.post(`/bookings/${accepted.bookingId}/payment/authorization`).send({});
    const confirmed = await prisma.booking.findUniqueOrThrow({
      where: { id: accepted.bookingId },
      select: { status: true },
    });
    expect(confirmed.status).toBe(BookingStatus.CONFIRMED);
    expect(
      (await accepted.seekerAgent.post(`/bookings/${accepted.bookingId}/confirm-completion`).send({}))
        .body.code,
    ).toBe(ErrorCode.TASK_NOT_AWAITING_SIGNOFF);

    await accepted.studentAgent.post(`/bookings/${accepted.bookingId}/start`).send({}).expect(200);
    const inProgress = await accepted.seekerAgent
      .post(`/bookings/${accepted.bookingId}/confirm-completion`)
      .send({});
    expect(inProgress.status).toBe(409);
    expect(inProgress.body.code).toBe(ErrorCode.TASK_NOT_AWAITING_SIGNOFF);
  });

  it('rejects REJECTED, CANCELLED, and COMPLETED bookings', async () => {
    const cases = [
      { status: BookingStatus.REJECTED, code: ErrorCode.BOOKING_REJECTED },
      { status: BookingStatus.CANCELLED, code: ErrorCode.TASK_CANCELLED },
      { status: BookingStatus.COMPLETED, code: ErrorCode.TASK_ALREADY_COMPLETED },
    ] as const;

    for (const item of cases) {
      const setup = await acceptedBooking();
      await prisma.booking.update({
        where: { id: setup.bookingId },
        data: { status: item.status },
      });
      const response = await setup.seekerAgent
        .post(`/bookings/${setup.bookingId}/confirm-completion`)
        .send({});
      expect(response.status).toBe(409);
      expect(response.body.code).toBe(item.code);
    }
  });

  it('rejects AWAITING_SIGNOFF without submittedForSignoffAt', async () => {
    const setup = await acceptedBooking();
    await prisma.booking.update({
      where: { id: setup.bookingId },
      data: { status: BookingStatus.AWAITING_SIGNOFF, submittedForSignoffAt: null },
    });
    const response = await setup.seekerAgent
      .post(`/bookings/${setup.bookingId}/confirm-completion`)
      .send({});
    expect(response.status).toBe(409);
    expect(response.body.code).toBe(ErrorCode.TASK_NOT_SUBMITTED);
  });

  it('rejects confirmation when payment is not authorized', async () => {
    const setup = await awaitingSignoffBooking();
    await prisma.payment.update({
      where: { id: setup.paymentId },
      data: { status: PaymentStatus.FAILED },
    });
    const response = await setup.seekerAgent
      .post(`/bookings/${setup.bookingId}/confirm-completion`)
      .send({});
    expect(response.status).toBe(409);
    expect(response.body.code).toBe(ErrorCode.PAYMENT_NOT_AUTHORIZED);
    const stored = await prisma.booking.findUniqueOrThrow({
      where: { id: setup.bookingId },
      select: { status: true, completedAt: true },
    });
    expect(stored.status).toBe(BookingStatus.AWAITING_SIGNOFF);
    expect(stored.completedAt).toBeNull();
  });

  it('rejects a second confirmation and keeps a single timestamp', async () => {
    const setup = await awaitingSignoffBooking();
    const first = await setup.seekerAgent
      .post(`/bookings/${setup.bookingId}/confirm-completion`)
      .send({});
    expect(first.status).toBe(200);
    const completedAt = first.body.booking.completedAt as string;
    const second = await setup.seekerAgent
      .post(`/bookings/${setup.bookingId}/confirm-completion`)
      .send({});
    expect(second.status).toBe(409);
    expect(second.body.code).toBe(ErrorCode.TASK_ALREADY_COMPLETED);
    const stored = await prisma.booking.findUniqueOrThrow({
      where: { id: setup.bookingId },
      select: { status: true, startedAt: true, submittedForSignoffAt: true, completedAt: true },
    });
    expect(stored.status).toBe(BookingStatus.COMPLETED);
    expect(stored.startedAt?.toISOString()).toBe(setup.startedAt);
    expect(stored.submittedForSignoffAt?.toISOString()).toBe(setup.submittedForSignoffAt);
    expect(stored.completedAt?.toISOString()).toBe(completedAt);
    await expect(
      prisma.bookingStatusHistory.count({
        where: {
          bookingId: setup.bookingId,
          toStatus: BookingStatus.COMPLETED,
        },
      }),
    ).resolves.toBe(1);
  });

  it('ignores client-supplied status, timestamp, paymentStatus, and helpSeekerId', async () => {
    const setup = await awaitingSignoffBooking();
    const response = await setup.seekerAgent.post(`/bookings/${setup.bookingId}/confirm-completion`).send({
      helpSeekerId: 'seeker_other',
      status: BookingStatus.COMPLETED,
      completedAt: '2020-01-01T00:00:00.000Z',
      paymentStatus: 'PAID',
    });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    const stored = await prisma.booking.findUniqueOrThrow({
      where: { id: setup.bookingId },
      select: { status: true, completedAt: true },
    });
    expect(stored.status).toBe(BookingStatus.AWAITING_SIGNOFF);
    expect(stored.completedAt).toBeNull();
  });

  it('allows only one concurrent confirmation to succeed', async () => {
    const setup = await awaitingSignoffBooking();
    const [first, second] = await Promise.all([
      setup.seekerAgent.post(`/bookings/${setup.bookingId}/confirm-completion`).send({}),
      setup.seekerAgent.post(`/bookings/${setup.bookingId}/confirm-completion`).send({}),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);
    const winner = first.status === 200 ? first : second;
    const loser = first.status === 409 ? first : second;
    expect(winner.body.booking.status).toBe(BookingStatus.COMPLETED);
    expect(loser.body.code).toBe(ErrorCode.TASK_ALREADY_COMPLETED);

    const stored = await prisma.booking.findUniqueOrThrow({
      where: { id: setup.bookingId },
      select: { status: true, startedAt: true, submittedForSignoffAt: true, completedAt: true },
    });
    expect(stored.status).toBe(BookingStatus.COMPLETED);
    expect(stored.startedAt?.toISOString()).toBe(setup.startedAt);
    expect(stored.submittedForSignoffAt?.toISOString()).toBe(setup.submittedForSignoffAt);
    expect(stored.completedAt?.toISOString()).toBe(winner.body.booking.completedAt);
    await expect(
      prisma.bookingStatusHistory.count({
        where: {
          bookingId: setup.bookingId,
          fromStatus: BookingStatus.AWAITING_SIGNOFF,
          toStatus: BookingStatus.COMPLETED,
        },
      }),
    ).resolves.toBe(1);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: setup.paymentId } });
    expect(payment.status).toBe(PaymentStatus.CAPTURED);
  });
});
