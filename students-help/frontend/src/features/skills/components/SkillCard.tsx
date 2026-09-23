import { EXPERIENCE_LEVEL_LABELS } from '../types';
import type { StudentSkill } from '../types';

type SkillCardProps = {
  item: StudentSkill;
  onEdit: (item: StudentSkill) => void;
  onRemove: (item: StudentSkill) => void;
};

export function SkillCard({ item, onEdit, onRemove }: SkillCardProps) {
  return (
    <li className="skill-row">
      <div className="skill-row__body">
        <h2>{item.skill.name}</h2>
        <p className="skill-row__level">{EXPERIENCE_LEVEL_LABELS[item.experienceLevel]}</p>
        {item.description ? <p className="skill-row__description">{item.description}</p> : null}
        {item.certificationReference ? (
          <p className="skill-row__reference">
            Reference available
            <span className="sr-only">: {item.certificationReference}</span>
          </p>
        ) : null}
      </div>
      <div className="skill-row__actions">
        <button className="button button--quiet" type="button" onClick={() => onEdit(item)}>
          Edit
        </button>
        <button className="button button--quiet" type="button" onClick={() => onRemove(item)}>
          Remove
        </button>
      </div>
    </li>
  );
}
