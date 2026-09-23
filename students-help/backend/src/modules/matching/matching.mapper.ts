import type { ExperienceLevel } from '@prisma/client';
import type {
  ExplanationMatchFactors,
  MatchReason,
  RecommendationView,
  ScoredCandidate,
} from './matching.types.js';

const EXPERIENCE_LABEL: Record<ExperienceLevel, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
  EXPERT: 'Expert',
};

export type ExplanationContext = {
  requiredSkillCount: number;
  requestedStart: Date;
  requestedEnd: Date;
};

export function explainRecommendation(
  scored: ScoredCandidate,
  context: ExplanationContext,
): Pick<RecommendationView, 'matchFactors' | 'reasons'> {
  const requiredCount = Math.max(context.requiredSkillCount, 0);
  const matchedSkills = scored.matchedSkills;
  const primarySkill = matchedSkills[0] ?? null;
  const matchFactors: ExplanationMatchFactors = {
    skill: {
      matched: requiredCount > 0 && matchedSkills.length >= requiredCount,
      matchedCount: matchedSkills.length,
      requiredCount,
      matchedSkills,
    },
    availability: {
      matched: scored.matchFactors.availabilityMatched,
      requestedStart: context.requestedStart.toISOString(),
      requestedEnd: context.requestedEnd.toISOString(),
    },
    proximity: {
      relation: scored.matchFactors.proximity,
      distanceKm: scored.matchFactors.distanceKm,
    },
    experience: {
      level: scored.matchFactors.experienceLevel,
      skillName: primarySkill?.name ?? null,
    },
    rating: {
      average: scored.matchFactors.rating,
      count: null,
    },
    completedJobs: scored.matchFactors.completedJobsCount,
  };

  return {
    matchFactors,
    reasons: buildReasons(matchFactors),
  };
}

export function toRecommendationView(
  scored: ScoredCandidate,
  context: ExplanationContext,
): RecommendationView {
  const explained = explainRecommendation(scored, context);
  return {
    student: {
      id: scored.studentId,
      verificationStatus: scored.verificationStatus,
    },
    matchedSkills: scored.matchedSkills,
    availability: { isAvailable: explained.matchFactors.availability.matched },
    proximity: explained.matchFactors.proximity,
    rating: explained.matchFactors.rating.average,
    completedJobsCount: explained.matchFactors.completedJobs,
    score: scored.totalScore,
    matchFactors: explained.matchFactors,
    reasons: explained.reasons,
  };
}

function buildReasons(factors: ExplanationMatchFactors): MatchReason[] {
  const reasons: MatchReason[] = [];
  const skillLabel = skillReasonLabel(factors.skill);
  if (skillLabel) {
    reasons.push({ type: 'SKILL', label: skillLabel });
  }
  if (factors.availability.matched) {
    reasons.push({ type: 'AVAILABILITY', label: 'Available at your requested time' });
  }
  const proximityLabel = proximityReasonLabel(factors.proximity);
  if (proximityLabel) {
    reasons.push({ type: 'PROXIMITY', label: proximityLabel });
  }
  if (factors.experience.level && factors.experience.skillName) {
    reasons.push({
      type: 'EXPERIENCE',
      label: `${EXPERIENCE_LABEL[factors.experience.level]} experience in ${factors.experience.skillName}`,
    });
  }
  if (factors.rating.average !== null) {
    reasons.push({
      type: 'RATING',
      label: `${formatRating(factors.rating.average)} average rating`,
    });
  }
  if (factors.completedJobs > 0) {
    const jobs = factors.completedJobs;
    reasons.push({
      type: 'COMPLETED_JOBS',
      label: jobs === 1 ? '1 completed job' : `${jobs} completed jobs`,
    });
  }
  return reasons;
}

function skillReasonLabel(skill: ExplanationMatchFactors['skill']): string | null {
  if (skill.matchedCount === 0 || skill.requiredCount === 0) {
    return null;
  }
  if (skill.matched) {
    if (skill.requiredCount === 1) {
      const name = skill.matchedSkills[0]?.name;
      return name ? `Matches your ${name} requirement` : 'Matches all required skills';
    }
    return 'Matches all required skills';
  }
  return `Matches ${skill.matchedCount} of ${skill.requiredCount} required skills`;
}

function proximityReasonLabel(proximity: ExplanationMatchFactors['proximity']): string | null {
  if (proximity.distanceKm !== null && Number.isFinite(proximity.distanceKm)) {
    return `${formatDistance(proximity.distanceKm)} km away`;
  }
  if (proximity.relation === 'SAME_CITY') {
    return 'Located in the same area';
  }
  return null;
}

function formatDistance(km: number): string {
  return Number.isInteger(km) ? String(km) : km.toFixed(1);
}

function formatRating(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
