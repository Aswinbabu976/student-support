import { describe, expect, it } from 'vitest';
import { compactMatchReasons, hasExpandableMatchDetails, reasonsByType } from './reasons';
import type { Recommendation } from './types';

const baseRecommendation: Recommendation = {
  student: { id: 'student_1', verificationStatus: 'VERIFIED' },
  matchedSkills: [
    { skillId: 'skill_furniture', name: 'Furniture Assembly', experienceLevel: 'ADVANCED' },
  ],
  availability: { isAvailable: true },
  proximity: { relation: 'SAME_CITY', distanceKm: null },
  rating: null,
  completedJobsCount: 0,
  score: 82.5,
  matchFactors: {
    skill: {
      matched: true,
      matchedCount: 1,
      requiredCount: 1,
      matchedSkills: [
        { skillId: 'skill_furniture', name: 'Furniture Assembly', experienceLevel: 'ADVANCED' },
      ],
    },
    availability: {
      matched: true,
      requestedStart: '2028-09-20T08:00:00.000Z',
      requestedEnd: '2028-09-20T11:00:00.000Z',
    },
    proximity: { relation: 'SAME_CITY', distanceKm: null },
    experience: { level: 'ADVANCED', skillName: 'Furniture Assembly' },
    rating: { average: null, count: null },
    completedJobs: 0,
  },
  reasons: [
    { type: 'SKILL', label: 'Matches your Furniture Assembly requirement' },
    { type: 'AVAILABILITY', label: 'Available at your requested time' },
    { type: 'PROXIMITY', label: 'Located in the same area' },
    { type: 'EXPERIENCE', label: 'Advanced experience in Furniture Assembly' },
  ],
};

describe('match reason display helpers', () => {
  it('keeps compact badges to skill, availability, and proximity', () => {
    expect(compactMatchReasons(baseRecommendation.reasons).map((reason) => reason.type)).toEqual([
      'SKILL',
      'AVAILABILITY',
      'PROXIMITY',
    ]);
  });

  it('omits missing reasons instead of inventing them', () => {
    expect(compactMatchReasons(undefined)).toEqual([]);
    expect(compactMatchReasons([{ type: 'SKILL', label: 'Matches 1 of 2 required skills' }])).toEqual([
      { type: 'SKILL', label: 'Matches 1 of 2 required skills' },
    ]);
  });

  it('indexes reasons by type without recomputing ranking', () => {
    const byType = reasonsByType(baseRecommendation.reasons);
    expect(byType.SKILL?.label).toBe('Matches your Furniture Assembly requirement');
    expect(byType.RATING).toBeUndefined();
  });

  it('hides the expanded region when there is nothing to explain', () => {
    expect(hasExpandableMatchDetails(baseRecommendation)).toBe(true);
    expect(hasExpandableMatchDetails({ ...baseRecommendation, reasons: [] })).toBe(false);
  });
});
