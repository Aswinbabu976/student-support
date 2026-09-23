import { EXPERIENCE_LEVELS, EXPERIENCE_LEVEL_HELP, EXPERIENCE_LEVEL_LABELS } from '../types';
import type { ExperienceLevel } from '../types';

type ExperienceLevelFieldProps = {
  name: string;
  value: string;
  error?: string;
  onChange: (value: ExperienceLevel) => void;
};

export function ExperienceLevelField({ name, value, error, onChange }: ExperienceLevelFieldProps) {
  const errorId = error ? `${name}-error` : undefined;

  return (
    <fieldset className="level-fieldset" aria-describedby={errorId} aria-invalid={Boolean(error)}>
      <legend className="field__label">Experience level</legend>
      <div className="level-options">
        {EXPERIENCE_LEVELS.map((level) => {
          const helpId = `${name}-${level}-help`;
          return (
            <label key={level} className="level-option" htmlFor={`${name}-${level}`}>
              <input
                id={`${name}-${level}`}
                type="radio"
                name={name}
                value={level}
                checked={value === level}
                aria-describedby={helpId}
                onChange={() => onChange(level)}
              />
              <span>
                <span className="level-option__label">{EXPERIENCE_LEVEL_LABELS[level]}</span>
                <span className="level-option__help" id={helpId}>
                  {EXPERIENCE_LEVEL_HELP[level]}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p className="field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
