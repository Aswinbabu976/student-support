import { ExperienceLevel, VerificationStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { calculateCompletedJobsScore, calculateRatingScore, rankCandidates, scoreCandidate } from './matching.score.js';
import type { CandidateSnapshot } from './matching.types.js';

function snapshot(overrides: Partial<CandidateSnapshot> & Pick<CandidateSnapshot, 'studentId'>): CandidateSnapshot {
  return {
    email: 'student@tum.de',
    verificationStatus: VerificationStatus.VERIFIED,
    matchedSkills: [
      { skillId: 'skill_furniture', name: 'Furniture Assembly', experienceLevel: ExperienceLevel.ADVANCED },
    ],
    rating: null,
    completedJobsCount: 0,
    ...overrides,
  };
}

describe('matching scores', () => {
  it('ranks a full skill match above a partial match', () => {
    const full = scoreCandidate(
      snapshot({
        studentId: 'full',
        matchedSkills: [
          { skillId: 'a', name: 'Furniture Assembly', experienceLevel: ExperienceLevel.ADVANCED },
          { skillId: 'b', name: 'Driving', experienceLevel: ExperienceLevel.ADVANCED },
        ],
      }),
      2,
      'Marienplatz 1, 80331 Munich',
    );
    const partial = scoreCandidate(
      snapshot({
        studentId: 'partial',
        matchedSkills: [
          { skillId: 'a', name: 'Furniture Assembly', experienceLevel: ExperienceLevel.ADVANCED },
        ],
      }),
      2,
      'Marienplatz 1, 80331 Munich',
    );
    expect(full.totalScore).toBeGreaterThan(partial.totalScore);
  });

  it('ranks higher relevant experience above lower experience', () => {
    const expert = scoreCandidate(
      snapshot({
        studentId: 'expert',
        matchedSkills: [
          { skillId: 'a', name: 'Furniture Assembly', experienceLevel: ExperienceLevel.EXPERT },
        ],
      }),
      1,
      'Marienplatz 1, 80331 Munich',
    );
    const beginner = scoreCandidate(
      snapshot({
        studentId: 'beginner',
        matchedSkills: [
          { skillId: 'a', name: 'Furniture Assembly', experienceLevel: ExperienceLevel.BEGINNER },
        ],
      }),
      1,
      'Marienplatz 1, 80331 Munich',
    );
    expect(expert.totalScore).toBeGreaterThan(beginner.totalScore);
  });

  it('ranks a closer university locality above a different city', () => {
    const munich = scoreCandidate(snapshot({ studentId: 'munich', email: 'a@tum.de' }), 1, 'Museum 2, Munich');
    const heilbronn = scoreCandidate(
      snapshot({ studentId: 'heilbronn', email: 'b@hs-heilbronn.de' }),
      1,
      'Museum 2, Munich',
    );
    expect(munich.totalScore).toBeGreaterThan(heilbronn.totalScore);
    expect(munich.matchFactors.proximity).toBe('SAME_CITY');
    expect(heilbronn.matchFactors.proximity).toBe('DIFFERENT_CITY');
  });

  it('ranks a higher rating above a lower rating when other factors are equal', () => {
    const high = scoreCandidate(snapshot({ studentId: 'high', rating: 5 }), 1, 'Museum 2, Munich');
    const low = scoreCandidate(snapshot({ studentId: 'low', rating: 1 }), 1, 'Museum 2, Munich');
    expect(high.totalScore).toBeGreaterThan(low.totalScore);
  });

  it('ranks more completed jobs above fewer when other factors are equal', () => {
    const busy = scoreCandidate(snapshot({ studentId: 'busy', completedJobsCount: 12 }), 1, 'Museum 2, Munich');
    const newcomer = scoreCandidate(snapshot({ studentId: 'new', completedJobsCount: 1 }), 1, 'Museum 2, Munich');
    expect(busy.totalScore).toBeGreaterThan(newcomer.totalScore);
  });

  it('treats missing rating and completed-job data as a zero contribution', () => {
    expect(calculateRatingScore(null)).toBe(0);
    expect(calculateCompletedJobsScore(0)).toBe(0);
    const scored = scoreCandidate(snapshot({ studentId: 'neutral' }), 1, 'Museum 2, Munich');
    expect(scored.factors.ratingScore).toBe(0);
    expect(scored.factors.completedJobsScore).toBe(0);
    expect(scored.matchFactors.rating).toBeNull();
    expect(scored.matchFactors.completedJobsCount).toBe(0);
  });

  it('orders equal scores by stable student id', () => {
    const left = scoreCandidate(snapshot({ studentId: 'student_b' }), 1, 'Museum 2, Munich');
    const right = scoreCandidate(snapshot({ studentId: 'student_a' }), 1, 'Museum 2, Munich');
    expect(left.totalScore).toBe(right.totalScore);
    expect(rankCandidates([left, right]).map((row) => row.studentId)).toEqual(['student_a', 'student_b']);
  });
});
