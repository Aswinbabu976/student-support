import type { CatalogSkill } from '../../skills/types';
import { formatDuration } from '../format';
import type { TaskFormValues } from '../types';

type TaskReviewProps = {
  values: TaskFormValues;
  catalog: CatalogSkill[];
  submitting: boolean;
  formError: string | null;
  onBack: () => void;
  onPublish: () => void;
};

export function TaskReview({
  values,
  catalog,
  submitting,
  formError,
  onBack,
  onPublish,
}: TaskReviewProps) {
  const selectedSkills = catalog.filter((skill) => values.skillIds.includes(skill.id));
  const hours = Number(values.durationHours || 0);
  const minutes = Number(values.durationMinutes || 0);
  const durationMinutes = hours * 60 + minutes;

  return (
    <section className="panel" aria-labelledby="task-review-heading">
      <p className="eyebrow">Review</p>
      <h1 id="task-review-heading" tabIndex={-1}>
        Check the task before publishing
      </h1>
      <p className="lede">Confirm the details Students will see. You can go back to edit anything.</p>

      {formError ? (
        <div className="alert alert--error" role="alert" aria-live="assertive">
          {formError}
        </div>
      ) : null}

      <dl className="review-list">
        <div>
          <dt>Title</dt>
          <dd>{values.title}</dd>
        </div>
        <div>
          <dt>Description</dt>
          <dd>{values.description}</dd>
        </div>
        <div>
          <dt>Required skills</dt>
          <dd>{selectedSkills.map((skill) => skill.name).join(', ') || 'None selected'}</dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>{values.locationLine}</dd>
        </div>
        <div>
          <dt>Preferred date</dt>
          <dd>{values.preferredDate}</dd>
        </div>
        <div>
          <dt>Preferred time</dt>
          <dd>
            {values.preferredTime} ({values.timezone})
          </dd>
        </div>
        <div>
          <dt>Estimated duration</dt>
          <dd>{Number.isFinite(durationMinutes) ? formatDuration(durationMinutes) : 'Not set'}</dd>
        </div>
        <div>
          <dt>Photos</dt>
          <dd>0 — photo upload is not available yet</dd>
        </div>
        <div>
          <dt>Special instructions</dt>
          <dd>{values.specialInstructions.trim() || 'None'}</dd>
        </div>
      </dl>

      <div className="form-actions">
        <button className="button" type="button" disabled={submitting} onClick={onPublish}>
          {submitting ? 'Publishing…' : 'Publish Task'}
        </button>
        <button className="button button--quiet" type="button" disabled={submitting} onClick={onBack}>
          Back
        </button>
      </div>
    </section>
  );
}
