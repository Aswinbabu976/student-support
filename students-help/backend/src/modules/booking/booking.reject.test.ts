import {
  BookingStatus,
  DayOfWeek,
  ExperienceLevel,
  TaskStatus,
  VerificationStatus,
} from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { loadEnv } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import { ErrorCode } from '../../shared/errors.js';
import { ensureSkillCatalog } from '../skills/skill-catalog.js';
import { REJECTION_REASON_MAX_LENGTH } from './booking.reason.js';

const app = createApp({ env: loadEnv() });
const password = 'securePass12';
const reason = 'The schedule no longer works for me.';

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

async function addDayAvailability(profileId: string) {
  await prisma.studentProfile.update({
    where: { id: profileId },
    data: { timezone: 'Europe/Stockholm' },
  });
  await prisma.recurringAvailability.create({
    data: {
      studentProfileId: profileId,
      dayOfWeek: DayOfWeek.WEDNESDAY,
      startTime: '09:00',
      endTime: '18:00',
      isActive: true,
    },
  });
}

async function catalog(slug: string) {
  return prisma.skill.findUniqueOrThrow({ where: { slug }, select: { id: true } });
}

function taskPayload(skillIds: string[]) {
  return {
    title: 'Furniture Assembly',
    description: 'Assemble one wardrobe and two bedside tables from flat-pack packages.',
    skillIds,
    location: { addressLine: 'Marienplatz 1, 80331 Munich' },
    timezone: 'Europe/Stockholm',
    preferredDate: '2028-09-20',
    preferredTime: '10:00',
    estimatedDurationMinutes: 180,
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
    furnitureId: furniture.id,
    seekerAgent: agent,
    student,
    studentAgent,
    taskId: created.body.task.id as string,
    bookingId: booked.body.booking.id as string,
  };
}

