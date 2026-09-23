import { Link, useParams } from 'react-router-dom';
import { AuthShell } from '../../features/auth/components/AuthShell';
import { HelpSeekerAccountNav } from '../../features/help-seeker/HelpSeekerAccountNav';
import { formatDuration } from '../../features/tasks/format';
import { useTaskDetails } from '../../features/tasks/hooks/useTaskDetails';
import { CostEstimate } from '../../features/pricing/components/CostEstimate';

export function TaskDetailsPage() {
  const { taskId } = useParams();
  const details = useTaskDetails(taskId);

  return (
    <AuthShell eyebrow="Help Seeker">
      <section className="account-page account-page--wide">
        <HelpSeekerAccountNav />

        {details.loading ? <p className="lede">Loading this task…</p> : null}

        {details.error ? (
          <div className="alert alert--error" role="alert">
            {details.error}
          </div>
        ) : null}

        {details.task ? (
          <section className="panel">
            <p className="eyebrow">{details.task.status === 'PUBLISHED' ? 'Published task' : 'Task'}</p>
            <h1>{details.task.title}</h1>
            <p className="lede">{details.task.description}</p>
            <dl className="review-list">
              <div>
                <dt>Required skills</dt>
                <dd>{details.task.skills.map((skill) => skill.name).join(', ')}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{details.task.location.addressLine}</dd>
              </div>
              <div>
                <dt>Preferred date</dt>
                <dd>{details.task.preferredDate}</dd>
              </div>
              <div>
                <dt>Preferred time</dt>
                <dd>
                  {details.task.preferredTime} ({details.task.timezone})
                </dd>
              </div>
              <div>
                <dt>Estimated duration</dt>
                <dd>{formatDuration(details.task.estimatedDurationMinutes)}</dd>
              </div>
              <div>
                <dt>Special instructions</dt>
                <dd>{details.task.specialInstructions || 'None'}</dd>
              </div>
            </dl>
            <CostEstimate taskId={details.task.id} />
            <div className="form-actions">
              <Link className="button" to={`/help-seeker/tasks/${details.task.id}/recommendations`}>
                Find Students
              </Link>
              <Link className="button button--quiet" to="/help-seeker/tasks/create">
                Create another task
              </Link>
            </div>
          </section>
        ) : null}
      </section>
    </AuthShell>
  );
}
