import { TextAreaField } from '../../skills/components/TextAreaField';
import { INSTRUCTIONS_MAX, type TaskFormErrors } from '../schemas/create-task';
import type { TaskFormValues } from '../types';

type TaskInstructionsSectionProps = {
  values: TaskFormValues;
  errors: TaskFormErrors;
  onChange: (patch: Partial<TaskFormValues>) => void;
};

export function TaskInstructionsSection({ values, errors, onChange }: TaskInstructionsSectionProps) {
  return (
    <fieldset className="form-section">
      <legend>Special instructions</legend>
      <TextAreaField
        id="task-instructions"
        label="Special instructions (optional)"
        name="specialInstructions"
        maxLength={INSTRUCTIONS_MAX}
        rows={4}
        value={values.specialInstructions}
        error={errors.specialInstructions}
        hint="Access notes, tools to bring, or other details that are not part of the main description."
        onChange={(event) => onChange({ specialInstructions: event.target.value })}
      />
    </fieldset>
  );
}
