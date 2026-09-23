import type { ExperienceLevel } from '@prisma/client';
import {
  COMPLETED_JOBS_CAP,
  EXPERIENCE_TIER_VALUE,
  MATCHING_WEIGHTS,
  MAX_EXPERIENCE_TIER,
  MAX_RATING,
  MAX_RECOMMENDATIONS,
} from './matching.config.js';
import { calculateProximity } from './matching.proximity.js';
import type { CandidateSnapshot, FactorScores, MatchFactors, ScoredCandidate } from './matching.types.js';

export function calculateSkillScore(matchedCount: number, requiredCount: number): number {
  if (requiredCount <= 0) {
    return 0;
  }
  return matchedCount / requiredCount;
}

export function calculateExperienceScore(levels: ExperienceLevel[]): number {
  if (levels.length === 0) {
    return 0;
  }
  const total = levels.reduce((sum, level) => sum + EXPERIENCE_TIER_VALUE[level], 0);
  return total / levels.length / MAX_EXPERIENCE_TIER;
}

export function calculateRatingScore(rating: number | null): number {
  if (rating === null || Number.isNaN(rating) || rating < 0) {
    return 0;
  }
  return Math.min(rating, MAX_RATING) / MAX_RATING;
}

export function calculateCompletedJobsScore(count: number): number {
  if (!Number.isFinite(count) || count <= 0) {
    return 0;
  }
  return Math.min(count, COMPLETED_JOBS_CAP) / COMPLETED_JOBS_CAP;
}

export function primaryExperience(levels: ExperienceLevel[]): ExperienceLevel | null {
  if (levels.length === 0) {
    return null;
  }
  return [...levels].sort((left, right) => EXPERIENCE_TIER_VALUE[right] - EXPERIENCE_TIER_VALUE[left])[0] ?? null;
}

export function scoreCandidate(
  candidate: CandidateSnapshot,
  requiredSkillCount: number,
  locationLine: string,
): ScoredCandidate {
  const coverage = calculateSkillScore(candidate.matchedSkills.length, requiredSkillCount);
  const experience = calculateExperienceScore(candidate.matchedSkills.map((skill) => skill.experienceLevel));
  const proximity = calculateProximity(locationLine, candidate.email);
  const rating = calculateRatingScore(candidate.rating);
  const completedJobs = calculateCompletedJobsScore(candidate.completedJobsCount);

  const factors: FactorScores = {
    skillScore: roundScore(coverage * MATCHING_WEIGHTS.skill),
    experienceScore: roundScore(experience * MATCHING_WEIGHTS.experience),
    availabilityScore: MATCHING_WEIGHTS.availability,
    proximityScore: roundScore(proximity.score * MATCHING_WEIGHTS.proximity),
    ratingScore: roundScore(rating * MATCHING_WEIGHTS.rating),
    completedJobsScore: roundScore(completedJobs * MATCHING_WEIGHTS.completedJobs),
  };

  const matchFactors: MatchFactors = {
    skillCoverage: roundScore(coverage),
    skillMatched: coverage === 1,
    availabilityMatched: true,
    experienceLevel: primaryExperience(candidate.matchedSkills.map((skill) => skill.experienceLevel)),
    proximity: proximity.relation,
    distanceKm: null,
    rating: candidate.rating,
    completedJobsCount: candidate.completedJobsCount,
  };

  return {
    studentId: candidate.studentId,
    matchedSkills: [...candidate.matchedSkills].sort((left, right) => {
      const experienceDelta =
        EXPERIENCE_TIER_VALUE[right.experienceLevel] - EXPERIENCE_TIER_VALUE[left.experienceLevel];
      return experienceDelta !== 0 ? experienceDelta : left.name.localeCompare(right.name);
    }),
    verificationStatus: candidate.verificationStatus,
    totalScore: roundScore(
      factors.skillScore +
        factors.experienceScore +
        factors.availabilityScore +
        factors.proximityScore +
        factors.ratingScore +
        factors.completedJobsScore,
    ),
    factors,
    matchFactors,
  };
}

export function rankCandidates(candidates: ScoredCandidate[]): ScoredCandidate[] {
  return [...candidates].sort((left, right) => {
    if (right.totalScore !== left.totalScore) {
      return right.totalScore - left.totalScore;
    }
    if (right.matchFactors.skillCoverage !== left.matchFactors.skillCoverage) {
      return right.matchFactors.skillCoverage - left.matchFactors.skillCoverage;
    }
    const proximityDelta = proximityRank(right.matchFactors.proximity) - proximityRank(left.matchFactors.proximity);
    if (proximityDelta !== 0) {
      return proximityDelta;
    }
    const experienceDelta =
      EXPERIENCE_TIER_VALUE[right.matchFactors.experienceLevel ?? 'BEGINNER'] -
      EXPERIENCE_TIER_VALUE[left.matchFactors.experienceLevel ?? 'BEGINNER'];
    if (experienceDelta !== 0) {
      return experienceDelta;
    }
    const jobsDelta = right.matchFactors.completedJobsCount - left.matchFactors.completedJobsCount;
    if (jobsDelta !== 0) {
      return jobsDelta;
    }
    const ratingDelta = (right.matchFactors.rating ?? -1) - (left.matchFactors.rating ?? -1);
    if (ratingDelta !== 0) {
      return ratingDelta;
    }
    return left.studentId.localeCompare(right.studentId);
  }).slice(0, MAX_RECOMMENDATIONS);
}

function proximityRank(relation: MatchFactors['proximity']): number {
  if (relation === 'SAME_CITY') {
    return 2;
  }
  if (relation === 'UNKNOWN') {
    return 1;
  }
  return 0;
}

function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}
