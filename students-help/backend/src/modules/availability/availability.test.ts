import { DayOfWeek, UserRole } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { loadEnv } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import { ErrorCode } from '../../shared/errors.js';
import { AvailabilityService } from './availability.service.js';
import { zonedLocalToUtc } from './availability.time.js';

const app = createApp({ env: loadEnv() });
const availabilityService = new AvailabilityService({ prisma });

const studentPassword = 'securePass12';
const helpSeekerRegistration = {
  fullName: 'Alex Example',
  email: 'seeker.availability@example.com',
  phone: '+46701234567',
  address: 'Example Street 10, 111 22 Stockholm',
  preferredPaymentMethod: 'CARD',
  password: studentPassword,
};

const validWeekly = {
  timezone: 'Europe/Stockholm',
  days: [
    {
      dayOfWeek: DayOfWeek.MONDAY,
      slots: [{ start: '16:00', end: '20:00' }],
    },
    {
      dayOfWeek: DayOfWeek.WEDNESDAY,
      slots: [{ start: '14:00', end: '18:00' }],
    },
    {
      dayOfWeek: DayOfWeek.SATURDAY,
      slots: [
        { start: '09:00', end: '12:00' },
        { start: '14:00', end: '18:00' },
      ],
    },
  ],
};

async function registerAndLoginStudent(email: string) {
  await request(app).post('/auth/register/student').send({ email, password: studentPassword }).expect(201);
  const agent = request.agent(app);
  await agent.post('/auth/login').send({ email, password: studentPassword }).expect(200);
  return agent;
}

