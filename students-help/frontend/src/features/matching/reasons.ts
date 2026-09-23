import type { MatchReason, MatchReasonType, Recommendation } from './types';

const COMPACT_TYPES: MatchReasonType[] = ['SKILL', 'AVAILABILITY', 'PROXIMITY'];

export function compactMatchReasons(reasons: MatchReason[] | undefined): MatchReason[] {
  if (!reasons) {
    return [];
  }
  return reasons.filter((reason) => COMPACT_TYPES.includes(reason.type)).slice(0, 3);
}

export function reasonsByType(
  reasons: MatchReason[] | undefined,
): Partial<Record<MatchReasonType, MatchReason>> {
  const map: Partial<Record<MatchReasonType, MatchReason>> = {};
  for (const reason of reasons ?? []) {
    map[reason.type] ??= reason;
  }
  return map;
}

export function hasExpandableMatchDetails(recommendation: Recommendation): boolean {
  return (recommendation.reasons?.length ?? 0) > 0;
}
