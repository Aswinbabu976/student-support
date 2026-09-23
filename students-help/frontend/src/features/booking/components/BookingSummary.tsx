import type { ReactNode } from 'react';
import { BookingStudentSummary } from './BookingStudentSummary';
import { BookingTaskSummary } from './BookingTaskSummary';
import type { TaskView } from '../../tasks/types';

type BookingSummaryProps = {
  task: TaskView;
  studentHeading: string;
  studentDetail?: string;
  verificationStatus?: 'VERIFIED' | 'UNVERIFIED';
  beforeActions?: ReactNode;
  actions: ReactNode;
};

export function BookingSummary({
  task,
  studentHeading,
  studentDetail,
  verificationStatus,
  beforeActions,
  actions,
}: BookingSummaryProps) {
  return (
    <div className="booking-summary">
      <BookingStudentSummary
        verificationStatus={verificationStatus}
        heading={studentHeading}
        detail={studentDetail}
      />
      <BookingTaskSummary task={task} />
      {beforeActions}
      <div className="form-actions">{actions}</div>
    </div>
  );
}
