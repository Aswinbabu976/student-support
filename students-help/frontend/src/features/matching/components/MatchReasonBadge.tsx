import type { MatchReason } from '../types';

type MatchReasonBadgeProps = {
  reason: MatchReason;
};

export function MatchReasonBadge({ reason }: MatchReasonBadgeProps) {
  return (
    <li className="match-badge">
      <span className="match-badge__mark" aria-hidden="true">
        ✓
      </span>
      <span>{reason.label}</span>
    </li>
  );
}
