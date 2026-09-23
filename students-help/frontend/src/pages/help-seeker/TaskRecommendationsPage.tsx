import { Link, useParams } from 'react-router-dom';
import { AuthShell } from '../../features/auth/components/AuthShell';
import { HelpSeekerAccountNav } from '../../features/help-seeker/HelpSeekerAccountNav';
import { RecommendationList } from '../../features/matching/components/RecommendationList';
import { useTaskRecommendations } from '../../features/matching/hooks/useTaskRecommendations';

export function TaskRecommendationsPage() {
  const { taskId } = useParams();
  const page = useTaskRecommendations(taskId);

  return (
    <AuthShell eyebrow="Help Seeker">
      <section className="account-page account-page--wide">
        <HelpSeekerAccountNav />

        <header className="account-page__header">
          <div>
            <p className="eyebrow">Matching</p>
            <h1>Recommended Students</h1>
            <p className="lede">
              Students are ranked based on skills, experience, availability, location, ratings, and
              previous jobs.
            </p>
            {page.task ? <p className="section-copy">For {page.task.title}.</p> : null}
          </div>
        </header>

        {page.loading ? <p className="lede">Loading recommendations…</p> : null}

        {page.error ? (
          <div className="alert alert--error" role="alert">
            {page.error}
          </div>
        ) : null}

        {!page.loading && !page.error && page.recommendations.length === 0 ? (
          <div className="empty-state">
            <p>No suitable Students are available for this task right now.</p>
            <p className="empty-state__copy">Try adjusting the task time or required skills later.</p>
            {taskId ? (
              <Link className="button button--quiet" to={`/help-seeker/tasks/${taskId}`}>
                Back to Task
              </Link>
            ) : null}
          </div>
        ) : null}

        {!page.loading && !page.error && taskId && page.recommendations.length > 0 ? (
          <RecommendationList taskId={taskId} recommendations={page.recommendations} />
        ) : null}

        {taskId && !page.loading && (page.error || page.recommendations.length > 0) ? (
          <p className="form-footer">
            <Link to={`/help-seeker/tasks/${taskId}`}>Back to Task</Link>
          </p>
        ) : null}
      </section>
    </AuthShell>
  );
}
