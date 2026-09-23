import {
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
  return { profileId: user.studentProfile!.id, email };
}

describe('Task cost estimate', () => {
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

  it('returns a deterministic estimate for the owning Help Seeker', async () => {
    const furniture = await prisma.skill.findUniqueOrThrow({
      where: { slug: 'furniture-assembly' },
      select: { id: true },
    });
    const { agent } = await registerHelpSeeker();
    const created = await agent.post('/tasks').send({
      title: 'Furniture Assembly',
      description: 'Assemble one wardrobe and two bedside tables from flat-pack packages.',
      skillIds: [furniture.id],
      location: { addressLine: 'Marienplatz 1, 80331 Munich' },
      timezone: 'Europe/Stockholm',
      preferredDate: '2028-09-20',
      preferredTime: '10:00',
      estimatedDurationMinutes: 180,
    });
    expect(created.status).toBe(201);

    const response = await agent.get(`/tasks/${created.body.task.id}/cost-estimate`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      estimate: {
        currency: 'EUR',
        estimatedDurationMinutes: 180,
        estimatedHours: 3,
        baseHourlyRate: { amountMinor: 1500 },
        subtotal: { amountMinor: 4500 },
        platformFee: { amountMinor: 450 },
        total: { amountMinor: 4950 },
      },
    });
  });

  it('blocks Students, other Help Seekers, unauthenticated callers, and missing tasks', async () => {
    const furniture = await prisma.skill.findUniqueOrThrow({
      where: { slug: 'furniture-assembly' },
      select: { id: true },
    });
    const { agent } = await registerHelpSeeker();
    const created = await agent.post('/tasks').send({
      title: 'Furniture Assembly',
      description: 'Assemble one wardrobe and two bedside tables from flat-pack packages.',
      skillIds: [furniture.id],
      location: { addressLine: 'Marienplatz 1, 80331 Munich' },
      timezone: 'Europe/Stockholm',
      preferredDate: '2028-09-20',
      preferredTime: '10:00',
      estimatedDurationMinutes: 180,
    });
    expect(created.status).toBe(201);
    const taskId = created.body.task.id as string;

    const student = await createVerifiedStudent(`${uniqueLocal('cost')}@tum.de`);
    await prisma.studentSkill.create({
      data: {
        studentProfileId: student.profileId,
        skillId: furniture.id,
        experienceLevel: ExperienceLevel.ADVANCED,
      },
    });
    const studentAgent = request.agent(app);
    await studentAgent.post('/auth/login').send({ email: student.email, password }).expect(200);
    const studentView = await studentAgent.get(`/tasks/${taskId}/cost-estimate`);
    expect(studentView.status).toBe(403);
    expect(studentView.body.code).toBe(ErrorCode.FORBIDDEN);

    const other = await registerHelpSeeker();
    const stranger = await other.agent.get(`/tasks/${taskId}/cost-estimate`);
    expect(stranger.status).toBe(403);
    expect(stranger.body.code).toBe(ErrorCode.FORBIDDEN);

    const unauthenticated = await request(app).get(`/tasks/${taskId}/cost-estimate`);
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body.code).toBe(ErrorCode.UNAUTHORIZED);

    const missing = await agent.get('/tasks/does-not-exist/cost-estimate');
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe(ErrorCode.TASK_NOT_FOUND);
  });

  it('uses the stored task duration and ignores client-supplied hours', async () => {
    const furniture = await prisma.skill.findUniqueOrThrow({
      where: { slug: 'furniture-assembly' },
      select: { id: true },
    });
    const { agent } = await registerHelpSeeker();
    const created = await agent.post('/tasks').send({
      title: 'Furniture Assembly',
      description: 'Assemble one wardrobe and two bedside tables from flat-pack packages.',
      skillIds: [furniture.id],
      location: { addressLine: 'Marienplatz 1, 80331 Munich' },
      timezone: 'Europe/Stockholm',
      preferredDate: '2028-09-20',
      preferredTime: '10:00',
      estimatedDurationMinutes: 180,
    });
    expect(created.status).toBe(201);
    const taskId = created.body.task.id as string;

    const first = await agent.get(`/tasks/${taskId}/cost-estimate`).query({
      estimatedHours: 1,
      estimatedDurationMinutes: 60,
    });
    const second = await agent.get(`/tasks/${taskId}/cost-estimate`).send({
      estimatedHours: 1,
      estimatedDurationMinutes: 60,
    });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body).toEqual(second.body);
    expect(first.body.estimate.estimatedDurationMinutes).toBe(180);
    expect(first.body.estimate.subtotal.amountMinor).toBe(4500);
    expect(first.body.estimate.platformFee.amountMinor).toBe(450);
    expect(first.body.estimate.total.amountMinor).toBe(4950);
    expect(first.body.estimate.currency).toBe('EUR');
  });

  it('rejects a stored task duration that cannot be priced', async () => {
    const furniture = await prisma.skill.findUniqueOrThrow({
      where: { slug: 'furniture-assembly' },
      select: { id: true },
    });
    const { agent } = await registerHelpSeeker();
    const created = await agent.post('/tasks').send({
      title: 'Furniture Assembly',
      description: 'Assemble one wardrobe and two bedside tables from flat-pack packages.',
      skillIds: [furniture.id],
      location: { addressLine: 'Marienplatz 1, 80331 Munich' },
      timezone: 'Europe/Stockholm',
      preferredDate: '2028-09-20',
      preferredTime: '10:00',
      estimatedDurationMinutes: 180,
    });
    expect(created.status).toBe(201);
    await prisma.task.update({
      where: { id: created.body.task.id },
      data: { estimatedDurationMinutes: 0 },
    });

    const response = await agent.get(`/tasks/${created.body.task.id}/cost-estimate`);
    expect(response.status).toBe(400);
    expect(response.body.code).toBe(ErrorCode.INVALID_DURATION);
    expect(response.body.message).toBe('Add a valid estimated duration before calculating cost.');
  });
});
