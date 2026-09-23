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
import { zonedLocalToUtc } from '../availability/availability.time.js';
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
    furnitureId: furniture.id,
    seekerAgent: agent,
    student,
    studentAgent,
    taskId: created.body.task.id as string,
    bookingId: booked.body.booking.id as string,
  };
}

describe('Student accept booking', () => {
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

  it('lets the recipient Student accept a PENDING booking', async () => {
    const setup = await pendingBooking();
    const response = await setup.studentAgent.post(`/bookings/${setup.bookingId}/accept`).send({});
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Booking accepted.');
    expect(response.body.booking.status).toBe(BookingStatus.ACCEPTED);
    expect(response.body.booking.id).toBe(setup.bookingId);
    expect(response.body.booking.progress.steps).toEqual([
      expect.objectContaining({ id: 'REQUEST', state: 'complete' }),
      expect.objectContaining({ id: 'ACCEPT', state: 'complete', label: 'Student accepted' }),
      expect.objectContaining({ id: 'HOLD', state: 'current', label: 'Payment authorization pending' }),
      expect.objectContaining({ id: 'CONFIRMED', state: 'upcoming' }),
    ]);
    expect(response.body.booking.task.description).toContain('wardrobe');
    expect(JSON.stringify(response.body)).not.toMatch(/@tum\.de/);
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash/);

    const stored = await prisma.booking.findUniqueOrThrow({
      where: { id: setup.bookingId },
      include: { statusHistory: { orderBy: { createdAt: 'asc' } } },
    });
    expect(stored.status).toBe(BookingStatus.ACCEPTED);
    expect(stored.statusHistory.map((row) => row.toStatus)).toEqual([
      BookingStatus.PENDING,
      BookingStatus.ACCEPTED,
    ]);
    expect(stored.statusHistory[1]).toMatchObject({
      fromStatus: BookingStatus.PENDING,
      toStatus: BookingStatus.ACCEPTED,
      changedByUserId: setup.student.userId,
    });

    const seekerView = await setup.seekerAgent.get(`/bookings/${setup.bookingId}`);
    expect(seekerView.status).toBe(200);
    expect(seekerView.body.booking.status).toBe(BookingStatus.ACCEPTED);
    expect(seekerView.body.booking.statusHistory.map((event: { status: string }) => event.status)).toEqual([
      BookingStatus.PENDING,
      BookingStatus.ACCEPTED,
    ]);
    expect(seekerView.body.booking.progress.steps).toEqual([
      expect.objectContaining({ id: 'REQUEST', state: 'complete' }),
      expect.objectContaining({ id: 'ACCEPT', state: 'complete', label: 'Student accepted' }),
      expect.objectContaining({ id: 'HOLD', state: 'current', label: 'Payment authorization pending' }),
      expect.objectContaining({ id: 'CONFIRMED', state: 'upcoming' }),
    ]);
    expect(JSON.stringify(seekerView.body)).not.toMatch(/PAYMENT_HELD/);
  });

  it('rejects extra client-controlled accept fields', async () => {
    const setup = await pendingBooking();
    const response = await setup.studentAgent.post(`/bookings/${setup.bookingId}/accept`).send({
      status: BookingStatus.CONFIRMED,
      studentId: setup.student.profileId,
    });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    const stored = await prisma.booking.findUniqueOrThrow({ where: { id: setup.bookingId } });
    expect(stored.status).toBe(BookingStatus.PENDING);
  });

  it('rejects unauthenticated, Help Seeker, and other Student accept attempts', async () => {
    const setup = await pendingBooking();
    const anon = await request(app).post(`/bookings/${setup.bookingId}/accept`).send({});
    expect(anon.status).toBe(401);

    const seeker = await setup.seekerAgent.post(`/bookings/${setup.bookingId}/accept`).send({});
    expect(seeker.status).toBe(403);

    const other = await createVerifiedStudent(`${uniqueLocal('other')}@tum.de`);
    const otherAgent = request.agent(app);
    await otherAgent.post('/auth/login').send({ email: other.email, password }).expect(200);
    const foreign = await otherAgent.post(`/bookings/${setup.bookingId}/accept`).send({});
    expect(foreign.status).toBe(403);
    expect(foreign.body.code).toBe(ErrorCode.FORBIDDEN);
  });

  it('rejects an unknown booking', async () => {
    const student = await createVerifiedStudent(`${uniqueLocal('miss')}@tum.de`);
    const studentAgent = request.agent(app);
    await studentAgent.post('/auth/login').send({ email: student.email, password }).expect(200);
    const response = await studentAgent.post('/bookings/does-not-exist/accept').send({});
    expect(response.status).toBe(404);
    expect(response.body.code).toBe(ErrorCode.BOOKING_NOT_FOUND);
  });

  it('rejects accept for non-PENDING statuses', async () => {
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
      const response = await setup.studentAgent.post(`/bookings/${setup.bookingId}/accept`).send({});
      expect(response.status).toBe(409);
      expect(response.body.code).toBe(item.code);
    }
  });

  it('rejects accept when the Student is no longer available', async () => {
    const setup = await pendingBooking();
    await prisma.recurringAvailability.deleteMany({ where: { studentProfileId: setup.student.profileId } });
    const response = await setup.studentAgent.post(`/bookings/${setup.bookingId}/accept`).send({});
    expect(response.status).toBe(409);
    expect(response.body.code).toBe(ErrorCode.STUDENT_NOT_AVAILABLE);
    expect(response.body.message).toBe('This booking no longer fits your availability.');
  });

  it('rejects accept when a vacation covers the task', async () => {
    const setup = await pendingBooking();
    await prisma.unavailablePeriod.create({
      data: {
        studentProfileId: setup.student.profileId,
        startDateTime: zonedLocalToUtc('Europe/Stockholm', 2028, 9, 20),
        endDateTime: zonedLocalToUtc('Europe/Stockholm', 2028, 9, 21),
        reason: 'Vacation',
      },
    });
    const response = await setup.studentAgent.post(`/bookings/${setup.bookingId}/accept`).send({});
    expect(response.status).toBe(409);
    expect(response.body.code).toBe(ErrorCode.STUDENT_NOT_AVAILABLE);
  });

  it('rejects an overlapping accepted booking and allows a back-to-back booking', async () => {
    const setup = await pendingBooking();
    const accepted = await setup.studentAgent.post(`/bookings/${setup.bookingId}/accept`).send({});
    expect(accepted.status).toBe(200);

    const overlapTask = await setup.seekerAgent.post('/tasks').send(
      taskPayload([setup.furnitureId], '11:00', 180),
    );
    expect(overlapTask.status).toBe(201);
    const overlapBooked = await setup.seekerAgent.post(`/tasks/${overlapTask.body.task.id}/bookings`).send({
      studentId: setup.student.profileId,
    });
    expect(overlapBooked.status).toBe(201);
    const conflict = await setup.studentAgent
      .post(`/bookings/${overlapBooked.body.booking.id}/accept`)
      .send({});
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe(ErrorCode.BOOKING_CONFLICT);
    expect(conflict.body.message).toBe('You already have another booking during this time.');

    const nextTask = await setup.seekerAgent.post('/tasks').send(
      taskPayload([setup.furnitureId], '13:00', 60),
    );
    expect(nextTask.status).toBe(201);
    const nextBooked = await setup.seekerAgent.post(`/tasks/${nextTask.body.task.id}/bookings`).send({
      studentId: setup.student.profileId,
    });
    expect(nextBooked.status).toBe(201);
    const backToBack = await setup.studentAgent
      .post(`/bookings/${nextBooked.body.booking.id}/accept`)
      .send({});
    expect(backToBack.status).toBe(200);
    expect(backToBack.body.booking.status).toBe(BookingStatus.ACCEPTED);
  });

  it('lets only one concurrent accept succeed', async () => {
    const setup = await pendingBooking();
    const [first, second] = await Promise.all([
      setup.studentAgent.post(`/bookings/${setup.bookingId}/accept`).send({}),
      setup.studentAgent.post(`/bookings/${setup.bookingId}/accept`).send({}),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);
    const stored = await prisma.booking.findUniqueOrThrow({ where: { id: setup.bookingId } });
    expect(stored.status).toBe(BookingStatus.ACCEPTED);
    const acceptedHistory = await prisma.bookingStatusHistory.count({
      where: { bookingId: setup.bookingId, toStatus: BookingStatus.ACCEPTED },
    });
    expect(acceptedHistory).toBe(1);
  });
});
