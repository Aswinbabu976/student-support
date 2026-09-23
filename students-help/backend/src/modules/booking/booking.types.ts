import { BookingStatus, type VerificationStatus } from '@prisma/client';
import type { BookingProgress, BookingStatusEvent } from './booking.progress.js';
import type { TaskSkillView } from '../tasks/tasks.types.js';

export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.ACCEPTED,
  BookingStatus.CONFIRMED,
  BookingStatus.IN_PROGRESS,
  BookingStatus.AWAITING_SIGNOFF,
];

export const OVERLAP_BLOCKING_STATUSES: BookingStatus[] = [
  BookingStatus.ACCEPTED,
  BookingStatus.CONFIRMED,
  BookingStatus.IN_PROGRESS,
  BookingStatus.AWAITING_SIGNOFF,
];

export type BookingStudentView = {
  id: string;
  verificationStatus: VerificationStatus;
};

export type BookingTaskView = {
  id: string;
  title: string;
  description: string;
  skills: TaskSkillView[];
  location: { addressLine: string };
  timezone: string;
  preferredDate: string;
  preferredTime: string;
  preferredStartAt: string;
  estimatedDurationMinutes: number;
  specialInstructions: string | null;
  status: string;
};

export type BookingView = {
  id: string;
  status: BookingStatus;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  submittedForSignoffAt: string | null;
  completedAt: string | null;
  rejectionReason: string | null;
  rejectedAt: string | null;
  statusHistory: BookingStatusEvent[];
  progress: BookingProgress;
  task: BookingTaskView;
  student: BookingStudentView;
};

export type CreateBookingResponse = {
  booking: BookingView;
  message: string;
};

export type BookingResponse = {
  booking: BookingView;
};
