type BookingStudentSummaryProps = {
  verificationStatus?: 'VERIFIED' | 'UNVERIFIED';
  heading: string;
  detail?: string;
};

export function BookingStudentSummary({
  verificationStatus,
  heading,
  detail,
}: BookingStudentSummaryProps) {
  return (
    <section>
      <h2>Student</h2>
      <p className="eyebrow">
        {verificationStatus === 'VERIFIED' ? 'Verified student' : 'Student'}
      </p>
      <p className="skill-row__level">{heading}</p>
      {detail ? <p className="section-copy">{detail}</p> : null}
    </section>
  );
}
