import { SelectField } from '../../auth/components/SelectField';
import { TextField } from '../../auth/components/TextField';
import {
  CERTIFICATION_MAX,
  DESCRIPTION_MAX,
  type SkillFormErrors,
  type SkillFormValues,
} from '../schemas/student-skill';
import type { CatalogSkill, ExperienceLevel } from '../types';
import { ExperienceLevelField } from './ExperienceLevelField';
import { TextAreaField } from './TextAreaField';

type SkillFormProps = {
  mode: 'create' | 'edit';
  catalog: CatalogSkill[];
  values: SkillFormValues;
  errors: SkillFormErrors;
  formError: string | null;
  submitting: boolean;
  lockedSkillName?: string;
  onChange: (patch: Partial<SkillFormValues>) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

export function SkillForm({
  mode,
  catalog,
  values,
  errors,
  formError,
  submitting,
  lockedSkillName,
  onChange,
  onSubmit,
  onCancel,
}: SkillFormProps) {
  const categories = [...new Set(catalog.map((skill) => skill.category))].sort();
  const skillsInCategory = catalog
    .filter((skill) => skill.category === values.category)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <form
      className="form form--spaced"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {formError ? (
        <div className="alert alert--error" role="alert" aria-live="assertive">
          {formError}
        </div>
      ) : null}

      {mode === 'edit' ? (
        <div className="field">
          <p className="field__label" id="locked-skill-label">
            Skill
          </p>
          <p className="skill-locked" aria-labelledby="locked-skill-label">
            {lockedSkillName}
          </p>
        </div>
      ) : (
        <>
          <SelectField
            id="skill-category"
            label="Skill category"
            name="category"
            value={values.category}
            error={undefined}
            onChange={(event) =>
              onChange({
                category: event.target.value,
                skillId: '',
              })
            }
          >
            <option value="">Select a category</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </SelectField>
          <SelectField
            id="skill-id"
            label="Skill"
            name="skillId"
            value={values.skillId}
            error={errors.skillId}
            disabled={!values.category}
            hint={values.category ? undefined : 'Choose a category first.'}
            onChange={(event) => onChange({ skillId: event.target.value })}
          >
            <option value="">{values.category ? 'Select a skill' : 'Select a category first'}</option>
            {skillsInCategory.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.name}
              </option>
            ))}
          </SelectField>
        </>
      )}

      <ExperienceLevelField
        name="experienceLevel"
        value={values.experienceLevel}
        error={errors.experienceLevel}
        onChange={(value: ExperienceLevel) => onChange({ experienceLevel: value })}
      />

      <TextAreaField
        id="skill-description"
        label="Description (optional)"
        name="description"
        rows={4}
        maxLength={DESCRIPTION_MAX}
        value={values.description}
        error={errors.description}
        hint="A short note about the work you can take on."
        onChange={(event) => onChange({ description: event.target.value })}
      />

      <TextField
        id="skill-reference"
        label="Certification / reference (optional)"
        name="certificationReference"
        maxLength={CERTIFICATION_MAX}
        value={values.certificationReference}
        error={errors.certificationReference}
        hint="A certificate name, course, or person who can confirm this skill."
        onChange={(event) => onChange({ certificationReference: event.target.value })}
      />

      <div className="form-actions">
        <button className="button" type="submit" disabled={submitting}>
          {submitting ? (mode === 'edit' ? 'Saving…' : 'Adding skill…') : mode === 'edit' ? 'Save changes' : 'Add Skill'}
        </button>
        <button className="button button--quiet" type="button" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      </div>
    </form>
  );
}
