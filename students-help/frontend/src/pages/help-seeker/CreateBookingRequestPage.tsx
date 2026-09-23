import { Link, useParams } from 'react-router-dom';
import { AuthShell } from '../../features/auth/components/AuthShell';
import { BookingSummary } from '../../features/booking/components/BookingSummary';
import { useCreateBookingRequest } from '../../features/booking/hooks/useCreateBookingRequest';
import { EXPERIENCE_LEVEL_LABELS } from '../../features/skills/types';
import { HelpSeekerAccountNav } from '../../features/help-seeker/HelpSeekerAccountNav';
import { CostEstimate } from '../../features/pricing/components/CostEstimate';

export function CreateBookingRequestPage() {
  const { taskId, studentId } = useParams();
  const page = useCreateBookingRequest(taskId, studentId);
  const primary = page.recommendation?.matchedSkills[0];
  const studentHeading = primary?.name ?? 'Selected student';
  const studentDetail = primary
    ? EXPERIENCE_LEVEL_LABELS[primary.experienceLevel]
    : undefined;

  return (
    <AuthShell eyebrow="Help Seeker">
      <section className="account-page account-page--wide">
        <HelpSeekerAccountNav />

        <header className="account-page__header">
          <div>
            <p className="eyebrow">Booking</p>
            <h1>Booking Request</h1>
            <p className="lede">Review the task and Student, then send a request. This is not a confirmed booking.</p>
          </div>
        </header>

        {page.loading ? <p className="lede">Loading booking summary…</p> : null}

        {page.error ? (
          <div className="alert alert--error" role="alert">
            {page.error}
          </div>
        ) : null}

        {page.submitError ? (
          <div className="alert alert--error" role="alert">
            {page.submitError}
          </div>
        ) : null}

        {page.task && !page.loading && !page.error ? (
          <BookingSummary
            task={page.task}
            studentHeading={studentHeading}
            studentDetail={studentDetail}
            verificationStatus={page.recommendation?.student.verificationStatus}
            beforeActions={<CostEstimate taskId={page.task.id} />}
            actions={
              <>
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    void page.submit();
                  }}
                  disabled={page.submitting}
                  aria-busy={page.submitting}
                >
                  {page.submitting ? 'Sending request…' : 'Send Booking Request'}
                </button>
                {taskId ? (
                  <Link className="button button--quiet" to={`/help-seeker/tasks/${taskId}/recommendations`}>
                    Back
                  </Link>
                ) : null}
              </>
            }
          />
        ) : null}
      </section>
    </AuthShell>
  );
}
