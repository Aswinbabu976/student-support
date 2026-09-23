import type { StudentSkill } from '../types';
import { SkillCard } from './SkillCard';

type SkillListProps = {
  skills: StudentSkill[];
  onEdit: (item: StudentSkill) => void;
  onRemove: (item: StudentSkill) => void;
};

export function SkillList({ skills, onEdit, onRemove }: SkillListProps) {
  return (
    <ul className="skill-list">
      {skills.map((item) => (
        <SkillCard key={item.id} item={item} onEdit={onEdit} onRemove={onRemove} />
      ))}
    </ul>
  );
}
