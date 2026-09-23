import { formatDuration } from '../../tasks/format';
import type { TaskView } from '../../tasks/types';
import { formatTaskDateLabel } from '../format';

type BookingTaskSummaryProps = {
  task: TaskView;
};

export function BookingTaskSummary({ task }: BookingTaskSummaryProps) {
  return (
    <section>
      <h2>Task</h2>
      <dl className="review-list">
        <div>
          <dt>Task</dt>
          <dd>{task.title}</dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>{formatTaskDateLabel(task.preferredDate)}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>
            {task.preferredTime} ({task.timezone})
          </dd>
        </div>
        <div>
          <dt>Estimated duration</dt>
          <dd>{formatDuration(task.estimatedDurationMinutes)}</dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>{task.location.addressLine}</dd>
        </div>
        <div>
          <dt>Required skills</dt>
          <dd>{task.skills.map((skill) => skill.name).join(', ')}</dd>
        </div>
      </dl>
    </section>
  );
}
