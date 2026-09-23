import { BookingStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { buildBookingProgress } from './booking.progress.js';

const createdAt = '2026-09-10T08:42:00.000Z';
const acceptedAt = '2026-09-10T09:10:00.000Z';
const rejectedAt = '2026-09-10T09:15:00.000Z';

describe('buildBookingProgress', () => {
  it('maps PENDING without completing later payment steps', () => {
    const progress = buildBookingProgress({
      status: BookingStatus.PENDING,
      createdAt,
      updatedAt: createdAt,
      rejectedAt: null,
      statusHistory: [{ status: BookingStatus.PENDING, createdAt }],
      audience: 'HELP_SEEKER',
    });

    expect(progress.summary).toBe(
      'Your booking is not confirmed yet. The Student needs to accept your request first.',
    );
    expect(progress.steps).toEqual([
      { id: 'REQUEST', label: 'Request sent', state: 'complete', occurredAt: createdAt },
      { id: 'ACCEPT', label: 'Waiting for Student', state: 'current', occurredAt: null },
      { id: 'HOLD', label: 'Payment authorization', state: 'upcoming', occurredAt: null },
      { id: 'CONFIRMED', label: 'Booking confirmed', state: 'upcoming', occurredAt: null },
    ]);
  });

  it('keeps HOLD current after ACCEPTED because payment hold is not implemented', () => {
    const progress = buildBookingProgress({
      status: BookingStatus.ACCEPTED,
      createdAt,
      updatedAt: acceptedAt,
      rejectedAt: null,
      statusHistory: [
        { status: BookingStatus.PENDING, createdAt },
        { status: BookingStatus.ACCEPTED, createdAt: acceptedAt },
      ],
      audience: 'HELP_SEEKER',
    });

    expect(progress.steps.map((step) => [step.id, step.state, step.label])).toEqual([
      ['REQUEST', 'complete', 'Request sent'],
      ['ACCEPT', 'complete', 'Student accepted'],
      ['HOLD', 'current', 'Payment authorization pending'],
      ['CONFIRMED', 'upcoming', 'Booking confirmed'],
    ]);
    expect(progress.steps.find((step) => step.id === 'HOLD')?.occurredAt).toBeNull();
  });

  it('stops the path at declined for REJECTED', () => {
    const progress = buildBookingProgress({
      status: BookingStatus.REJECTED,
      createdAt,
      updatedAt: rejectedAt,
      rejectedAt,
      statusHistory: [
        { status: BookingStatus.PENDING, createdAt },
        { status: BookingStatus.REJECTED, createdAt: rejectedAt },
      ],
      audience: 'HELP_SEEKER',
    });

    expect(progress.summary).toBe('The Student declined this booking request.');
    expect(progress.steps).toEqual([
      { id: 'REQUEST', label: 'Request sent', state: 'complete', occurredAt: createdAt },
      { id: 'DECLINED', label: 'Student declined', state: 'declined', occurredAt: rejectedAt },
    ]);
  });

  it('does not mark payment held complete for CONFIRMED', () => {
    const confirmedAt = '2026-09-10T10:00:00.000Z';
    const progress = buildBookingProgress({
      status: BookingStatus.CONFIRMED,
      createdAt,
      updatedAt: confirmedAt,
      rejectedAt: null,
      statusHistory: [
        { status: BookingStatus.PENDING, createdAt },
        { status: BookingStatus.ACCEPTED, createdAt: acceptedAt },
        { status: BookingStatus.CONFIRMED, createdAt: confirmedAt },
      ],
      audience: 'HELP_SEEKER',
    });

    expect(progress.steps.find((step) => step.id === 'HOLD')).toMatchObject({
      state: 'upcoming',
      occurredAt: null,
    });
    expect(progress.steps.find((step) => step.id === 'CONFIRMED')).toMatchObject({
      state: 'complete',
      occurredAt: confirmedAt,
    });
  });

  it('summarizes IN_PROGRESS without completing payment hold from booking status', () => {
    const startedAt = '2026-09-11T08:03:00.000Z';
    const progress = buildBookingProgress({
      status: BookingStatus.IN_PROGRESS,
      createdAt,
      updatedAt: startedAt,
      rejectedAt: null,
      statusHistory: [
        { status: BookingStatus.PENDING, createdAt },
        { status: BookingStatus.ACCEPTED, createdAt: acceptedAt },
        { status: BookingStatus.CONFIRMED, createdAt: '2026-09-10T10:00:00.000Z' },
        { status: BookingStatus.IN_PROGRESS, createdAt: startedAt },
      ],
      audience: 'STUDENT',
    });

    expect(progress.summary).toBe('Task in progress');
    expect(progress.steps.find((step) => step.id === 'HOLD')).toMatchObject({
      state: 'upcoming',
      occurredAt: null,
    });
    expect(progress.steps.find((step) => step.id === 'CONFIRMED')).toMatchObject({
      state: 'complete',
    });
  });

  it('summarizes AWAITING_SIGNOFF without treating the booking as completed', () => {
    const submittedAt = '2026-09-11T11:42:00.000Z';
    const progress = buildBookingProgress({
      status: BookingStatus.AWAITING_SIGNOFF,
      createdAt,
      updatedAt: submittedAt,
      rejectedAt: null,
      statusHistory: [
        { status: BookingStatus.PENDING, createdAt },
        { status: BookingStatus.ACCEPTED, createdAt: acceptedAt },
        { status: BookingStatus.CONFIRMED, createdAt: '2026-09-10T10:00:00.000Z' },
        { status: BookingStatus.IN_PROGRESS, createdAt: '2026-09-11T08:03:00.000Z' },
        { status: BookingStatus.AWAITING_SIGNOFF, createdAt: submittedAt },
      ],
      audience: 'HELP_SEEKER',
    });

    expect(progress.summary).toBe('Student has marked the task as done. Confirmation is required.');
    expect(progress.steps.find((step) => step.id === 'CONFIRMED')?.state).toBe('complete');
  });

  it('summarizes COMPLETED without treating payment as already released', () => {
    const completedAt = '2026-09-11T12:10:00.000Z';
    const progress = buildBookingProgress({
      status: BookingStatus.COMPLETED,
      createdAt,
      updatedAt: completedAt,
      rejectedAt: null,
      statusHistory: [
        { status: BookingStatus.PENDING, createdAt },
        { status: BookingStatus.ACCEPTED, createdAt: acceptedAt },
        { status: BookingStatus.CONFIRMED, createdAt: '2026-09-10T10:00:00.000Z' },
        { status: BookingStatus.IN_PROGRESS, createdAt: '2026-09-11T08:03:00.000Z' },
        { status: BookingStatus.AWAITING_SIGNOFF, createdAt: '2026-09-11T11:42:00.000Z' },
        { status: BookingStatus.COMPLETED, createdAt: completedAt },
      ],
      audience: 'HELP_SEEKER',
    });

    expect(progress.summary).toBe('This booking is completed.');
    expect(progress.steps.find((step) => step.id === 'CONFIRMED')?.state).toBe('complete');
  });
});
