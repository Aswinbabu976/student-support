import { UNIVERSITY_LOCALITY, PROXIMITY_SCORE } from './matching.config.js';
import type { ProximityRelation } from './matching.types.js';

export type LocalityMatch = {
  relation: ProximityRelation;
  score: number;
};

function normalize(value: string): string {
  return value.trim().toLowerCase().replaceAll('ß', 'ss');
}

export function localityFromEmail(email: string): string[] {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  return UNIVERSITY_LOCALITY[domain] ?? [];
}

export function localityFromLocationLine(locationLine: string): string[] {
  const normalized = normalize(locationLine);
  const known = Object.values(UNIVERSITY_LOCALITY).flat();
  return known.filter((city) => normalized.includes(city));
}

export function calculateProximity(locationLine: string, email: string): LocalityMatch {
  const taskCities = localityFromLocationLine(locationLine);
  const studentCities = localityFromEmail(email);

  if (taskCities.length === 0 || studentCities.length === 0) {
    return { relation: 'UNKNOWN', score: PROXIMITY_SCORE.UNKNOWN };
  }
  const overlap = studentCities.some((city) => taskCities.includes(city));
  if (overlap) {
    return { relation: 'SAME_CITY', score: PROXIMITY_SCORE.SAME_CITY };
  }
  return { relation: 'DIFFERENT_CITY', score: PROXIMITY_SCORE.DIFFERENT_CITY };
}
