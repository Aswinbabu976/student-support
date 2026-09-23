import { useMemo, useState } from 'react';
import type { CatalogSkill } from '../../skills/types';

type TaskSkillSelectorProps = {
  catalog: CatalogSkill[];
  selectedIds: string[];
  error?: string;
  emptyMessage?: string;
  onToggle: (skillId: string) => void;
  onRemove: (skillId: string) => void;
};

export function TaskSkillSelector({
  catalog,
  selectedIds,
  error,
  emptyMessage,
  onToggle,
  onRemove,
}: TaskSkillSelectorProps) {
  const [query, setQuery] = useState('');
  const selected = catalog.filter((skill) => selectedIds.includes(skill.id));
  const errorId = error ? 'task-skills-error' : undefined;
  const hintId = 'task-skills-hint';

  const filteredGroups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const visible = catalog.filter((skill) => {
      if (!needle) {
        return true;
      }
      return (
        skill.name.toLowerCase().includes(needle) || skill.category.toLowerCase().includes(needle)
      );
    });
    const groups = new Map<string, CatalogSkill[]>();
    for (const skill of visible) {
      const current = groups.get(skill.category) ?? [];
      current.push(skill);
      groups.set(skill.category, current);
    }
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [catalog, query]);

  if (catalog.length === 0) {
    return (
      <fieldset className="form-section" aria-describedby={errorId}>
        <legend>Required skills</legend>
        <p className="section-copy">{emptyMessage ?? 'No skills are available right now.'}</p>
        {error ? (
          <p className="field__error" id={errorId} role="alert">
            {error}
          </p>
        ) : null}
      </fieldset>
    );
  }

  return (
    <fieldset className="form-section" aria-describedby={[hintId, errorId].filter(Boolean).join(' ')}>
      <legend>Required skills</legend>
      <p className="section-copy" id={hintId}>
        Choose one or more catalog skills the Student needs for this task.
      </p>

      {selected.length > 0 ? (
        <ul className="skill-chip-list" aria-label="Selected skills">
          {selected.map((skill) => (
            <li key={skill.id}>
              <span className="skill-chip">
                {skill.name}
                <button
                  className="skill-chip__remove"
                  type="button"
                  onClick={() => onRemove(skill.id)}
                >
                  Remove {skill.name}
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="field">
        <label className="field__label" htmlFor="task-skill-search">
          Search skills
        </label>
        <input
          className="field__control"
          id="task-skill-search"
          type="search"
          value={query}
          autoComplete="off"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {filteredGroups.length === 0 ? (
        <p className="section-copy">No skills match that search.</p>
      ) : (
        filteredGroups.map(([category, skills]) => (
          <div className="skill-option-group" key={category}>
            <h3>{category}</h3>
            <ul className="skill-option-list">
              {skills.map((skill) => {
                const checked = selectedIds.includes(skill.id);
                return (
                  <li key={skill.id}>
                    <label className="skill-option">
                      <input
                        type="checkbox"
                        name="skillIds"
                        value={skill.id}
                        checked={checked}
                        onChange={() => onToggle(skill.id)}
                      />
                      <span>{skill.name}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}

      {error ? (
        <p className="field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
