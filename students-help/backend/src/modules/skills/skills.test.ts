import { ExperienceLevel, UserRole } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { loadEnv } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import { ErrorCode } from '../../shared/errors.js';
import { isUniqueConstraintError } from '../../shared/prisma-errors.js';
import { ensureSkillCatalog } from './skill-catalog.js';

const app = createApp({ env: loadEnv() });

const studentPassword = 'securePass12';
const helpSeekerRegistration = {
  fullName: 'Alex Example',
  email: 'seeker.skills@example.com',
  phone: '+46701234567',
  address: 'Example Street 10, 111 22 Stockholm',
  preferredPaymentMethod: 'CARD',
  password: studentPassword,
};

async function registerAndLoginStudent(email: string) {
  await request(app).post('/auth/register/student').send({ email, password: studentPassword }).expect(201);
  const agent = request.agent(app);
  await agent.post('/auth/login').send({ email, password: studentPassword }).expect(200);
  return agent;
}

async function catalogSkill(name: string) {
  return prisma.skill.findUniqueOrThrow({
    where: { slug: name },
    select: { id: true, name: true, slug: true },
  });
}

describe('Student skills', () => {
  beforeAll(async () => {
    await ensureSkillCatalog(prisma);
  });

  beforeEach(async () => {
    await prisma.studentSkill.deleteMany();
    await prisma.unavailablePeriod.deleteMany();
    await prisma.recurringAvailability.deleteMany();
    await prisma.studentProfile.deleteMany();
    await prisma.session.deleteMany();
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

  it('creates a StudentProfile when a student registers', async () => {
    await request(app)
      .post('/auth/register/student')
      .send({ email: 'profile@tum.de', password: studentPassword })
      .expect(201);

    const stored = await prisma.user.findUniqueOrThrow({
      where: { email: 'profile@tum.de' },
      include: { studentProfile: true },
    });
    expect(stored.studentProfile).not.toBeNull();
  });

  it('lets an authenticated student add, persist, list, update, and remove a skill', async () => {
    const furniture = await catalogSkill('furniture-assembly');
    const agent = await registerAndLoginStudent('skills@tum.de');

    const created = await agent.post('/students/me/skills').send({
      skillId: furniture.id,
      experienceLevel: ExperienceLevel.ADVANCED,
      description: '  Comfortable assembling wardrobes, desks, shelving and flat-pack furniture.  ',
      certificationReference: '  IKEA Family assembly workshop 2024  ',
    });

    expect(created.status).toBe(201);
    expect(created.body.skill).toMatchObject({
      skill: { id: furniture.id, name: 'Furniture Assembly' },
      experienceLevel: ExperienceLevel.ADVANCED,
      description: 'Comfortable assembling wardrobes, desks, shelving and flat-pack furniture.',
      certificationReference: 'IKEA Family assembly workshop 2024',
    });

    const stored = await prisma.studentSkill.findUniqueOrThrow({
      where: { id: created.body.skill.id },
    });
    expect(stored.experienceLevel).toBe(ExperienceLevel.ADVANCED);
    expect(stored.description).toBe(
      'Comfortable assembling wardrobes, desks, shelving and flat-pack furniture.',
    );
    expect(stored.certificationReference).toBe('IKEA Family assembly workshop 2024');

    const listed = await agent.get('/students/me/skills');
    expect(listed.status).toBe(200);
    expect(listed.body.skills).toHaveLength(1);
    expect(listed.body.skills[0].id).toBe(created.body.skill.id);

    const updated = await agent.patch(`/students/me/skills/${created.body.skill.id}`).send({
      experienceLevel: ExperienceLevel.EXPERT,
      description: 'Now including kitchen units and outdoor furniture.',
    });
    expect(updated.status).toBe(200);
    expect(updated.body.skill.experienceLevel).toBe(ExperienceLevel.EXPERT);
    expect(updated.body.skill.description).toBe('Now including kitchen units and outdoor furniture.');
    expect(updated.body.skill.certificationReference).toBe('IKEA Family assembly workshop 2024');

    const cleared = await agent.patch(`/students/me/skills/${created.body.skill.id}`).send({
      certificationReference: '   ',
    });
    expect(cleared.status).toBe(200);
    expect(cleared.body.skill.certificationReference).toBeNull();

    const removed = await agent.delete(`/students/me/skills/${created.body.skill.id}`);
    expect(removed.status).toBe(204);
    expect(await prisma.studentSkill.findUnique({ where: { id: created.body.skill.id } })).toBeNull();

    const empty = await agent.get('/students/me/skills');
    expect(empty.body.skills).toEqual([]);
  });

  it('rejects a duplicate skill for the same student', async () => {
    const driving = await catalogSkill('driving');
    const agent = await registerAndLoginStudent('dup@tum.de');

    await agent
      .post('/students/me/skills')
      .send({ skillId: driving.id, experienceLevel: ExperienceLevel.BEGINNER })
      .expect(201);

    const duplicate = await agent.post('/students/me/skills').send({
      skillId: driving.id,
      experienceLevel: ExperienceLevel.INTERMEDIATE,
    });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe(ErrorCode.STUDENT_SKILL_ALREADY_EXISTS);
    expect(duplicate.body.message).toBe("You've already added this skill.");
    expect(JSON.stringify(duplicate.body)).not.toMatch(/Unique constraint/i);
  });

  it('rejects an invalid experience level and an unknown skill', async () => {
    const painting = await catalogSkill('painting');
    const agent = await registerAndLoginStudent('invalid@tum.de');

    const badLevel = await agent.post('/students/me/skills').send({
      skillId: painting.id,
      experienceLevel: 'GURU',
    });
    expect(badLevel.status).toBe(400);
    expect(badLevel.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(badLevel.body.details[0].field).toBe('experienceLevel');

    const unknown = await agent.post('/students/me/skills').send({
      skillId: 'skill_does_not_exist',
      experienceLevel: ExperienceLevel.BEGINNER,
    });
    expect(unknown.status).toBe(404);
    expect(unknown.body.code).toBe(ErrorCode.SKILL_NOT_FOUND);
  });

  it('rejects an inactive catalog skill', async () => {
    const photography = await catalogSkill('photography');
    await prisma.skill.update({
      where: { id: photography.id },
      data: { isActive: false },
    });
    const agent = await registerAndLoginStudent('inactive@tum.de');

    const response = await agent.post('/students/me/skills').send({
      skillId: photography.id,
      experienceLevel: ExperienceLevel.INTERMEDIATE,
    });
    expect(response.status).toBe(404);
    expect(response.body.code).toBe(ErrorCode.SKILL_NOT_FOUND);
  });

  it('rejects unauthenticated access and Help Seeker write attempts', async () => {
    const cleaning = await catalogSkill('cleaning');

    const anonymous = await request(app).post('/students/me/skills').send({
      skillId: cleaning.id,
      experienceLevel: ExperienceLevel.BEGINNER,
    });
    expect(anonymous.status).toBe(401);
    expect(anonymous.body.code).toBe(ErrorCode.UNAUTHORIZED);

    const seeker = request.agent(app);
    await seeker.post('/auth/register/help-seeker').send(helpSeekerRegistration).expect(201);

    const forbidden = await seeker.post('/students/me/skills').send({
      skillId: cleaning.id,
      experienceLevel: ExperienceLevel.BEGINNER,
    });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.code).toBe(ErrorCode.FORBIDDEN);
  });

  it("does not let a student modify another student's skill", async () => {
    const gardening = await catalogSkill('gardening');
    const owner = await registerAndLoginStudent('owner@tum.de');
    const created = await owner
      .post('/students/me/skills')
      .send({ skillId: gardening.id, experienceLevel: ExperienceLevel.INTERMEDIATE })
      .expect(201);

    const other = await registerAndLoginStudent('other@hs-heilbronn.de');
    const patched = await other.patch(`/students/me/skills/${created.body.skill.id}`).send({
      experienceLevel: ExperienceLevel.EXPERT,
    });
    expect(patched.status).toBe(403);
    expect(patched.body.code).toBe(ErrorCode.FORBIDDEN);

    const deleted = await other.delete(`/students/me/skills/${created.body.skill.id}`);
    expect(deleted.status).toBe(403);

    const stillThere = await prisma.studentSkill.findUnique({
      where: { id: created.body.skill.id },
    });
    expect(stillThere?.experienceLevel).toBe(ExperienceLevel.INTERMEDIATE);
  });

  it('does not delete a catalog skill when a student skill is removed', async () => {
    const programming = await catalogSkill('programming');
    const agent = await registerAndLoginStudent('keep-catalog@tum.de');
    const created = await agent
      .post('/students/me/skills')
      .send({ skillId: programming.id, experienceLevel: ExperienceLevel.ADVANCED })
      .expect(201);

    await agent.delete(`/students/me/skills/${created.body.skill.id}`).expect(204);

    const catalog = await prisma.skill.findUnique({ where: { id: programming.id } });
    expect(catalog).not.toBeNull();
    expect(catalog?.name).toBe('Programming');
  });

  it('enforces uniqueness at the database for a student and skill pair', async () => {
    const childcare = await catalogSkill('childcare');
    await request(app)
      .post('/auth/register/student')
      .send({ email: 'race@tum.de', password: studentPassword })
      .expect(201);
    const profile = await prisma.studentProfile.findFirstOrThrow({
      where: { user: { email: 'race@tum.de' } },
    });

    await prisma.studentSkill.create({
      data: {
        studentProfileId: profile.id,
        skillId: childcare.id,
        experienceLevel: ExperienceLevel.BEGINNER,
      },
    });

    try {
      await prisma.studentSkill.create({
        data: {
          studentProfileId: profile.id,
          skillId: childcare.id,
          experienceLevel: ExperienceLevel.EXPERT,
        },
      });
      expect.fail('expected unique constraint to reject the duplicate');
    } catch (error) {
      expect(isUniqueConstraintError(error)).toBe(true);
    }
  });

  it('lists the public skill catalog without authentication', async () => {
    const response = await request(app).get('/skills');
    expect(response.status).toBe(200);
    expect(response.body.skills.length).toBeGreaterThanOrEqual(10);
    expect(response.body.skills.map((skill: { name: string }) => skill.name)).toContain(
      'Furniture Assembly',
    );
  });

  it('ignores client-supplied identity fields when adding a skill', async () => {
    const itSupport = await catalogSkill('it-support');
    const agent = await registerAndLoginStudent('no-mass-assign@tum.de');

    const response = await agent.post('/students/me/skills').send({
      skillId: itSupport.id,
      experienceLevel: ExperienceLevel.BEGINNER,
      studentProfileId: 'someone-else',
      userId: 'someone-else',
      role: UserRole.ADMIN,
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(ErrorCode.VALIDATION_ERROR);
  });
});
