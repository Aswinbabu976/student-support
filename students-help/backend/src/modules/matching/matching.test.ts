import {
  DayOfWeek,
  ExperienceLevel,
  TaskStatus,
  UserRole,
  VerificationStatus,
} from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
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

const helpSeekerRegistration = {
  fullName: 'Alex Example',
  email: 'seeker.match@example.com',
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
  return { userId: user.id, profileId: user.studentProfile!.id };
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

function validTask(skillIds: string[], location = 'Marienplatz 1, 80331 Munich') {
  return {
    title: 'Furniture Assembly',
    description: 'Assemble one wardrobe and two bedside tables from flat-pack packages.',
    skillIds,
    location: { addressLine: location },
    timezone: 'Europe/Stockholm',
    preferredDate: '2028-09-20',
    preferredTime: '10:00',
    estimatedDurationMinutes: 180,
  };
}

describe('Student recommendations', () => {
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
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('lets the task owner receive ranked eligible Students', async () => {
    const furniture = await catalog('furniture-assembly');
    const { agent } = await registerHelpSeeker();
    const created = await agent.post('/tasks').send(validTask([furniture.id]));
    expect(created.status).toBe(201);

    const student = await createVerifiedStudent(`${uniqueLocal('ok')}@tum.de`);
    await addSkill(student.profileId, furniture.id, ExperienceLevel.ADVANCED);
    await addWednesdayAvailability(student.profileId);

    const response = await agent.get(`/tasks/${created.body.task.id}/recommendations`);
    expect(response.status).toBe(200);
    expect(response.body.taskId).toBe(created.body.task.id);
    expect(response.body.recommendations).toHaveLength(1);
    expect(response.body.recommendations[0]).toMatchObject({
      student: {
        id: student.profileId,
        verificationStatus: VerificationStatus.VERIFIED,
      },
      availability: { isAvailable: true },
      rating: null,
      completedJobsCount: 0,
      proximity: { distanceKm: null },
    });
    expect(response.body.recommendations[0].matchedSkills).toEqual([
      expect.objectContaining({ skillId: furniture.id, name: furniture.name, experienceLevel: ExperienceLevel.ADVANCED }),
    ]);
    expect(response.body.recommendations[0].reasons).toEqual(
      expect.arrayContaining([
        { type: 'SKILL', label: 'Matches your Furniture Assembly requirement' },
        { type: 'AVAILABILITY', label: 'Available at your requested time' },
        { type: 'PROXIMITY', label: 'Located in the same area' },
      ]),
    );
    expect(response.body.recommendations[0].matchFactors.availability.matched).toBe(true);
    expect(response.body.recommendations[0].student).not.toHaveProperty('email');
    expect(response.body.recommendations[0].student).not.toHaveProperty('fullName');
    expect(JSON.stringify(response.body)).not.toMatch(/@tum\.de/);
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash/);
    expect(JSON.stringify(response.body)).not.toMatch(/addressLine/);
    expect(JSON.stringify(response.body)).not.toMatch(/skillScore/);
    expect(JSON.stringify(response.body)).not.toMatch(/MATCHING_WEIGHTS/);
  });

  it('rejects an unauthenticated recommendations request', async () => {
    const furniture = await catalog('furniture-assembly');
    const { agent } = await registerHelpSeeker();
    const created = await agent.post('/tasks').send(validTask([furniture.id]));
    const response = await request(app).get(`/tasks/${created.body.task.id}/recommendations`);
    expect(response.status).toBe(401);
    expect(response.body.code).toBe(ErrorCode.UNAUTHORIZED);
  });

  it('rejects a Student requesting Help Seeker recommendations', async () => {
    const furniture = await catalog('furniture-assembly');
    const { agent } = await registerHelpSeeker();
    const created = await agent.post('/tasks').send(validTask([furniture.id]));
    const email = `${uniqueLocal('stu')}@tum.de`;
    await request(app).post('/auth/register/student').send({ email, password }).expect(201);
    const studentAgent = request.agent(app);
    await studentAgent.post('/auth/login').send({ email, password }).expect(200);
    const response = await studentAgent.get(`/tasks/${created.body.task.id}/recommendations`);
    expect(response.status).toBe(403);
    expect(response.body.code).toBe(ErrorCode.FORBIDDEN);
  });

  it('rejects another Help Seeker reading private task recommendations', async () => {
    const furniture = await catalog('furniture-assembly');
    const owner = await registerHelpSeeker();
    const created = await owner.agent.post('/tasks').send(validTask([furniture.id]));
    const other = await registerHelpSeeker();
    const response = await other.agent.get(`/tasks/${created.body.task.id}/recommendations`);
    expect(response.status).toBe(403);
    expect(response.body.code).toBe(ErrorCode.FORBIDDEN);
  });

  it('excludes a Student who lacks a required skill', async () => {
    const furniture = await catalog('furniture-assembly');
    const painting = await catalog('painting');
    const { agent } = await registerHelpSeeker();
    const created = await agent.post('/tasks').send(validTask([furniture.id]));
    const student = await createVerifiedStudent(`${uniqueLocal('paint')}@tum.de`);
    await addSkill(student.profileId, painting.id, ExperienceLevel.EXPERT);
    await addWednesdayAvailability(student.profileId);

    const response = await agent.get(`/tasks/${created.body.task.id}/recommendations`);
    expect(response.status).toBe(200);
    expect(response.body.recommendations).toEqual([]);
  });

  it('excludes an unverified Student', async () => {
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

    const response = await agent.get(`/tasks/${created.body.task.id}/recommendations`);
    expect(response.body.recommendations).toEqual([]);
  });

  it('ranks a full skill match above a partial match', async () => {
    const furniture = await catalog('furniture-assembly');
    const driving = await catalog('driving');
    const { agent } = await registerHelpSeeker();
    const created = await agent.post('/tasks').send(validTask([furniture.id, driving.id]));

    const full = await createVerifiedStudent(`${uniqueLocal('full')}@tum.de`);
    await addSkill(full.profileId, furniture.id, ExperienceLevel.ADVANCED);
    await addSkill(full.profileId, driving.id, ExperienceLevel.ADVANCED);
    await addWednesdayAvailability(full.profileId);

    const partial = await createVerifiedStudent(`${uniqueLocal('part')}@tum.de`);
    await addSkill(partial.profileId, furniture.id, ExperienceLevel.ADVANCED);
    await addWednesdayAvailability(partial.profileId);

    const response = await agent.get(`/tasks/${created.body.task.id}/recommendations`);
    expect(response.status).toBe(200);
    expect(response.body.recommendations.map((row: { student: { id: string } }) => row.student.id)).toEqual([
      full.profileId,
      partial.profileId,
    ]);
    expect(response.body.recommendations[0].matchFactors.skill.matched).toBe(true);
    expect(response.body.recommendations[1].matchFactors.skill.matched).toBe(false);
    expect(response.body.recommendations[1].matchFactors.skill.matchedCount).toBe(1);
    expect(response.body.recommendations[1].matchFactors.skill.requiredCount).toBe(2);
    expect(response.body.recommendations[0].reasons).toEqual(
      expect.arrayContaining([{ type: 'SKILL', label: 'Matches all required skills' }]),
    );
    expect(response.body.recommendations[1].reasons).toEqual(
      expect.arrayContaining([{ type: 'SKILL', label: 'Matches 1 of 2 required skills' }]),
    );
  });

  it('ranks higher relevant experience above lower experience', async () => {
    const furniture = await catalog('furniture-assembly');
    const { agent } = await registerHelpSeeker();
    const created = await agent.post('/tasks').send(validTask([furniture.id]));

    const expert = await createVerifiedStudent(`${uniqueLocal('exp')}@tum.de`);
    await addSkill(expert.profileId, furniture.id, ExperienceLevel.EXPERT);
    await addWednesdayAvailability(expert.profileId);

    const beginner = await createVerifiedStudent(`${uniqueLocal('beg')}@tum.de`);
    await addSkill(beginner.profileId, furniture.id, ExperienceLevel.BEGINNER);
    await addWednesdayAvailability(beginner.profileId);

    const response = await agent.get(`/tasks/${created.body.task.id}/recommendations`);
    expect(response.body.recommendations.map((row: { student: { id: string } }) => row.student.id)).toEqual([
      expert.profileId,
      beginner.profileId,
    ]);
  });

  it('does not let an unmatched EXPERT skill raise rank', async () => {
    const furniture = await catalog('furniture-assembly');
    const design = await catalog('graphic-design');
    const { agent } = await registerHelpSeeker();
    const created = await agent.post('/tasks').send(validTask([furniture.id]));

    const designer = await createVerifiedStudent(`${uniqueLocal('des')}@tum.de`);
    await addSkill(designer.profileId, furniture.id, ExperienceLevel.BEGINNER);
    await addSkill(designer.profileId, design.id, ExperienceLevel.EXPERT);
    await addWednesdayAvailability(designer.profileId);

    const assembler = await createVerifiedStudent(`${uniqueLocal('asm')}@tum.de`);
    await addSkill(assembler.profileId, furniture.id, ExperienceLevel.ADVANCED);
    await addWednesdayAvailability(assembler.profileId);

    const response = await agent.get(`/tasks/${created.body.task.id}/recommendations`);
    expect(response.body.recommendations[0].student.id).toBe(assembler.profileId);
    expect(response.body.recommendations[0].matchedSkills).toHaveLength(1);
  });

  it('excludes a Student who is not available at the task time', async () => {
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

    const response = await agent.get(`/tasks/${created.body.task.id}/recommendations`);
    expect(response.body.recommendations).toEqual([]);
  });

  it('excludes a Student blocked by an unavailable period', async () => {
    const furniture = await catalog('furniture-assembly');
    const { agent } = await registerHelpSeeker();
    const created = await agent.post('/tasks').send(validTask([furniture.id]));
    const student = await createVerifiedStudent(`${uniqueLocal('vac')}@tum.de`);
    await addSkill(student.profileId, furniture.id, ExperienceLevel.EXPERT);
    await addWednesdayAvailability(student.profileId);
    await prisma.unavailablePeriod.create({
      data: {
        studentProfileId: student.profileId,
        startDateTime: zonedLocalToUtc('Europe/Stockholm', 2028, 9, 20),
        endDateTime: zonedLocalToUtc('Europe/Stockholm', 2028, 9, 21),
        reason: 'Vacation',
      },
    });

    const response = await agent.get(`/tasks/${created.body.task.id}/recommendations`);
    expect(response.body.recommendations).toEqual([]);
  });

  it('ranks a Student in the same university city above a Student in another city', async () => {
    const furniture = await catalog('furniture-assembly');
    const { agent } = await registerHelpSeeker();
    const created = await agent.post('/tasks').send(validTask([furniture.id], 'Marienplatz 1, 80331 Munich'));

    const local = await createVerifiedStudent(`${uniqueLocal('muc')}@tum.de`);
    await addSkill(local.profileId, furniture.id, ExperienceLevel.ADVANCED);
    await addWednesdayAvailability(local.profileId);

    const remote = await createVerifiedStudent(`${uniqueLocal('hn')}@hs-heilbronn.de`);
    await addSkill(remote.profileId, furniture.id, ExperienceLevel.ADVANCED);
    await addWednesdayAvailability(remote.profileId);

    const response = await agent.get(`/tasks/${created.body.task.id}/recommendations`);
    expect(response.body.recommendations.map((row: { student: { id: string } }) => row.student.id)).toEqual([
      local.profileId,
      remote.profileId,
    ]);
    expect(response.body.recommendations[0].proximity.relation).toBe('SAME_CITY');
    expect(response.body.recommendations[1].proximity.relation).toBe('DIFFERENT_CITY');
    expect(response.body.recommendations[0].reasons).toEqual(
      expect.arrayContaining([{ type: 'PROXIMITY', label: 'Located in the same area' }]),
    );
    expect(
      response.body.recommendations[1].reasons.some((reason: { type: string }) => reason.type === 'PROXIMITY'),
    ).toBe(false);
    expect(response.body.recommendations[0].proximity.distanceKm).toBeNull();
    expect(JSON.stringify(response.body.recommendations[0])).not.toMatch(/@tum\.de/);
  });

  it('returns an empty list when no Students are eligible', async () => {
    const furniture = await catalog('furniture-assembly');
    const { agent } = await registerHelpSeeker();
    const created = await agent.post('/tasks').send(validTask([furniture.id]));
    const response = await agent.get(`/tasks/${created.body.task.id}/recommendations`);
    expect(response.status).toBe(200);
    expect(response.body.recommendations).toEqual([]);
  });

  it('returns TASK_NOT_FOUND for an unknown task id', async () => {
    const { agent } = await registerHelpSeeker();
    const response = await agent.get('/tasks/does-not-exist/recommendations');
    expect(response.status).toBe(404);
    expect(response.body.code).toBe(ErrorCode.TASK_NOT_FOUND);
  });

  it('rejects recommendations for an unpublished task', async () => {
    const furniture = await catalog('furniture-assembly');
    const { agent } = await registerHelpSeeker();
    const created = await agent.post('/tasks').send(validTask([furniture.id]));
    await prisma.task.update({
      where: { id: created.body.task.id },
      data: { status: TaskStatus.DRAFT },
    });
    const response = await agent.get(`/tasks/${created.body.task.id}/recommendations`);
    expect(response.status).toBe(400);
    expect(response.body.code).toBe(ErrorCode.TASK_NOT_PUBLISHED);
  });

  it('loads candidates without a per-student skill query', async () => {
    const furniture = await catalog('furniture-assembly');
    const { agent } = await registerHelpSeeker();
    const created = await agent.post('/tasks').send(validTask([furniture.id]));
    const first = await createVerifiedStudent(`${uniqueLocal('one')}@tum.de`);
    const second = await createVerifiedStudent(`${uniqueLocal('two')}@tum.de`);
    await addSkill(first.profileId, furniture.id, ExperienceLevel.ADVANCED);
    await addSkill(second.profileId, furniture.id, ExperienceLevel.ADVANCED);
    await addWednesdayAvailability(first.profileId);
    await addWednesdayAvailability(second.profileId);

    let studentProfileReads = 0;
    let studentSkillReads = 0;
    const countingPrisma = prisma.$extends({
      query: {
        studentProfile: {
          async findMany({ args, query }) {
            studentProfileReads += 1;
            return query(args);
          },
        },
        studentSkill: {
          async findMany({ args, query }) {
            studentSkillReads += 1;
            return query(args);
          },
        },
      },
    });
    const countingApp = createApp({
      env: loadEnv(),
      prisma: countingPrisma as unknown as PrismaClient,
    });
    const loginAgent = request.agent(countingApp);
    const owner = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.HELP_SEEKER },
      select: { email: true },
    });
    await loginAgent.post('/auth/login').send({ email: owner.email, password }).expect(200);
    const response = await loginAgent.get(`/tasks/${created.body.task.id}/recommendations`);
    expect(response.status).toBe(200);
    expect(response.body.recommendations).toHaveLength(2);
    expect(studentProfileReads).toBe(1);
    expect(studentSkillReads).toBeLessThanOrEqual(1);
  });
});