describe('Student availability', () => {
  beforeEach(async () => {
    await prisma.unavailablePeriod.deleteMany();
    await prisma.recurringAvailability.deleteMany();
    await prisma.studentSkill.deleteMany();
    await prisma.studentProfile.deleteMany();
    await prisma.session.deleteMany();
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

  it('saves valid weekly availability including multiple slots on the same day', async () => {
    const agent = await registerAndLoginStudent('avail@tum.de');
    const response = await agent.put('/students/me/availability/weekly').send(validWeekly);

    expect(response.status).toBe(200);
    expect(response.body.timezone).toBe('Europe/Stockholm');
    expect(response.body.weekly).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dayOfWeek: DayOfWeek.MONDAY,
          startTime: '16:00',
          endTime: '20:00',
        }),
        expect.objectContaining({
          dayOfWeek: DayOfWeek.SATURDAY,
          startTime: '09:00',
          endTime: '12:00',
        }),
        expect.objectContaining({
          dayOfWeek: DayOfWeek.SATURDAY,
          startTime: '14:00',
          endTime: '18:00',
        }),
      ]),
    );

    const stored = await prisma.studentProfile.findFirstOrThrow({
      where: { user: { email: 'avail@tum.de' } },
      include: { recurringAvailability: true },
    });
    expect(stored.timezone).toBe('Europe/Stockholm');
    expect(stored.recurringAvailability).toHaveLength(4);
  });

  it('lets a student retrieve their own schedule after saving', async () => {
    const agent = await registerAndLoginStudent('read@tum.de');
    await agent.put('/students/me/availability/weekly').send(validWeekly).expect(200);

    const listed = await agent.get('/students/me/availability');
    expect(listed.status).toBe(200);
    expect(listed.body.timezone).toBe('Europe/Stockholm');
    expect(listed.body.weekly).toHaveLength(4);
  });

  it('rejects start times that are not before end times', async () => {
    const agent = await registerAndLoginStudent('range@tum.de');
    const response = await agent.put('/students/me/availability/weekly').send({
      timezone: 'Europe/Stockholm',
      days: [{ dayOfWeek: DayOfWeek.MONDAY, slots: [{ start: '16:00', end: '16:00' }] }],
    });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe(ErrorCode.INVALID_TIME_RANGE);
    expect(response.body.message).toBe('End time must be later than start time.');
  });

  it('rejects overlapping and duplicate slots on the same day', async () => {
    const agent = await registerAndLoginStudent('overlap@tum.de');
    const overlapping = await agent.put('/students/me/availability/weekly').send({
      timezone: 'Europe/Stockholm',
      days: [
        {
          dayOfWeek: DayOfWeek.MONDAY,
          slots: [
            { start: '10:00', end: '14:00' },
            { start: '13:00', end: '16:00' },
          ],
        },
      ],
    });
    expect(overlapping.status).toBe(400);
    expect(overlapping.body.code).toBe(ErrorCode.AVAILABILITY_SLOT_OVERLAP);
    expect(overlapping.body.message).toBe('This time overlaps with another availability slot.');

    const duplicate = await agent.put('/students/me/availability/weekly').send({
      timezone: 'Europe/Stockholm',
      days: [
        {
          dayOfWeek: DayOfWeek.MONDAY,
          slots: [
            { start: '10:00', end: '12:00' },
            { start: '10:00', end: '12:00' },
          ],
        },
      ],
    });
    expect(duplicate.status).toBe(400);
    expect(duplicate.body.code).toBe(ErrorCode.AVAILABILITY_SLOT_OVERLAP);
  });

  it('keeps the previous weekly schedule when a replacement payload is invalid', async () => {
    const agent = await registerAndLoginStudent('atomic@tum.de');
    await agent.put('/students/me/availability/weekly').send(validWeekly).expect(200);

    const failed = await agent.put('/students/me/availability/weekly').send({
      timezone: 'Europe/Berlin',
      days: [
        {
          dayOfWeek: DayOfWeek.TUESDAY,
          slots: [
            { start: '10:00', end: '14:00' },
            { start: '13:00', end: '16:00' },
          ],
        },
      ],
    });
    expect(failed.status).toBe(400);

    const stored = await prisma.studentProfile.findFirstOrThrow({
      where: { user: { email: 'atomic@tum.de' } },
      include: { recurringAvailability: true },
    });
    expect(stored.timezone).toBe('Europe/Stockholm');
    expect(stored.recurringAvailability).toHaveLength(4);
  });

  it('rejects unauthenticated access and Help Seeker writes', async () => {
    const anonymous = await request(app).put('/students/me/availability/weekly').send(validWeekly);
    expect(anonymous.status).toBe(401);
    expect(anonymous.body.code).toBe(ErrorCode.UNAUTHORIZED);

    const seeker = request.agent(app);
    await seeker.post('/auth/register/help-seeker').send(helpSeekerRegistration).expect(201);
    const forbidden = await seeker.put('/students/me/availability/weekly').send(validWeekly);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.code).toBe(ErrorCode.FORBIDDEN);
  });

  it("does not let a student change another student's unavailable period", async () => {
    const owner = await registerAndLoginStudent('owner.avail@tum.de');
    await owner.put('/students/me/availability/weekly').send(validWeekly).expect(200);
    const created = await owner
      .post('/students/me/availability/unavailable')
      .send({ startDate: '2026-09-20', endDate: '2026-09-27', reason: 'Vacation' })
      .expect(201);

    const other = await registerAndLoginStudent('other.avail@hs-heilbronn.de');
    await other.put('/students/me/availability/weekly').send({
      timezone: 'Europe/Berlin',
      days: [{ dayOfWeek: DayOfWeek.FRIDAY, slots: [{ start: '09:00', end: '12:00' }] }],
    });

    const patched = await other.patch(`/students/me/availability/unavailable/${created.body.period.id}`).send({
      reason: 'Hijacked',
    });
    expect(patched.status).toBe(403);
    expect(patched.body.code).toBe(ErrorCode.FORBIDDEN);

    const ownerSchedule = await owner.get('/students/me/availability');
    expect(ownerSchedule.body.timezone).toBe('Europe/Stockholm');
    expect(ownerSchedule.body.unavailable[0].reason).toBe('Vacation');
  });

  it('creates a vacation period and rejects invalid or overlapping ranges', async () => {
    const agent = await registerAndLoginStudent('vacation@tum.de');
    await agent.put('/students/me/availability/weekly').send(validWeekly).expect(200);

    const inverted = await agent.post('/students/me/availability/unavailable').send({
      startDate: '2026-09-27',
      endDate: '2026-09-20',
    });
    expect(inverted.status).toBe(400);
    expect(inverted.body.code).toBe(ErrorCode.INVALID_DATE_RANGE);
    expect(inverted.body.message).toBe('End date must be on or after the start date.');

    const created = await agent.post('/students/me/availability/unavailable').send({
      startDate: '2026-09-20',
      endDate: '2026-09-27',
      reason: '  Vacation  ',
    });
    expect(created.status).toBe(201);
    expect(created.body.period).toMatchObject({
      startDate: '2026-09-20',
      endDate: '2026-09-27',
      reason: 'Vacation',
    });
    expect(created.body.period.startDateTime).toBe('2026-09-19T22:00:00.000Z');

    const overlapping = await agent.post('/students/me/availability/unavailable').send({
      startDate: '2026-09-25',
      endDate: '2026-09-30',
      reason: 'Also away',
    });
    expect(overlapping.status).toBe(409);
    expect(overlapping.body.code).toBe(ErrorCode.UNAVAILABLE_PERIOD_OVERLAP);

    const weeklyAfterVacation = await prisma.recurringAvailability.count();
    expect(weeklyAfterVacation).toBe(4);
  });

  it('evaluates the matching availability primitive against weekly slots and vacation overrides', async () => {
    const agent = await registerAndLoginStudent('match@tum.de');
    await agent.put('/students/me/availability/weekly').send(validWeekly).expect(200);
    await agent
      .post('/students/me/availability/unavailable')
      .send({ startDate: '2026-09-20', endDate: '2026-09-27', reason: 'Vacation' })
      .expect(201);

    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'match@tum.de' } });
    const timezone = 'Europe/Stockholm';
    const mondayInside = {
      start: zonedLocalToUtc(timezone, 2026, 9, 14, 16, 30),
      end: zonedLocalToUtc(timezone, 2026, 9, 14, 18, 0),
    };
    const mondayOutside = {
      start: zonedLocalToUtc(timezone, 2026, 9, 14, 10, 0),
      end: zonedLocalToUtc(timezone, 2026, 9, 14, 11, 0),
    };
    const vacationMonday = {
      start: zonedLocalToUtc(timezone, 2026, 9, 21, 16, 30),
      end: zonedLocalToUtc(timezone, 2026, 9, 21, 18, 0),
    };

    expect(await availabilityService.isAvailable(user.id, mondayInside.start, mondayInside.end)).toBe(
      true,
    );
    expect(
      await availabilityService.isAvailable(user.id, mondayOutside.start, mondayOutside.end),
    ).toBe(false);
    expect(
      await availabilityService.isAvailable(user.id, vacationMonday.start, vacationMonday.end),
    ).toBe(false);
  });

  it('ignores client-supplied ownership fields on weekly save', async () => {
    const agent = await registerAndLoginStudent('mass@tum.de');
    const response = await agent.put('/students/me/availability/weekly').send({
      ...validWeekly,
      studentProfileId: 'someone-else',
      userId: 'someone-else',
      role: UserRole.ADMIN,
    });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe(ErrorCode.VALIDATION_ERROR);
  });
});
