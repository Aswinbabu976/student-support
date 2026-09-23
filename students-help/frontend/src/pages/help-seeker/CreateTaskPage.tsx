import { TaskBasicInfoSection } from '../../features/tasks/components/TaskBasicInfoSection';
import { TaskInstructionsSection } from '../../features/tasks/components/TaskInstructionsSection';
import { TaskLocationSection } from '../../features/tasks/components/TaskLocationSection';
import { TaskPhotoSection } from '../../features/tasks/components/TaskPhotoSection';
import { TaskReview } from '../../features/tasks/components/TaskReview';
import { TaskScheduleSection } from '../../features/tasks/components/TaskScheduleSection';
import { TaskSkillSelector } from '../../features/tasks/components/TaskSkillSelector';
import { useCreateTask } from '../../features/tasks/hooks/useCreateTask';
import { AuthShell } from '../../features/auth/components/AuthShell';
import { HelpSeekerAccountNav } from '../../features/help-seeker/HelpSeekerAccountNav';
import { Link } from 'react-router-dom';

export function CreateTaskPage() {
  const task = useCreateTask();

  return (
    <AuthShell eyebrow="Help Seeker">
      <section className="account-page account-page--wide">
        <HelpSeekerAccountNav />

        {task.loading ? <p className="lede">Loading the task form…</p> : null}

        {task.accessError ? (
          <div className="alert alert--error" role="alert">
            {task.accessError}
          </div>
        ) : null}

        {task.loadError ? (
          <div className="alert alert--error" role="alert">
            {task.loadError}
          </div>
        ) : null}

        {!task.loading && !task.accessError && !task.loadError && task.stage === 'form' ? (
          <div className="panel">
            <p className="eyebrow">New task</p>
            <h1>Create a task</h1>
            <p className="lede">
              Tell Students what help you need, where, and when. You will review everything before
              it is published.
            </p>

            <form
              className="form form--spaced"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                task.goToReview();
              }}
            >
              {task.formError ? (
                <div className="alert alert--error" role="alert" aria-live="assertive">
                  {task.formError}
                </div>
              ) : null}

              <TaskBasicInfoSection values={task.form} errors={task.fieldErrors} onChange={task.patchForm} />
              <TaskSkillSelector
                catalog={task.catalog}
                selectedIds={task.form.skillIds}
                error={task.fieldErrors.skillIds}
                onToggle={task.toggleSkill}
                onRemove={task.removeSkill}
              />
              <TaskLocationSection
                values={task.form}
                errors={task.fieldErrors}
                savedAddress={task.savedAddress}
                onChange={task.patchForm}
              />
              <TaskScheduleSection
                values={task.form}
                errors={task.fieldErrors}
                timezones={task.timezones}
                onChange={task.patchForm}
              />
              <TaskPhotoSection />
              <TaskInstructionsSection
                values={task.form}
                errors={task.fieldErrors}
                onChange={task.patchForm}
              />

              <div className="form-actions">
                <button className="button" type="submit">
                  Review task
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {!task.loading && !task.accessError && task.stage === 'review' ? (
          <TaskReview
            values={task.form}
            catalog={task.catalog}
            submitting={task.submitting}
            formError={task.formError}
            onBack={task.backToForm}
            onPublish={() => {
              void task.publish();
            }}
          />
        ) : null}

        {task.stage === 'success' && task.createdTask ? (
          <section className="panel status-block">
            <p className="eyebrow">Published</p>
            <h1>Task published successfully.</h1>
            <p className="lede">{task.createdTask.title} is now visible to Students who can help.</p>
            <div className="form-actions">
              <Link className="button" to={`/help-seeker/tasks/${task.createdTask.id}/recommendations`}>
                Find Students
              </Link>
              <Link className="button button--quiet" to={`/help-seeker/tasks/${task.createdTask.id}`}>
                View task
              </Link>
              <button className="button button--quiet" type="button" onClick={task.startNew}>
                Create another task
              </button>
            </div>
          </section>
        ) : null}
      </section>
    </AuthShell>
  );
}
