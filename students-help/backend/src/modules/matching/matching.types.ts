import type { ExperienceLevel, VerificationStatus } from '@prisma/client';

export type ProximityRelation = 'SAME_CITY' | 'DIFFERENT_CITY' | 'UNKNOWN';

export type MatchFactors = {
  skillCoverage: number;
  skillMatched: boolean;
  availabilityMatched: boolean;
  experienceLevel: ExperienceLevel | null;
  proximity: ProximityRelation;
  distanceKm: number | null;
  rating: number | null;
  completedJobsCount: number;
};

export type FactorScores = {
  skillScore: number;
  experienceScore: number;
  availabilityScore: number;
  proximityScore: number;
  ratingScore: number;
  completedJobsScore: number;
};

export type ScoredCandidate = {
  studentId: string;
  matchedSkills: Array<{
    skillId: string;
    name: string;
    experienceLevel: ExperienceLevel;
  }>;
  verificationStatus: VerificationStatus;
  totalScore: number;
  factors: FactorScores;
  matchFactors: MatchFactors;
};

export type RecommendationView = {
  student: {
    id: string;
    verificationStatus: VerificationStatus;
  };
  matchedSkills: ScoredCandidate['matchedSkills'];
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

export type ExplanationMatchFactors = {
  skill: {
    matched: boolean;
    matchedCount: number;
    requiredCount: number;
    matchedSkills: ScoredCandidate['matchedSkills'];
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

export type RecommendationsResponse = {
  taskId: string;
  recommendations: RecommendationView[];
};

export type CandidateSnapshot = {
  studentId: string;
  email: string;
  verificationStatus: VerificationStatus;
  matchedSkills: ScoredCandidate['matchedSkills'];
  rating: number | null;
  completedJobsCount: number;
};
