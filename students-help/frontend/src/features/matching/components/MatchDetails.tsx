import { useId, useState } from 'react';
import { EXPERIENCE_LEVEL_LABELS } from '../../skills/types';
import { hasExpandableMatchDetails, reasonsByType } from '../reasons';
import type { Recommendation } from '../types';

type MatchDetailsProps = {
  recommendation: Recommendation;
};

export function MatchDetails({ recommendation }: MatchDetailsProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  if (!hasExpandableMatchDetails(recommendation)) {
    return null;
  }

  const byType = reasonsByType(recommendation.reasons);
  const matchedSkills = recommendation.matchedSkills ?? [];
  const skillSection = byType.SKILL || byType.EXPERIENCE || matchedSkills.length > 0;
  const scheduleSection = byType.AVAILABILITY;
  const locationSection = byType.PROXIMITY;
  const reputationSection = byType.RATING || byType.COMPLETED_JOBS;

  return (
    <div className="match-details">
      <button
        type="button"
        className="match-details__toggle"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        Why this matches
      </button>
      {open ? (
        <div id={panelId} className="match-details__body" role="region" aria-label="Match explanation">
          {skillSection ? (
            <section>
              <h3>Skills</h3>
              {byType.SKILL ? <p>{byType.SKILL.label}</p> : null}
              {byType.EXPERIENCE ? <p>{byType.EXPERIENCE.label}</p> : null}
              {matchedSkills.length > 0 ? (
                <ul className="match-details__skills">
                  {matchedSkills.map((skill) => (
                    <li key={skill.skillId}>
                      {skill.name} — {EXPERIENCE_LEVEL_LABELS[skill.experienceLevel]}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          {scheduleSection ? (
            <section>
              <h3>Schedule</h3>
              <p>{scheduleSection.label}</p>
            </section>
          ) : null}

          {locationSection ? (
            <section>
              <h3>Location</h3>
              <p>{locationSection.label}</p>
            </section>
          ) : null}

          {reputationSection ? (
            <section>
              <h3>Reputation</h3>
              {byType.RATING ? <p>{byType.RATING.label}</p> : null}
              {byType.COMPLETED_JOBS ? <p>{byType.COMPLETED_JOBS.label}</p> : null}
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
