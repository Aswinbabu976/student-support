import { ExperienceLevel, VerificationStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { explainRecommendation } from './matching.mapper.js';
import { MATCHING_WEIGHTS } from './matching.config.js';
import type { ScoredCandidate } from './matching.types.js';

const requestedStart = new Date('2028-09-20T08:00:00.000Z');
const requestedEnd = new Date('2028-09-20T11:00:00.000Z');

function scored(overrides: Partial<ScoredCandidate> = {}): ScoredCandidate {
  return {
    studentId: 'student_1',
    verificationStatus: VerificationStatus.VERIFIED,
    matchedSkills: [
      { skillId: 'skill_furniture', name: 'Furniture Assembly', experienceLevel: ExperienceLevel.ADVANCED },
    ],
    totalScore: 80,
    factors: {
      skillScore: 35,
      experienceScore: 15,
      availabilityScore: 15,
      proximityScore: 20,
      ratingScore: 0,
      completedJobsScore: 0,
    },
    matchFactors: {
      skillCoverage: 1,
      skillMatched: true,
      availabilityMatched: true,
      experienceLevel: ExperienceLevel.ADVANCED,
      proximity: 'SAME_CITY',
      distanceKm: null,
      rating: null,
      completedJobsCount: 0,
    },
    ...overrides,
  };
}

describe('match explanations', () => {
  it('explains a full single-skill match', () => {
    const { matchFactors, reasons } = explainRecommendation(scored(), {
      requiredSkillCount: 1,
      requestedStart,
      requestedEnd,
    });
    expect(matchFactors.skill.matched).toBe(true);
    expect(reasons).toEqual(
      expect.arrayContaining([
        { type: 'SKILL', label: 'Matches your Furniture Assembly requirement' },
        { type: 'AVAILABILITY', label: 'Available at your requested time' },
        { type: 'PROXIMITY', label: 'Located in the same area' },
        { type: 'EXPERIENCE', label: 'Advanced experience in Furniture Assembly' },
      ]),
    );
  });

  it('explains a full multi-skill match without implying a single skill', () => {
    const { reasons } = explainRecommendation(
      scored({
        matchedSkills: [
          { skillId: 'a', name: 'Furniture Assembly', experienceLevel: ExperienceLevel.ADVANCED },
          { skillId: 'b', name: 'Driving', experienceLevel: ExperienceLevel.INTERMEDIATE },
        ],
      }),
      { requiredSkillCount: 2, requestedStart, requestedEnd },
    );
    expect(reasons.find((reason) => reason.type === 'SKILL')?.label).toBe('Matches all required skills');
  });

  it('represents a partial skill match accurately', () => {
    const { matchFactors, reasons } = explainRecommendation(scored(), {
      requiredSkillCount: 2,
      requestedStart,
      requestedEnd,
    });
    expect(matchFactors.skill.matched).toBe(false);
    expect(matchFactors.skill.matchedCount).toBe(1);
    expect(matchFactors.skill.requiredCount).toBe(2);
    expect(reasons.find((reason) => reason.type === 'SKILL')?.label).toBe(
      'Matches 1 of 2 required skills',
    );
  });

  it('includes availability only when the Student is available', () => {
    const available = explainRecommendation(scored(), {
      requiredSkillCount: 1,
      requestedStart,
      requestedEnd,
    });
    expect(available.matchFactors.availability.matched).toBe(true);
    expect(available.reasons.some((reason) => reason.type === 'AVAILABILITY')).toBe(true);

    const blocked = explainRecommendation(
      scored({
        matchFactors: {
          ...scored().matchFactors,
          availabilityMatched: false,
        },
      }),
      { requiredSkillCount: 1, requestedStart, requestedEnd },
    );
    expect(blocked.matchFactors.availability.matched).toBe(false);
    expect(blocked.reasons.some((reason) => reason.type === 'AVAILABILITY')).toBe(false);
    expect(blocked.reasons.some((reason) => /available/i.test(reason.label))).toBe(false);
  });

  it('uses exact distance when provided and omits proximity when unknown', () => {
    const withDistance = explainRecommendation(
      scored({
        matchFactors: { ...scored().matchFactors, proximity: 'UNKNOWN', distanceKm: 2.5 },
      }),
      { requiredSkillCount: 1, requestedStart, requestedEnd },
    );
    expect(withDistance.reasons.find((reason) => reason.type === 'PROXIMITY')?.label).toBe('2.5 km away');

    const unknown = explainRecommendation(
      scored({
        matchFactors: { ...scored().matchFactors, proximity: 'UNKNOWN', distanceKm: null },
      }),
      { requiredSkillCount: 1, requestedStart, requestedEnd },
    );
    expect(unknown.reasons.some((reason) => reason.type === 'PROXIMITY')).toBe(false);

    const differentCity = explainRecommendation(
      scored({
        matchFactors: { ...scored().matchFactors, proximity: 'DIFFERENT_CITY', distanceKm: null },
      }),
      { requiredSkillCount: 1, requestedStart, requestedEnd },
    );
    expect(differentCity.reasons.some((reason) => reason.type === 'PROXIMITY')).toBe(false);
  });

  it('includes rating and completed jobs only when real values exist', () => {
    const empty = explainRecommendation(scored(), {
      requiredSkillCount: 1,
      requestedStart,
      requestedEnd,
    });
    expect(empty.reasons.some((reason) => reason.type === 'RATING' || reason.type === 'COMPLETED_JOBS')).toBe(
      false,
    );

    const withReputation = explainRecommendation(
      scored({
        matchFactors: {
          ...scored().matchFactors,
          rating: 4.8,
          completedJobsCount: 24,
        },
      }),
      { requiredSkillCount: 1, requestedStart, requestedEnd },
    );
    expect(withReputation.reasons).toEqual(
      expect.arrayContaining([
        { type: 'RATING', label: '4.8 average rating' },
        { type: 'COMPLETED_JOBS', label: '24 completed jobs' },
      ]),
    );
  });

  it('does not leak ranking weights or a private address', () => {
    const { matchFactors, reasons } = explainRecommendation(scored(), {
      requiredSkillCount: 1,
      requestedStart,
      requestedEnd,
    });
    const serialized = JSON.stringify({ matchFactors, reasons });
    expect(matchFactors).not.toHaveProperty('skillScore');
    expect(matchFactors).not.toHaveProperty('factors');
    expect(serialized).not.toContain(`"skill":${MATCHING_WEIGHTS.skill}`);
    expect(serialized).not.toMatch(/weight/i);
    expect(serialized).not.toMatch(/addressLine/);
    expect(serialized).not.toMatch(/Marienplatz/);
  });
});
