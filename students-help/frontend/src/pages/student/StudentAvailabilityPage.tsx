import { AuthShell } from '../../features/auth/components/AuthShell';
import { DeleteAvailabilityDialog } from '../../features/availability/components/DeleteAvailabilityDialog';
import { UnavailablePeriodForm } from '../../features/availability/components/UnavailablePeriodForm';
import { UnavailablePeriodList } from '../../features/availability/components/UnavailablePeriodList';
import { WeeklyAvailability } from '../../features/availability/components/WeeklyAvailability';
import { formatUnavailableRange } from '../../features/availability/format';
import { useStudentAvailability } from '../../features/availability/hooks/useStudentAvailability';
import { StudentAccountNav } from '../../features/student/StudentAccountNav';

function todayIsoDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function StudentAvailabilityPage() {
  const availability = useStudentAvailability();

  return (
    <AuthShell eyebrow="Student">
      <section className="account-page account-page--wide">
        <StudentAccountNav />
        <header className="account-page__header">
          <div>
            <p className="eyebrow">Student profile</p>
            <h1>Availability</h1>
            <p className="lede">
              Set when you&apos;re generally available for tasks. You can also block dates when you&apos;re
              unavailable.
            </p>
          </div>
        </header>

        {availability.successMessage ? (
          <div className="alert alert--ok" role="status">
            {availability.successMessage}
          </div>
        ) : null}
        {availability.loadError ? (
          <div className="alert alert--error" role="alert">
            {availability.loadError}
          </div>
        ) : null}
        {availability.loading ? <p className="lede">Loading your availability…</p> : null}

        {availability.isEmpty ? (
          <div className="empty-state">
            <p>You haven&apos;t added any availability yet.</p>
            <p className="empty-state__copy">
              Set the times you&apos;re usually available so the platform can recommend tasks that fit your
              schedule.
            </p>
            <button className="button" type="button" onClick={availability.startEditing}>
              Set availability
            </button>
          </div>
        ) : null}

        {!availability.loading && !availability.isEmpty ? (
          <>
            <WeeklyAvailability
              timezone={availability.timezone}
              timezoneOptions={availability.timezoneOptions}
              days={availability.days}
              errors={availability.weeklyErrors}
              formError={availability.weeklyFormError}
              submitting={availability.weeklySubmitting}
              onTimezoneChange={availability.setTimezone}
              onToggle={availability.setDayEnabled}
              onAddSlot={availability.addSlot}
              onChangeSlot={availability.updateSlot}
              onRemoveSlot={availability.removeSlot}
              onSubmit={() => {
                void availability.submitWeekly();
              }}
            />
            <section className="availability-section" aria-labelledby="unavailable-heading">
              <h2 id="unavailable-heading">Unavailable dates</h2>
              <p className="section-copy">
                Block vacation or other dates. Weekly hours stay in place and are skipped during these
                periods.
              </p>
              <UnavailablePeriodList
                periods={availability.unavailable}
                onRemove={availability.requestDelete}
              />
              <UnavailablePeriodForm
                startDate={availability.vacation.startDate}
                endDate={availability.vacation.endDate}
                reason={availability.vacation.reason}
                errors={availability.vacationErrors}
                formError={availability.vacationFormError}
                submitting={availability.vacationSubmitting}
                minDate={todayIsoDate()}
                onChange={availability.patchVacation}
                onSubmit={() => {
                  void availability.submitVacation();
                }}
              />
            </section>
          </>
        ) : null}
      </section>

      {availability.pendingDelete ? (
        <DeleteAvailabilityDialog
          title={`Remove ${formatUnavailableRange(availability.pendingDelete.startDate, availability.pendingDelete.endDate)}?`}
          description="This period will no longer block matching. Your weekly availability is unchanged."
          confirmLabel="Remove period"
          busy={availability.deleting}
          onCancel={availability.cancelDelete}
          onConfirm={() => {
            void availability.confirmDelete();
          }}
        />
      ) : null}
    </AuthShell>
  );
}
