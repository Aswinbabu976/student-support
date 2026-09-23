import { Link } from 'react-router-dom';
import { EXPERIENCE_LEVEL_LABELS } from '../../skills/types';
import type { Recommendation } from '../types';
import { MatchDetails } from './MatchDetails';
import { MatchReasonList } from './MatchReasonList';

type StudentRecommendationCardProps = {
  taskId: string;
  recommendation: Recommendation;
};

export function StudentRecommendationCard({ taskId, recommendation }: StudentRecommendationCardProps) {
  const primary = recommendation.matchedSkills?.[0];
  const extra = recommendation.matchedSkills?.slice(1) ?? [];
  const heading = primary?.name ?? 'Matched student';

  return (
    <article className="skill-row" aria-labelledby={`student-${recommendation.student.id}`}>
      <div>
        <p className="eyebrow">
          {recommendation.student.verificationStatus === 'VERIFIED' ? 'Verified student' : 'Student'}
        </p>
        <h2 id={`student-${recommendation.student.id}`}>{heading}</h2>
        {primary ? (
          <p className="skill-row__level">{EXPERIENCE_LEVEL_LABELS[primary.experienceLevel]}</p>
        ) : null}
        {extra.length > 0 ? (
          <p className="skill-row__description">
            Also: {extra.map((skill) => `${skill.name} (${EXPERIENCE_LEVEL_LABELS[skill.experienceLevel]})`).join(', ')}
          </p>
        ) : null}
        <MatchReasonList reasons={recommendation.reasons} />
        <MatchDetails recommendation={recommendation} />
      </div>
      <div className="skill-row__actions">
        <Link className="button" to={`/help-seeker/tasks/${taskId}/book/${recommendation.student.id}`}>
          Request Booking
        </Link>
      </div>
    </article>
  );
}
