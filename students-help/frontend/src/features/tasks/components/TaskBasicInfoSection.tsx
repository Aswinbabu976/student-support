import { TextAreaField } from '../../skills/components/TextAreaField';
import { TextField } from '../../auth/components/TextField';
import { DESCRIPTION_MAX, TITLE_MAX, type TaskFormErrors } from '../schemas/create-task';
import type { TaskFormValues } from '../types';

type TaskBasicInfoSectionProps = {
  values: TaskFormValues;
  errors: TaskFormErrors;
  onChange: (patch: Partial<TaskFormValues>) => void;
};

export function TaskBasicInfoSection({ values, errors, onChange }: TaskBasicInfoSectionProps) {
  return (
    <fieldset className="form-section">
      <legend>Task details</legend>
      <p className="section-copy">Describe the work so a Student can tell whether they can help.</p>
      <TextField
        id="task-title"
        label="Task title"
        name="title"
        autoComplete="off"
        maxLength={TITLE_MAX}
        value={values.title}
        error={errors.title}
        hint="Keep it short, for example Furniture Assembly."
        onChange={(event) => onChange({ title: event.target.value })}
      />
      <TextAreaField
        id="task-description"
        label="Task description"
        name="description"
        maxLength={DESCRIPTION_MAX}
        rows={5}
        value={values.description}
        error={errors.description}
        hint="Explain what needs doing, how much work it is, and any constraints."
        onChange={(event) => onChange({ description: event.target.value })}
      />
    </fieldset>
  );
}
