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

describe('Student payment timeline', () => {
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

  it('lets the assigned Student retrieve a payment-pending timeline', async () => {
    const setup = await acceptedBooking();
    const response = await setup.studentAgent.get(`/bookings/${setup.bookingId}/payment-timeline`);
    expect(response.status).toBe(200);
    expect(response.body.paymentTimeline.bookingId).toBe(setup.bookingId);
    expect(response.body.paymentTimeline.paymentStatus).toBe('NOT_STARTED');
    expect(response.body.paymentTimeline.headline).toBe('PAYMENT_PENDING');
    expect(response.body.paymentTimeline.currency).toBe('EUR');
    expect(response.body.paymentTimeline.estimatedEarnings.amountMinor).toBe(4500);
    expect(response.body.paymentTimeline.taskAmount.amountMinor).toBe(4500);
    expect(response.body.paymentTimeline.platformFee.amountMinor).toBe(450);
    expect(response.body.paymentTimeline.customerTotal.amountMinor).toBe(4950);
    expect(response.body.paymentTimeline.timeline.map((step: { key: string }) => step.key)).toEqual([
      'ACCEPTED',
      'HELD',
      'DONE',
      'CONFIRMED',
      'PAID',
    ]);
    expect(response.body.paymentTimeline.timeline[0]).toMatchObject({
      key: 'ACCEPTED',
      status: 'COMPLETED',
    });
    expect(response.body.paymentTimeline.timeline[1]).toMatchObject({
      key: 'HELD',
      status: 'CURRENT',
      label: 'Waiting for payment authorization',
    });
    expect(JSON.stringify(response.body)).not.toMatch(/sk_(test|live)_/);
    expect(JSON.stringify(response.body)).not.toMatch(/providerPaymentId/);
    expect(JSON.stringify(response.body)).not.toMatch(/idempotencyKey/);
    expect(JSON.stringify(response.body)).not.toMatch(/cvv/i);
  });

  it('rejects another Student', async () => {
    const setup = await acceptedBooking();
    const other = await createVerifiedStudent(`${uniqueLocal('other')}@tum.de`);
    const otherAgent = request.agent(app);
    await otherAgent.post('/auth/login').send({ email: other.email, password }).expect(200);
    const response = await otherAgent.get(`/bookings/${setup.bookingId}/payment-timeline`);
    expect(response.status).toBe(403);
    expect(response.body.code).toBe(ErrorCode.FORBIDDEN);
  });

  it('rejects an unauthenticated request', async () => {
    const setup = await acceptedBooking();
    const response = await request(app).get(`/bookings/${setup.bookingId}/payment-timeline`);
    expect(response.status).toBe(401);
    expect(response.body.code).toBe(ErrorCode.UNAUTHORIZED);
  });

  it('rejects the Help Seeker from the Student timeline', async () => {
    const setup = await acceptedBooking();
    const response = await setup.seekerAgent.get(`/bookings/${setup.bookingId}/payment-timeline`);
    expect(response.status).toBe(403);
    expect(response.body.code).toBe(ErrorCode.FORBIDDEN);
  });

  it('maps an AUTHORIZED payment to reserved without marking Paid', async () => {
    const setup = await acceptedBooking();
    await setup.seekerAgent.post(`/bookings/${setup.bookingId}/payment/authorization`).send({});
    const response = await setup.studentAgent.get(`/bookings/${setup.bookingId}/payment-timeline`);
    expect(response.status).toBe(200);
    expect(response.body.paymentTimeline.paymentStatus).toBe('AUTHORIZED');
    expect(response.body.paymentTimeline.headline).toBe('PAYMENT_RESERVED');
    expect(response.body.paymentTimeline.estimatedEarnings.amountMinor).toBe(4500);
    expect(response.body.paymentTimeline.timeline[1]).toMatchObject({
      key: 'HELD',
      status: 'COMPLETED',
      label: 'Customer payment reserved',
    });
    expect(response.body.paymentTimeline.timeline[2].status).toBe('CURRENT');
    expect(response.body.paymentTimeline.timeline[4].status).toBe('UPCOMING');
    expect(JSON.stringify(response.body)).not.toMatch(/requires_capture/);
    expect(JSON.stringify(response.body)).not.toMatch(/mock_auth_/);
  });

  it('maps a failed authorization without advancing later steps', async () => {
    const setup = await acceptedBooking();
    await setup.seekerAgent
      .post(`/bookings/${setup.bookingId}/payment/authorization`)
      .send({ paymentMethodRef: 'pm_test_declined' });
    const response = await setup.studentAgent.get(`/bookings/${setup.bookingId}/payment-timeline`);
    expect(response.status).toBe(200);
    expect(response.body.paymentTimeline.paymentStatus).toBe('FAILED');
    expect(response.body.paymentTimeline.headline).toBe('PAYMENT_FAILED');
    expect(response.body.paymentTimeline.timeline[1].status).toBe('FAILED');
    expect(response.body.paymentTimeline.timeline[2].status).toBe('UPCOMING');
    expect(response.body.paymentTimeline.timeline[4].status).toBe('UPCOMING');
  });

  it('does not treat Booking CONFIRMED as captured payout', async () => {
    const setup = await acceptedBooking();
    await setup.seekerAgent.post(`/bookings/${setup.bookingId}/payment/authorization`).send({});
    await prisma.booking.update({
      where: { id: setup.bookingId },
      data: { status: BookingStatus.CONFIRMED },
    });
    const response = await setup.studentAgent.get(`/bookings/${setup.bookingId}/payment-timeline`);
    expect(response.status).toBe(200);
    expect(response.body.paymentTimeline.headline).toBe('PAYMENT_RESERVED');
    expect(response.body.paymentTimeline.timeline.find((step: { key: string }) => step.key === 'PAID').status).toBe(
      'UPCOMING',
    );
    expect(
      response.body.paymentTimeline.timeline.find((step: { key: string }) => step.key === 'CONFIRMED').status,
    ).toBe('UPCOMING');
  });

  it('rejects an unknown booking', async () => {
    const setup = await acceptedBooking();
    const response = await setup.studentAgent.get('/bookings/missing-booking/payment-timeline');
    expect(response.status).toBe(404);
    expect(response.body.code).toBe(ErrorCode.BOOKING_NOT_FOUND);
  });
});