describe('Student reject booking', () => {
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

  it('lets the recipient Student reject a PENDING booking with a reason', async () => {
    const setup = await pendingBooking();
    const response = await setup.studentAgent.post(`/bookings/${setup.bookingId}/reject`).send({ reason });
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Booking rejected.');
    expect(response.body.booking.status).toBe(BookingStatus.REJECTED);
    expect(response.body.booking.rejectionReason).toBe(reason);
    expect(response.body.booking.rejectedAt).toEqual(expect.any(String));
    expect(response.body.booking.progress.steps).toEqual([
      expect.objectContaining({ id: 'REQUEST', state: 'complete' }),
      expect.objectContaining({ id: 'DECLINED', state: 'declined', label: 'Student declined' }),
    ]);
    expect(response.body.booking.progress.steps.some((step: { id: string }) => step.id === 'HOLD')).toBe(
      false,
    );
    expect(JSON.stringify(response.body)).not.toMatch(/@tum\.de/);
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash/);

    const stored = await prisma.booking.findUniqueOrThrow({
      where: { id: setup.bookingId },
      include: { task: true, statusHistory: { orderBy: { createdAt: 'asc' } } },
    });
    expect(stored.status).toBe(BookingStatus.REJECTED);
    expect(stored.rejectionReason).toBe(reason);
    expect(stored.rejectedAt).toBeInstanceOf(Date);
    expect(stored.task.status).toBe(TaskStatus.PUBLISHED);
    expect(stored.statusHistory.map((row) => row.toStatus)).toEqual([
      BookingStatus.PENDING,
      BookingStatus.REJECTED,
    ]);
    expect(stored.statusHistory[1]).toMatchObject({
      fromStatus: BookingStatus.PENDING,
      toStatus: BookingStatus.REJECTED,
      changedByUserId: setup.student.userId,
    });
  });

  it('rejects extra client-controlled reject fields', async () => {
    const setup = await pendingBooking();
    const response = await setup.studentAgent.post(`/bookings/${setup.bookingId}/reject`).send({
      reason,
      status: BookingStatus.CONFIRMED,
      studentId: setup.student.profileId,
    });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    const stored = await prisma.booking.findUniqueOrThrow({ where: { id: setup.bookingId } });
    expect(stored.status).toBe(BookingStatus.PENDING);
  });

  it('requires a short non-empty reason', async () => {
    const setup = await pendingBooking();
    const missing = await setup.studentAgent.post(`/bookings/${setup.bookingId}/reject`).send({});
    expect(missing.status).toBe(400);
    expect(missing.body.code).toBe(ErrorCode.VALIDATION_ERROR);

    const blank = await setup.studentAgent.post(`/bookings/${setup.bookingId}/reject`).send({ reason: '   ' });
    expect(blank.status).toBe(400);
    expect(blank.body.details[0].field).toBe('reason');

    const short = await setup.studentAgent.post(`/bookings/${setup.bookingId}/reject`).send({ reason: 'No' });
    expect(short.status).toBe(400);
    expect(short.body.details[0].field).toBe('reason');

    const long = await setup.studentAgent
      .post(`/bookings/${setup.bookingId}/reject`)
      .send({ reason: 'n'.repeat(REJECTION_REASON_MAX_LENGTH + 1) });
    expect(long.status).toBe(400);
    expect(long.body.details[0].field).toBe('reason');

    const stored = await prisma.booking.findUniqueOrThrow({ where: { id: setup.bookingId } });
    expect(stored.status).toBe(BookingStatus.PENDING);
  });

  it('rejects unauthenticated, Help Seeker, and other Student reject attempts', async () => {
    const setup = await pendingBooking();
    const anon = await request(app).post(`/bookings/${setup.bookingId}/reject`).send({ reason });
    expect(anon.status).toBe(401);

    const seeker = await setup.seekerAgent.post(`/bookings/${setup.bookingId}/reject`).send({ reason });
    expect(seeker.status).toBe(403);

    const other = await createVerifiedStudent(`${uniqueLocal('other')}@tum.de`);
    const otherAgent = request.agent(app);
    await otherAgent.post('/auth/login').send({ email: other.email, password }).expect(200);
    const foreign = await otherAgent.post(`/bookings/${setup.bookingId}/reject`).send({ reason });
    expect(foreign.status).toBe(403);
    expect(foreign.body.code).toBe(ErrorCode.FORBIDDEN);
  });

  it('rejects an unknown booking', async () => {
    const student = await createVerifiedStudent(`${uniqueLocal('miss')}@tum.de`);
    const studentAgent = request.agent(app);
    await studentAgent.post('/auth/login').send({ email: student.email, password }).expect(200);
    const response = await studentAgent.post('/bookings/does-not-exist/reject').send({ reason });
    expect(response.status).toBe(404);
    expect(response.body.code).toBe(ErrorCode.BOOKING_NOT_FOUND);
  });

  it('rejects reject for non-PENDING statuses', async () => {
    const cases = [
      { status: BookingStatus.ACCEPTED, code: ErrorCode.BOOKING_ALREADY_ACCEPTED },
      { status: BookingStatus.REJECTED, code: ErrorCode.BOOKING_REJECTED },
      { status: BookingStatus.CANCELLED, code: ErrorCode.BOOKING_CANCELLED },
      { status: BookingStatus.CONFIRMED, code: ErrorCode.BOOKING_NOT_PENDING },
    ] as const;

    for (const item of cases) {
      const setup = await pendingBooking();
      await prisma.booking.update({
        where: { id: setup.bookingId },
        data: { status: item.status },
      });
      const response = await setup.studentAgent.post(`/bookings/${setup.bookingId}/reject`).send({ reason });
      expect(response.status).toBe(409);
      expect(response.body.code).toBe(item.code);
    }
  });

  it('lets the Help Seeker request another Student after a rejection', async () => {
    const setup = await pendingBooking();
    const rejected = await setup.studentAgent.post(`/bookings/${setup.bookingId}/reject`).send({ reason });
    expect(rejected.status).toBe(200);

    const other = await createVerifiedStudent(`${uniqueLocal('next')}@tum.de`);
    await addSkill(other.profileId, setup.furnitureId);
    await addDayAvailability(other.profileId);
    const next = await setup.seekerAgent.post(`/tasks/${setup.taskId}/bookings`).send({
      studentId: other.profileId,
    });
    expect(next.status).toBe(201);
    expect(next.body.booking.status).toBe(BookingStatus.PENDING);
    expect(next.body.booking.student.id).toBe(other.profileId);

    const again = await setup.seekerAgent.post(`/tasks/${setup.taskId}/bookings`).send({
      studentId: setup.student.profileId,
    });
    expect(again.status).toBe(201);
    expect(again.body.booking.status).toBe(BookingStatus.PENDING);
    expect(again.body.booking.id).not.toBe(setup.bookingId);

    const task = await prisma.task.findUniqueOrThrow({ where: { id: setup.taskId } });
    expect(task.status).toBe(TaskStatus.PUBLISHED);
  });

  it('lets only one concurrent reject succeed', async () => {
    const setup = await pendingBooking();
    const [first, second] = await Promise.all([
      setup.studentAgent.post(`/bookings/${setup.bookingId}/reject`).send({ reason }),
      setup.studentAgent.post(`/bookings/${setup.bookingId}/reject`).send({
        reason: 'I already have too many jobs this week.',
      }),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);
    const stored = await prisma.booking.findUniqueOrThrow({ where: { id: setup.bookingId } });
    expect(stored.status).toBe(BookingStatus.REJECTED);
    const rejectedHistory = await prisma.bookingStatusHistory.count({
      where: { bookingId: setup.bookingId, toStatus: BookingStatus.REJECTED },
    });
    expect(rejectedHistory).toBe(1);
  });
});
