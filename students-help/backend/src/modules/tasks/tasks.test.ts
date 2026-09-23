import { TaskStatus } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { loadEnv } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import { ErrorCode } from '../../shared/errors.js';
import { ensureSkillCatalog } from '../skills/skill-catalog.js';

const app = createApp({ env: loadEnv() });

const helpSeekerRegistration = {
  fullName: 'Alex Example',
  email: 'seeker.tasks@example.com',
  phone: '+46701234567',
  address: 'Example Street 10, 111 22 Stockholm',
  preferredPaymentMethod: 'CARD',
  password: 'securePass12',
};

const studentPassword = 'securePass12';

function uniqueEmail(label: string): string {
  return `${label}.${Date.now()}.${Math.random().toString(16).slice(2)}@example.com`;
}

async function registerHelpSeeker(email = uniqueEmail('seeker')) {
  const agent = request.agent(app);
  const response = await agent.post('/auth/register/help-seeker').send({
    ...helpSeekerRegistration,
    email,
  });
  expect(response.status).toBe(201);
  return { agent, email, userId: response.body.user.id as string };
}

async function registerAndLoginStudent(email: string) {
  await request(app).post('/auth/register/student').send({ email, password: studentPassword }).expect(201);
  const agent = request.agent(app);
  await agent.post('/auth/login').send({ email, password: studentPassword }).expect(200);
  return agent;
}

async function furnitureSkill() {
  return prisma.skill.findUniqueOrThrow({
    where: { slug: 'furniture-assembly' },
    select: { id: true, name: true, category: true },
  });
}

function validTask(skillId: string, overrides: Record<string, unknown> = {}) {
  return {
    title: 'Furniture Assembly',
    description: 'Assemble one wardrobe and two bedside tables from flat-pack packages.',
    skillIds: [skillId],
    location: { addressLine: 'Example Street 10, 111 22 Stockholm' },
    timezone: 'Europe/Stockholm',
    preferredDate: '2028-09-20',
    preferredTime: '10:00',
    estimatedDurationMinutes: 180,
    ...overrides,
  };
}

