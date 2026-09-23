import { AuthShell } from '../../features/auth/components/AuthShell';
import { DeleteSkillDialog } from '../../features/skills/components/DeleteSkillDialog';
import { SkillForm } from '../../features/skills/components/SkillForm';
import { SkillList } from '../../features/skills/components/SkillList';
import { useStudentSkills } from '../../features/skills/hooks/useStudentSkills';
import { StudentAccountNav } from '../../features/student/StudentAccountNav';

export function StudentSkillsPage() {
  const skills = useStudentSkills();

  return (
    <AuthShell eyebrow="Student">
      <section className="account-page">
        <StudentAccountNav />
        {skills.mode === 'list' ? (
          <>
            <header className="account-page__header">
              <div>
                <p className="eyebrow">Student profile</p>
                <h1>Skills & Experience</h1>
                <p className="lede">
                  Add the skills you can offer and indicate your experience level.
                </p>
              </div>
              {skills.skills.length > 0 && !skills.loading ? (
                <button className="button" type="button" onClick={skills.startCreate}>
                  Add Skill
                </button>
              ) : null}
            </header>

            {skills.successMessage ? (
              <div className="alert alert--ok" role="status">
                {skills.successMessage}
              </div>
            ) : null}

            {skills.loadError ? (
              <div className="alert alert--error" role="alert">
                {skills.loadError}
              </div>
            ) : null}

            {skills.loading ? <p className="lede">Loading your skills…</p> : null}

            {!skills.loading && skills.skills.length === 0 ? (
              <div className="empty-state">
                <p>You haven&apos;t added any skills yet.</p>
                <p className="empty-state__copy">
                  Add the skills you can offer so Help Seekers can find you for relevant tasks.
                </p>
                <button className="button" type="button" onClick={skills.startCreate}>
                  Add Skill
                </button>
              </div>
            ) : null}

            {!skills.loading && skills.skills.length > 0 ? (
              <SkillList
                skills={skills.skills}
                onEdit={skills.startEdit}
                onRemove={skills.requestDelete}
              />
            ) : null}
          </>
        ) : (
          <div className="panel">
            <p className="eyebrow">{skills.mode === 'edit' ? 'Edit skill' : 'Add skill'}</p>
            <h1>{skills.mode === 'edit' ? 'Update experience' : 'Add a skill'}</h1>
            <p className="lede">
              {skills.mode === 'edit'
                ? 'You can change the experience level, description, and reference. Remove this skill and add another if you need a different catalog skill.'
                : 'Choose a category, then the skill you can offer.'}
            </p>
            <SkillForm
              mode={skills.mode}
              catalog={skills.catalog}
              values={skills.form}
              errors={skills.fieldErrors}
              formError={skills.formError}
              submitting={skills.submitting}
              lockedSkillName={skills.editing?.skill.name}
              onChange={skills.patchForm}
              onSubmit={() => {
                void skills.submitForm();
              }}
              onCancel={skills.cancelForm}
            />
          </div>
        )}
      </section>

      {skills.pendingDelete ? (
        <DeleteSkillDialog
          skillName={skills.pendingDelete.skill.name}
          busy={skills.deleting}
          onCancel={skills.cancelDelete}
          onConfirm={() => {
            void skills.confirmDelete();
          }}
        />
      ) : null}
    </AuthShell>
  );
}
