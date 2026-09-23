import { compactMatchReasons } from '../reasons';
import type { MatchReason } from '../types';
import { MatchReasonBadge } from './MatchReasonBadge';

type MatchReasonListProps = {
  reasons: MatchReason[] | undefined;
};

export function MatchReasonList({ reasons }: MatchReasonListProps) {
  const compact = compactMatchReasons(reasons);
  if (compact.length === 0) {
    return null;
  }

  return (
    <ul className="match-badges" aria-label="Match reasons">
      {compact.map((reason) => (
        <MatchReasonBadge key={reason.type} reason={reason} />
      ))}
    </ul>
  );
}