describe('Help Seeker task creation', () => {
  beforeAll(async () => {
    await ensureSkillCatalog(prisma);
  });

  beforeEach(async () => {
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
    await prisma.skill.updateMany({ data: { isActive: true } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('lets an authenticated Help Seeker create a published task with skills and location', async () => {
    const skill = await furnitureSkill();
    const { agent, userId } = await registerHelpSeeker();

    const response = await agent.post('/tasks').send(validTask(skill.id, { photoIds: [] }));

    expect(response.status).toBe(201);
    expect(response.body.task).toMatchObject({
      title: 'Furniture Assembly',
      description: 'Assemble one wardrobe and two bedside tables from flat-pack packages.',
      location: { addressLine: 'Example Street 10, 111 22 Stockholm' },
      timezone: 'Europe/Stockholm',
      preferredDate: '2028-09-20',
      preferredTime: '10:00',
      estimatedDurationMinutes: 180,
      specialInstructions: null,
      status: TaskStatus.PUBLISHED,
    });
    expect(response.body.task.id).toBeTruthy();
    expect(response.body.task.preferredStartAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(response.body.task.skills).toEqual([
      expect.objectContaining({ id: skill.id, name: skill.name, category: skill.category }),
    ]);
    expect(response.body.task).not.toHaveProperty('helpSeekerProfileId');
    expect(response.body.task).not.toHaveProperty('userId');
    expect(response.body.task).not.toHaveProperty('locationLine');
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash/);
    expect(JSON.stringify(response.body)).not.toMatch(/securePass12/);

    const stored = await prisma.task.findUniqueOrThrow({
      where: { id: response.body.task.id },
      include: { skills: true, helpSeekerProfile: true },
    });
    expect(stored.helpSeekerProfile.userId).toBe(userId);
    expect(stored.skills).toEqual([expect.objectContaining({ skillId: skill.id })]);
    expect(stored.status).toBe(TaskStatus.PUBLISHED);
  });

  it('rejects a Student creating a Help Seeker task', async () => {
    const skill = await furnitureSkill();
    const agent = await registerAndLoginStudent('student.tasks@tum.de');
    const response = await agent.post('/tasks').send(validTask(skill.id));

    expect(response.status).toBe(403);
    expect(response.body.code).toBe(ErrorCode.FORBIDDEN);
    expect(await prisma.task.count()).toBe(0);
  });

  it('rejects an unauthenticated create-task request', async () => {
    const skill = await furnitureSkill();
    const response = await request(app).post('/tasks').send(validTask(skill.id));

    expect(response.status).toBe(401);
    expect(response.body.code).toBe(ErrorCode.UNAUTHORIZED);
    expect(await prisma.task.count()).toBe(0);
  });

  it('requires a title', async () => {
    const skill = await furnitureSkill();
    const { agent } = await registerHelpSeeker();
    const response = await agent.post('/tasks').send(validTask(skill.id, { title: '  ' }));

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'title', message: 'Title is required.' })]),
    );
  });

  it('requires a description', async () => {
    const skill = await furnitureSkill();
    const { agent } = await registerHelpSeeker();
    const response = await agent.post('/tasks').send(validTask(skill.id, { description: '' }));

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(response.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'description', message: 'Description is required.' }),
      ]),
    );
  });

  it('requires at least one skill', async () => {
    const skill = await furnitureSkill();
    const { agent } = await registerHelpSeeker();
    const response = await agent.post('/tasks').send(validTask(skill.id, { skillIds: [] }));

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(ErrorCode.TASK_SKILL_REQUIRED);
    expect(response.body.message).toBe('Select at least one required skill.');
  });

  it('rejects an unknown skill id', async () => {
    const { agent } = await registerHelpSeeker();
    const response = await agent.post('/tasks').send(validTask('skill_does_not_exist'));

    expect(response.status).toBe(404);
    expect(response.body.code).toBe(ErrorCode.SKILL_NOT_FOUND);
    expect(await prisma.task.count()).toBe(0);
  });

  it('rejects duplicate skill ids', async () => {
    const skill = await furnitureSkill();
    const { agent } = await registerHelpSeeker();
    const response = await agent.post('/tasks').send(validTask(skill.id, { skillIds: [skill.id, skill.id] }));

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(response.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'skillIds',
          message: 'Remove duplicate skills before publishing.',
        }),
      ]),
    );
  });

  it('requires a location', async () => {
    const skill = await furnitureSkill();
    const { agent } = await registerHelpSeeker();
    const response = await agent.post('/tasks').send(validTask(skill.id, { location: { addressLine: '  ' } }));

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(ErrorCode.INVALID_LOCATION);
    expect(response.body.message).toBe('Enter a location for this task.');
  });

  it('requires a date', async () => {
    const skill = await furnitureSkill();
    const { agent } = await registerHelpSeeker();
    const response = await agent.post('/tasks').send(validTask(skill.id, { preferredDate: '   ' }));

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'preferredDate', message: 'Date is required.' })]),
    );
  });

  it('requires a time', async () => {
    const skill = await furnitureSkill();
    const { agent } = await registerHelpSeeker();
    const response = await agent.post('/tasks').send(validTask(skill.id, { preferredTime: '' }));

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'preferredTime', message: 'Time is required.' })]),
    );
  });

  it('rejects a past task date and time', async () => {
    const skill = await furnitureSkill();
    const { agent } = await registerHelpSeeker();
    const response = await agent.post('/tasks').send(
      validTask(skill.id, {
        preferredDate: '2020-01-15',
        preferredTime: '10:00',
      }),
    );

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(ErrorCode.INVALID_TASK_DATE);
    expect(response.body.message).toBe('Choose a future date and time.');
  });

  it('requires a duration', async () => {
    const skill = await furnitureSkill();
    const { agent } = await registerHelpSeeker();
    const payload = validTask(skill.id);
    delete (payload as { estimatedDurationMinutes?: number }).estimatedDurationMinutes;
    const response = await agent.post('/tasks').send(payload);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(ErrorCode.INVALID_DURATION);
    expect(response.body.message).toBe('Enter a valid estimated duration.');
  });

  it('rejects zero or negative duration', async () => {
    const skill = await furnitureSkill();
    const { agent } = await registerHelpSeeker();

    const zero = await agent.post('/tasks').send(validTask(skill.id, { estimatedDurationMinutes: 0 }));
    expect(zero.status).toBe(400);
    expect(zero.body.code).toBe(ErrorCode.INVALID_DURATION);

    const negative = await agent.post('/tasks').send(validTask(skill.id, { estimatedDurationMinutes: -30 }));
    expect(negative.status).toBe(400);
    expect(negative.body.code).toBe(ErrorCode.INVALID_DURATION);
  });

  it('allows omitting optional photos and special instructions', async () => {
    const skill = await furnitureSkill();
    const { agent } = await registerHelpSeeker();
    const payload = validTask(skill.id);
    const response = await agent.post('/tasks').send(payload);

    expect(response.status).toBe(201);
    expect(response.body.task.specialInstructions).toBeNull();
    expect(response.body.task).not.toHaveProperty('photoIds');
  });

  it('persists optional special instructions when provided', async () => {
    const skill = await furnitureSkill();
    const { agent } = await registerHelpSeeker();
    const response = await agent.post('/tasks').send(
      validTask(skill.id, {
        specialInstructions: '  Please bring basic assembly tools.  ',
      }),
    );

    expect(response.status).toBe(201);
    expect(response.body.task.specialInstructions).toBe('Please bring basic assembly tools.');
  });

  it('assigns ownership from the session and rejects owner ids in the body', async () => {
    const skill = await furnitureSkill();
    const first = await registerHelpSeeker();
    const second = await registerHelpSeeker();
    const otherProfile = await prisma.helpSeekerProfile.findUniqueOrThrow({
      where: { userId: first.userId },
      select: { id: true },
    });

    const rejected = await second.agent.post('/tasks').send({
      ...validTask(skill.id),
      helpSeekerProfileId: otherProfile.id,
      userId: first.userId,
    });
    expect(rejected.status).toBe(400);
    expect(rejected.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(await prisma.task.count()).toBe(0);

    const created = await second.agent.post('/tasks').send(validTask(skill.id));
    expect(created.status).toBe(201);
    const stored = await prisma.task.findUniqueOrThrow({
      where: { id: created.body.task.id },
      include: { helpSeekerProfile: true },
    });
    expect(stored.helpSeekerProfile.userId).toBe(second.userId);
    expect(stored.helpSeekerProfileId).not.toBe(otherProfile.id);
  });

  it('creates TaskSkill rows for each required skill', async () => {
    const furniture = await furnitureSkill();
    const driving = await prisma.skill.findUniqueOrThrow({
      where: { slug: 'driving' },
      select: { id: true },
    });
    const { agent } = await registerHelpSeeker();
    const response = await agent.post('/tasks').send(validTask(furniture.id, { skillIds: [furniture.id, driving.id] }));

    expect(response.status).toBe(201);
    expect(response.body.task.skills).toHaveLength(2);
    const rows = await prisma.taskSkill.findMany({ where: { taskId: response.body.task.id } });
    expect(rows.map((row) => row.skillId).sort()).toEqual([driving.id, furniture.id].sort());
  });

  it('rolls back the task when skill relations fail to create', async () => {
    const skill = await furnitureSkill();
    const failingPrisma = prisma.$extends({
      query: {
        taskSkill: {
          async createMany() {
            throw new Error('forced task skill failure');
          },
        },
      },
    });
    const failingApp = createApp({
      env: loadEnv(),
      prisma: failingPrisma as unknown as PrismaClient,
    });
    const agent = request.agent(failingApp);
    await agent
      .post('/auth/register/help-seeker')
      .send({ ...helpSeekerRegistration, email: uniqueEmail('rollback') })
      .expect(201);

    const response = await agent.post('/tasks').send(validTask(skill.id));

    expect(response.status).toBe(500);
    expect(response.body.code).toBe(ErrorCode.TASK_CREATION_FAILED);
    expect(await prisma.task.count()).toBe(0);
    expect(await prisma.taskSkill.count()).toBe(0);
  });

  it('lets the owner read the published task and hides it from another Help Seeker', async () => {
    const skill = await furnitureSkill();
    const owner = await registerHelpSeeker();
    const created = await owner.agent.post('/tasks').send(validTask(skill.id));
    expect(created.status).toBe(201);

    const own = await owner.agent.get(`/tasks/${created.body.task.id}`);
    expect(own.status).toBe(200);
    expect(own.body.task.id).toBe(created.body.task.id);
    expect(own.body.task).not.toHaveProperty('helpSeekerProfileId');

    const other = await registerHelpSeeker();
    const forbidden = await other.agent.get(`/tasks/${created.body.task.id}`);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.code).toBe(ErrorCode.FORBIDDEN);
  });
});
