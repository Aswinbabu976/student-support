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

const app = createApp({ env: loadEnv() });
const password = 'securePass12';

const helpSeekerRegistration = {
  fullName: 'Alex Example',
  email: 'seeker.booking@example.com',
  phone: '+46701234567',
  address: 'Marienplatz 1, 80331 Munich',
  preferredPaymentMethod: 'CARD',
  password,
};

function uniqueLocal(label: string): string {
  return `${label}.${Date.now()}.${Math.random().toString(16).slice(2)}`;
}

async function registerHelpSeeker(email = `${uniqueLocal('seeker')}@example.com`) {
  const agent = request.agent(app);
  const response = await agent.post('/auth/register/help-seeker').send({
    ...helpSeekerRegistration,
    email,
  });
  expect(response.status).toBe(201);
  return { agent, email, userId: response.body.user.id as string };
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

async function addSkill(profileId: string, skillId: string, experienceLevel: ExperienceLevel) {
  await prisma.studentSkill.create({
    data: { studentProfileId: profileId, skillId, experienceLevel },
  });
}

async function addWednesdayAvailability(profileId: string) {
  await prisma.studentProfile.update({
    where: { id: profileId },
    data: { timezone: 'Europe/Stockholm' },
  });
  await prisma.recurringAvailability.create({
    data: {
      studentProfileId: profileId,
      dayOfWeek: DayOfWeek.WEDNESDAY,
      startTime: '09:00',
      endTime: '14:00',
      isActive: true,
    },
  });
}

async function catalog(slug: string) {
  return prisma.skill.findUniqueOrThrow({ where: { slug }, select: { id: true, name: true } });
}

function validTask(skillIds: string[]) {
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

describe('Booking requests', () => {
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

  it('lets an authenticated Help Seeker create a PENDING booking for an eligible Student', async () => {
    const furniture = await catalog('furniture-assembly');
    const { agent } = await registerHelpSeeker();
    const created = await agent.post('/tasks').send(validTask([furniture.id]));
    expect(created.status).toBe(201);
    const student = await createVerifiedStudent(`${uniqueLocal('ok')}@tum.de`);
    await addSkill(student.profileId, furniture.id, ExperienceLevel.ADVANCED);
    await addWednesdayAvailability(student.profileId);

    const response = await agent.post(`/tasks/${created.body.task.id}/bookings`).send({
      studentId: student.profileId,
      status: BookingStatus.CONFIRMED,
      helpSeekerId: 'ignored',
    });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe(ErrorCode.VALIDATION_ERROR);

    const booked = await agent.post(`/tasks/${created.body.task.id}/bookings`).send({
      studentId: student.profileId,
    });
    expect(booked.status).toBe(201);
    expect(booked.body.message).toBe('Booking request sent.');
    expect(booked.body.booking).toMatchObject({
      status: BookingStatus.PENDING,
      task: { id: created.body.task.id, title: 'Furniture Assembly' },
      student: { id: student.profileId, verificationStatus: VerificationStatus.VERIFIED },
    });
    expect(booked.body.booking.student).toEqual({
      id: student.profileId,
      verificationStatus: VerificationStatus.VERIFIED,
    });
    expect(JSON.stringify(booked.body)).not.toMatch(/@tum\.de/);
    expect(JSON.stringify(booked.body)).not.toMatch(/passwordHash/);

    const stored = await prisma.booking.findUniqueOrThrow({
      where: { id: booked.body.booking.id },
      include: { statusHistory: true },
    });
    expect(stored.status).toBe(BookingStatus.PENDING);
    expect(stored.taskId).toBe(created.body.task.id);
    expect(stored.studentProfileId).toBe(student.profileId);
    expect(stored.statusHistory).toEqual([
      expect.objectContaining({ fromStatus: null, toStatus: BookingStatus.PENDING }),
    ]);
  });

  it('lets involved users retrieve the booking and blocks others', async () => {
    const furniture = await catalog('furniture-assembly');
    const { agent } = await registerHelpSeeker();
    const created = await agent.post('/tasks').send(validTask([furniture.id]));
    const student = await createVerifiedStudent(`${uniqueLocal('read')}@tum.de`);
    await addSkill(student.profileId, furniture.id, ExperienceLevel.ADVANCED);
    await addWednesdayAvailability(student.profileId);
    const booked = await agent.post(`/tasks/${created.body.task.id}/bookings`).send({
      studentId: student.profileId,
    });
    expect(booked.status).toBe(201);

    const ownerView = await agent.get(`/bookings/${booked.body.booking.id}`);
    expect(ownerView.status).toBe(200);
    expect(ownerView.body.booking.id).toBe(booked.body.booking.id);
    expect(ownerView.body.booking.status).toBe(BookingStatus.PENDING);
    expect(ownerView.body.booking.progress.summary).toBe(
      'Your booking is not confirmed yet. The Student needs to accept your request first.',
    );
    expect(ownerView.body.booking.progress.steps).toEqual([
      expect.objectContaining({ id: 'REQUEST', state: 'complete', label: 'Request sent' }),
      expect.objectContaining({ id: 'ACCEPT', state: 'current', label: 'Waiting for Student' }),
      expect.objectContaining({ id: 'HOLD', state: 'upcoming', label: 'Payment authorization' }),
      expect.objectContaining({ id: 'CONFIRMED', state: 'upcoming', label: 'Booking confirmed' }),
    ]);
    expect(ownerView.body.booking.statusHistory).toEqual([
      expect.objectContaining({ status: BookingStatus.PENDING }),
    ]);

    const studentAgent = request.agent(app);
    await studentAgent.post('/auth/login').send({ email: student.email, password }).expect(200);
    const studentView = await studentAgent.get(`/bookings/${booked.body.booking.id}`);
    expect(studentView.status).toBe(200);
    expect(studentView.body.booking.student.id).toBe(student.profileId);
    expect(studentView.body.booking.progress.summary).toBe(
      'This booking is not confirmed yet. Accept or reject the request.',
    );
    expect(JSON.stringify(studentView.body)).not.toMatch(/@tum\.de/);

    const other = await registerHelpSeeker();
    const stranger = await other.agent.get(`/bookings/${booked.body.booking.id}`);
    expect(stranger.status).toBe(403);

    const otherStudent = await createVerifiedStudent(`${uniqueLocal('other-read')}@tum.de`);
    const otherStudentAgent = request.agent(app);
    await otherStudentAgent.post('/auth/login').send({ email: otherStudent.email, password }).expect(200);
    const otherStudentView = await otherStudentAgent.get(`/bookings/${booked.body.booking.id}`);
    expect(otherStudentView.status).toBe(403);
    expect(otherStudentView.body.code).toBe(ErrorCode.FORBIDDEN);

    expect(JSON.stringify(ownerView.body)).not.toMatch(/PAYMENT_HELD/);
    expect(
      ownerView.body.booking.progress.steps.every(
        (step: { id: string; state: string }) => step.state !== 'complete' || step.id === 'REQUEST',
      ),
    ).toBe(true);

    const missing = await agent.get('/bookings/does-not-exist');
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe(ErrorCode.BOOKING_NOT_FOUND);
  });

  it('rejects unauthenticated booking creation', async () => {
    const response = await request(app).post('/tasks/task_1/bookings').send({ studentId: 'student_1' });
    expect(response.status).toBe(401);
    expect(response.body.code).toBe(ErrorCode.UNAUTHORIZED);
  });

  it('rejects a Student creating a Help Seeker booking request', async () => {
    const furniture = await catalog('furniture-assembly');
    const { agent } = await registerHelpSeeker();
    const created = await agent.post('/tasks').send(validTask([furniture.id]));
    const student = await createVerifiedStudent(`${uniqueLocal('role')}@tum.de`);
    await addSkill(student.profileId, furniture.id, ExperienceLevel.ADVANCED);
    await addWednesdayAvailability(student.profileId);

    const studentAgent = request.agent(app);
    await studentAgent.post('/auth/login').send({ email: student.email, password }).expect(200);
    const response = await studentAgent.post(`/tasks/${created.body.task.id}/bookings`).send({
      studentId: student.profileId,
    });
    expect(response.status).toBe(403);
    expect(response.body.code).toBe(ErrorCode.FORBIDDEN);
  });

  it('rejects booking another Help Seeker’s task', async () => {
    const furniture = await catalog('furniture-assembly');
    const owner = await registerHelpSeeker();
    const created = await owner.agent.post('/tasks').send(validTask([furniture.id]));
    const student = await createVerifiedStudent(`${uniqueLocal('own')}@tum.de`);
    await addSkill(student.profileId, furniture.id, ExperienceLevel.ADVANCED);
    await addWednesdayAvailability(student.profileId);

    const other = await registerHelpSeeker();
    const response = await other.agent.post(`/tasks/${created.body.task.id}/bookings`).send({
      studentId: student.profileId,
    });
    expect(response.status).toBe(403);
    expect(response.body.code).toBe(ErrorCode.FORBIDDEN);
  });

  it('rejects an unknown task', async () => {
    const { agent } = await registerHelpSeeker();
    const response = await agent.post('/tasks/does-not-exist/bookings').send({ studentId: 'student_1' });
    expect(response.status).toBe(404);
    expect(response.body.code).toBe(ErrorCode.TASK_NOT_FOUND);
  });

  it('rejects an unknown Student', async () => {
    const furniture = await catalog('furniture-assembly');
    const { agent } = await registerHelpSeeker();
    const created = await agent.post('/tasks').send(validTask([furniture.id]));
    const response = await agent.post(`/tasks/${created.body.task.id}/bookings`).send({
      studentId: 'missing-student',
    });
    expect(response.status).toBe(404);
    expect(response.body.code).toBe(ErrorCode.STUDENT_NOT_FOUND);
  });

  it('rejects an unverified Student', async () => {
    const furniture = await catalog('furniture-assembly');
    const { agent } = await registerHelpSeeker();
    const created = await agent.post('/tasks').send(validTask([furniture.id]));
    const email = `${uniqueLocal('unv')}@tum.de`;
    await request(app).post('/auth/register/student').send({ email, password }).expect(201);
    const profile = await prisma.studentProfile.findFirstOrThrow({
      where: { user: { email } },
      select: { id: true },
    });
    await addSkill(profile.id, furniture.id, ExperienceLevel.EXPERT);
    await addWednesdayAvailability(profile.id);

    const response = await agent.post(`/tasks/${created.body.task.id}/bookings`).send({
      studentId: profile.id,
    });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe(ErrorCode.STUDENT_NOT_ELIGIBLE);
  });

  it('rejects a Student who does not have a required skill', async () => {
    const furniture = await catalog('furniture-assembly');
    const driving = await catalog('driving');
    const { agent } = await registerHelpSeeker();
    const created = await agent.post('/tasks').send(validTask([furniture.id]));
    const student = await createVerifiedStudent(`${uniqueLocal('skill')}@tum.de`);
    await addSkill(student.profileId, driving.id, ExperienceLevel.EXPERT);
    await addWednesdayAvailability(student.profileId);

    const response = await agent.post(`/tasks/${created.body.task.id}/bookings`).send({
      studentId: student.profileId,
    });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe(ErrorCode.STUDENT_NOT_ELIGIBLE);
  });

  it('rejects a Student who is no longer available', async () => {
    const furniture = await catalog('furniture-assembly');
    const { agent } = await registerHelpSeeker();
    const created = await agent.post('/tasks').send(validTask([furniture.id]));
    const student = await createVerifiedStudent(`${uniqueLocal('busy')}@tum.de`);
    await addSkill(student.profileId, furniture.id, ExperienceLevel.EXPERT);
    await prisma.studentProfile.update({
      where: { id: student.profileId },
      data: { timezone: 'Europe/Stockholm' },
    });
    await prisma.recurringAvailability.create({
      data: {
        studentProfileId: student.profileId,
        dayOfWeek: DayOfWeek.MONDAY,
        startTime: '09:00',
        endTime: '12:00',
        isActive: true,
      },
    });

    const response = await agent.post(`/tasks/${created.body.task.id}/bookings`).send({
      studentId: student.profileId,
    });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe(ErrorCode.STUDENT_NOT_AVAILABLE);
    expect(response.body.message).toBe('This Student is no longer available at the selected time.');
  });

  it('rejects a draft task', async () => {
    const furniture = await catalog('furniture-assembly');
    const { agent } = await registerHelpSeeker();
    const created = await agent.post('/tasks').send(validTask([furniture.id]));
    await prisma.task.update({
      where: { id: created.body.task.id },
      data: { status: TaskStatus.DRAFT },
    });
    const student = await createVerifiedStudent(`${uniqueLocal('draft')}@tum.de`);
    await addSkill(student.profileId, furniture.id, ExperienceLevel.ADVANCED);
    await addWednesdayAvailability(student.profileId);

    const response = await agent.post(`/tasks/${created.body.task.id}/bookings`).send({
      studentId: student.profileId,
    });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe(ErrorCode.TASK_NOT_BOOKABLE);
  });

  it('rejects a second active request and allows retry after REJECTED', async () => {
    const furniture = await catalog('furniture-assembly');
    const { agent } = await registerHelpSeeker();
    const created = await agent.post('/tasks').send(validTask([furniture.id]));
    const student = await createVerifiedStudent(`${uniqueLocal('dup')}@tum.de`);
    await addSkill(student.profileId, furniture.id, ExperienceLevel.ADVANCED);
    await addWednesdayAvailability(student.profileId);

    const first = await agent.post(`/tasks/${created.body.task.id}/bookings`).send({
      studentId: student.profileId,
    });
    expect(first.status).toBe(201);

    const duplicate = await agent.post(`/tasks/${created.body.task.id}/bookings`).send({
      studentId: student.profileId,
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe(ErrorCode.BOOKING_REQUEST_ALREADY_EXISTS);

    await prisma.booking.update({
      where: { id: first.body.booking.id },
      data: { status: BookingStatus.REJECTED },
    });

    const retry = await agent.post(`/tasks/${created.body.task.id}/bookings`).send({
      studentId: student.profileId,
    });
    expect(retry.status).toBe(201);
    expect(retry.body.booking.status).toBe(BookingStatus.PENDING);
    expect(retry.body.booking.id).not.toBe(first.body.booking.id);
  });

  it('protects concurrent duplicate requests', async () => {
    const furniture = await catalog('furniture-assembly');
    const { agent } = await registerHelpSeeker();
    const created = await agent.post('/tasks').send(validTask([furniture.id]));
    const student = await createVerifiedStudent(`${uniqueLocal('race')}@tum.de`);
    await addSkill(student.profileId, furniture.id, ExperienceLevel.ADVANCED);
    await addWednesdayAvailability(student.profileId);

    const [first, second] = await Promise.all([
      agent.post(`/tasks/${created.body.task.id}/bookings`).send({ studentId: student.profileId }),
      agent.post(`/tasks/${created.body.task.id}/bookings`).send({ studentId: student.profileId }),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);
    const createdCount = await prisma.booking.count({
      where: { taskId: created.body.task.id, studentProfileId: student.profileId },
    });
    expect(createdCount).toBe(1);
  });
});
