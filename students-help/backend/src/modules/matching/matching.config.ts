/**
 * Deterministic Sprint 1 ranking weights. Values sum to 100 so a factor's
 * contribution is easy to read as "points out of 100".
 *
 * Skill and experience dominate because they describe whether the Student can
 * do the work. Availability is a hard eligibility filter; remaining candidates
 * receive the full availability weight. Proximity is an approximation until
 * Student addresses/coordinates exist. Rating and completed-job weights are
 * reserved for later stories and currently contribute 0 for every candidate.
 */
export const MATCHING_WEIGHTS = {
  skill: 35,
  experience: 20,
  availability: 15,
  proximity: 20,
  rating: 5,
  completedJobs: 5,
} as const;

export const EXPERIENCE_TIER_VALUE = {
  BEGINNER: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
  EXPERT: 4,
} as const;

export const MAX_EXPERIENCE_TIER = EXPERIENCE_TIER_VALUE.EXPERT;

export const PROXIMITY_SCORE = {
  SAME_CITY: 1,
  DIFFERENT_CITY: 0.2,
  UNKNOWN: 0.4,
} as const;

/** Rating 0–5 maps onto 0–1. Null ratings contribute 0 (neutral, not a fake average). */
export const MAX_RATING = 5;

/** Completed jobs are capped so a long history cannot dwarf other factors. */
export const COMPLETED_JOBS_CAP = 20;

export const MAX_RECOMMENDATIONS = 25;

/**
 * Student profiles have no address. Until that exists, proximity compares the
 * city implied by a verified university email domain with tokens in the task
 * location line. The email itself is never returned.
 */
export const UNIVERSITY_LOCALITY: Record<string, string[]> = {
  'tum.de': ['munich', 'münchen', 'muenchen', 'garching'],
  'hs-heilbronn.de': ['heilbronn'],
  'uni-stuttgart.de': ['stuttgart'],
};
