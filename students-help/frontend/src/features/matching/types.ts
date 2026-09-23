import type { ExperienceLevel } from '../skills/types';

export type ProximityRelation = 'SAME_CITY' | 'DIFFERENT_CITY' | 'UNKNOWN';

export type MatchReasonType =
  | 'SKILL'
  | 'AVAILABILITY'
  | 'PROXIMITY'
  | 'EXPERIENCE'
  | 'RATING'
  | 'COMPLETED_JOBS';

export type MatchReason = {
  type: MatchReasonType;
  label: string;
};

export type MatchedSkill = {
  skillId: string;
  name: string;
  experienceLevel: ExperienceLevel;
};

export type ExplanationMatchFactors = {
  skill: {
    matched: boolean;
    matchedCount: number;
    requiredCount: number;
    matchedSkills: MatchedSkill[];
  };
  availability: {
    matched: boolean;
    requestedStart: string;
    requestedEnd: string;
  };
  proximity: {
    relation: ProximityRelation;
    distanceKm: number | null;
  };
  experience: {
    level: ExperienceLevel | null;
    skillName: string | null;
  };
  rating: {
    average: number | null;
    count: number | null;
  };
  completedJobs: number;
};

export type Recommendation = {
  student: {
    id: string;
    verificationStatus: 'VERIFIED' | 'UNVERIFIED';
  };
  matchedSkills: MatchedSkill[];
  availability: { isAvailable: boolean };
  proximity: {
    relation: ProximityRelation;
    distanceKm: number | null;
  };
  rating: number | null;
  completedJobsCount: number;
  score: number;
  matchFactors: ExplanationMatchFactors;
  reasons: MatchReason[];
};

export type RecommendationsResponse = {
  taskId: string;
  recommendations: Recommendation[];
};
