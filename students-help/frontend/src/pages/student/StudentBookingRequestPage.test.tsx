import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App';
import { acceptBooking, getBooking, markBookingDone, rejectBooking, startBooking } from '../../features/booking/services/booking-api';
import type { BookingView } from '../../features/booking/types';
import { getPaymentTimeline } from '../../features/payment/services/payment-api';
import type { PaymentTimelineView } from '../../features/payment/types';
import { ApiError } from '../../services/api/client';

vi.mock('../../features/booking/services/booking-api', () => ({
  createBookingRequest: vi.fn(),
  getBooking: vi.fn(),
  acceptBooking: vi.fn(),
  rejectBooking: vi.fn(),
  startBooking: vi.fn(),
  markBookingDone: vi.fn(),
  confirmCompletion: vi.fn(),
}));

vi.mock('../../features/payment/services/payment-api', () => ({
  getPayment: vi.fn(),
  authorizePayment: vi.fn(),
  getPaymentTimeline: vi.fn(),
}));

vi.mock('../../features/auth/services/auth-api', () => ({
  getRegistrationConfig: vi.fn(),
  registerStudent: vi.fn(),
  registerHelpSeeker: vi.fn(),
  getHelpSeekerAccount: vi.fn(),
  verifyStudentEmail: vi.fn(),
  login: vi.fn(),
}));

vi.mock('../../features/skills/services/skills-api', () => ({
  listSkillCatalog: vi.fn(),
  listStudentSkills: vi.fn(),
  createStudentSkill: vi.fn(),
  updateStudentSkill: vi.fn(),
  deleteStudentSkill: vi.fn(),
}));

const mockedGet = vi.mocked(getBooking);
const mockedAccept = vi.mocked(acceptBooking);
const mockedReject = vi.mocked(rejectBooking);
const mockedStart = vi.mocked(startBooking);
const mockedDone = vi.mocked(markBookingDone);
const mockedTimeline = vi.mocked(getPaymentTimeline);

const pendingTimeline: PaymentTimelineView = {
  bookingId: 'booking_1',
  currency: 'EUR',
  paymentStatus: 'NOT_STARTED',
  headline: 'PAYMENT_PENDING',
  summary: 'The Help Seeker still needs to authorize payment before the booking can move forward.',
  estimatedEarnings: { amountMinor: 4500 },
  taskAmount: { amountMinor: 4500 },
  platformFee: { amountMinor: 450 },
  customerTotal: { amountMinor: 4950 },
  timeline: [
    { key: 'ACCEPTED', label: 'Booking accepted', status: 'COMPLETED', completedAt: '2026-09-10T08:05:00.000Z' },
    { key: 'HELD', label: 'Waiting for payment authorization', status: 'CURRENT', completedAt: null },
    { key: 'DONE', label: 'Task completed', status: 'UPCOMING', completedAt: null },
    { key: 'CONFIRMED', label: 'Customer confirms completion', status: 'UPCOMING', completedAt: null },
    { key: 'PAID', label: 'Payment released', status: 'UPCOMING', completedAt: null },
  ],
};

const reservedTimeline: PaymentTimelineView = {
  ...pendingTimeline,
  paymentStatus: 'AUTHORIZED',
  headline: 'PAYMENT_RESERVED',
  summary:
    'The customer payment has been authorized for this booking. Payment will be released after the Help Seeker confirms completion.',
  timeline: [
    { key: 'ACCEPTED', label: 'Booking accepted', status: 'COMPLETED', completedAt: '2026-09-10T08:05:00.000Z' },
    {
      key: 'HELD',
      label: 'Customer payment reserved',
      status: 'COMPLETED',
      completedAt: '2026-09-10T08:10:00.000Z',
    },
    { key: 'DONE', label: 'Complete the task', status: 'CURRENT', completedAt: null },
    { key: 'CONFIRMED', label: 'Customer confirms completion', status: 'UPCOMING', completedAt: null },
    { key: 'PAID', label: 'Payment released', status: 'UPCOMING', completedAt: null },
  ],
};

const inProgressTimeline: PaymentTimelineView = {
  ...reservedTimeline,
  timeline: [
    { key: 'ACCEPTED', label: 'Booking accepted', status: 'COMPLETED', completedAt: '2026-09-10T08:05:00.000Z' },
    {
      key: 'HELD',
      label: 'Customer payment reserved',
      status: 'COMPLETED',
      completedAt: '2026-09-10T08:10:00.000Z',
    },
    { key: 'DONE', label: 'Task in progress', status: 'CURRENT', completedAt: null },
    { key: 'CONFIRMED', label: 'Customer confirms completion', status: 'UPCOMING', completedAt: null },
    { key: 'PAID', label: 'Payment released', status: 'UPCOMING', completedAt: null },
  ],
};

const awaitingSignoffTimeline: PaymentTimelineView = {
  ...reservedTimeline,
  headline: 'AWAITING_CONFIRMATION',
  summary: 'Payment will be released after the Help Seeker confirms completion.',
  timeline: [
    { key: 'ACCEPTED', label: 'Booking accepted', status: 'COMPLETED', completedAt: '2026-09-10T08:05:00.000Z' },
    {
      key: 'HELD',
      label: 'Customer payment reserved',
      status: 'COMPLETED',
      completedAt: '2026-09-10T08:10:00.000Z',
    },
    { key: 'DONE', label: 'Task completed', status: 'COMPLETED', completedAt: null },
    { key: 'CONFIRMED', label: 'Waiting for customer confirmation', status: 'CURRENT', completedAt: null },
    { key: 'PAID', label: 'Payment released', status: 'UPCOMING', completedAt: null },
  ],
};

const pending: BookingView = {
  id: 'booking_1',
  status: 'PENDING',
  createdAt: '2026-09-10T08:00:00.000Z',
  updatedAt: '2026-09-10T08:00:00.000Z',
  rejectionReason: null,
  rejectedAt: null,
  student: { id: 'student_1', verificationStatus: 'VERIFIED' },
  task: {
    id: 'task_1',
    title: 'Furniture Assembly',
    description: 'Assemble one wardrobe and two bedside tables from flat-pack packages.',
    skills: [{ id: 'skill_furniture', name: 'Furniture Assembly', category: 'Household' }],
    location: { addressLine: 'Marienplatz 1, 80331 Munich' },
    timezone: 'Europe/Berlin',
    preferredDate: '2028-09-20',
    preferredTime: '10:00',
    preferredStartAt: '2028-09-20T08:00:00.000Z',
    estimatedDurationMinutes: 180,
    specialInstructions: 'Please bring basic assembly tools.',
    status: 'PUBLISHED',
  },
};

const accepted: BookingView = {
  ...pending,
  status: 'ACCEPTED',
  updatedAt: '2026-09-10T08:05:00.000Z',
};

const confirmed: BookingView = {
  ...accepted,
  status: 'CONFIRMED',
  updatedAt: '2026-09-10T08:10:00.000Z',
};

const inProgress: BookingView = {
  ...confirmed,
  status: 'IN_PROGRESS',
  startedAt: '2026-09-11T08:03:00.000Z',
  updatedAt: '2026-09-11T08:03:00.000Z',
};

const awaitingSignoff: BookingView = {
  ...inProgress,
  status: 'AWAITING_SIGNOFF',
  submittedForSignoffAt: '2026-09-11T11:42:00.000Z',
  updatedAt: '2026-09-11T11:42:00.000Z',
};

const rejected: BookingView = {
  ...pending,
  status: 'REJECTED',
  rejectionReason: 'The schedule no longer works for me.',
  rejectedAt: '2026-09-10T08:06:00.000Z',
  updatedAt: '2026-09-10T08:06:00.000Z',
};

function renderRequest() {
  return render(
    <MemoryRouter initialEntries={['/student/requests/booking_1']}>
      <App />
    </MemoryRouter>,
  );
}

describe('Student booking request', () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedAccept.mockReset();
    mockedReject.mockReset();
    mockedStart.mockReset();
    mockedDone.mockReset();
    mockedTimeline.mockResolvedValue({ paymentTimeline: pendingTimeline });
  });

  it('shows task details, Accept, and Reject for a PENDING request', async () => {
    mockedGet.mockResolvedValue({ booking: pending });
    renderRequest();

    expect(await screen.findByText('PENDING')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Booking Request' })).toBeInTheDocument();
    expect(screen.getByText('Assemble one wardrobe and two bedside tables from flat-pack packages.')).toBeInTheDocument();
    expect(screen.getByText('Wednesday, 20 September 2028')).toBeInTheDocument();
    expect(screen.getByText(/10:00–13:00/)).toBeInTheDocument();
    expect(screen.getByText('Marienplatz 1, 80331 Munich')).toBeInTheDocument();
    expect(screen.getByText('Please bring basic assembly tools.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept Booking' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Reject Booking' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Start Task' })).not.toBeInTheDocument();
    expect(screen.getByText('Request sent')).toBeInTheDocument();
    expect(screen.getByText('Waiting for Student')).toBeInTheDocument();
    expect(screen.getByText('Payment authorization')).toBeInTheDocument();
    expect(screen.getByText('Booking confirmed')).toBeInTheDocument();
    expect(screen.queryByText('CONFIRMED')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Payment' })).not.toBeInTheDocument();
  });

  it('does not show Accept or Reject for a non-PENDING booking', async () => {
    mockedGet.mockResolvedValue({ booking: accepted });
    renderRequest();

    expect(await screen.findByRole('heading', { name: 'Booking accepted' })).toBeInTheDocument();
    expect(screen.getByText('ACCEPTED')).toBeInTheDocument();
    expect(screen.getByText('Payment authorization pending')).toBeInTheDocument();
    expect(screen.getByText(/Payment authorization is not available yet/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept Booking' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reject Booking' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start Task' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark as Done' })).not.toBeInTheDocument();
    expect(screen.queryByText(/CONFIRMED/)).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Payment' })).toBeInTheDocument();
    expect(screen.getByText('Payment pending')).toBeInTheDocument();
    expect(screen.getByText('Waiting for payment authorization')).toBeInTheDocument();
    expect(screen.getByText('Expected earnings')).toBeInTheDocument();
  });

  it('opens confirmation, disables submit while in flight, and renders ACCEPTED', async () => {
    const user = userEvent.setup();
    mockedGet.mockResolvedValue({ booking: pending });
    let resolveAccept: ((value: { booking: BookingView; message: string }) => void) | undefined;
    mockedAccept.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAccept = resolve;
        }),
    );
    renderRequest();
    await user.click(await screen.findByRole('button', { name: 'Accept Booking' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Accept this booking?' })).toBeInTheDocument();
    expect(within(dialog).getByText(/Furniture Assembly/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Accept Booking' }));
    expect(within(dialog).getByRole('button', { name: 'Accepting…' })).toBeDisabled();
    expect(mockedAccept).toHaveBeenCalledTimes(1);
    expect(mockedAccept).toHaveBeenCalledWith('booking_1');

    resolveAccept?.({ booking: accepted, message: 'Booking accepted.' });
    expect(await screen.findByRole('heading', { name: 'Booking accepted' })).toBeInTheDocument();
    expect(screen.getByText('ACCEPTED')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText(/CONFIRMED/)).not.toBeInTheDocument();
  });

  it('renders a booking conflict message', async () => {
    const user = userEvent.setup();
    mockedGet.mockResolvedValue({ booking: pending });
    mockedAccept.mockRejectedValue(
      new ApiError(409, {
        code: 'BOOKING_CONFLICT',
        message: 'You already have another booking during this time.',
        details: [],
      }),
    );
    renderRequest();
    await user.click(await screen.findByRole('button', { name: 'Accept Booking' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Accept Booking' }));

    expect(await screen.findByText('You already have another booking during this time.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept Booking' })).toBeEnabled();
  });

  it('renders an availability error', async () => {
    const user = userEvent.setup();
    mockedGet.mockResolvedValue({ booking: pending });
    mockedAccept.mockRejectedValue(
      new ApiError(409, {
        code: 'STUDENT_NOT_AVAILABLE',
        message: 'This booking no longer fits your availability.',
        details: [],
      }),
    );
    renderRequest();
    await user.click(await screen.findByRole('button', { name: 'Accept Booking' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Accept Booking' }));

    expect(await screen.findByText('This booking no longer fits your availability.')).toBeInTheDocument();
  });

  it('refreshes stale booking data after a failed accept', async () => {
    const user = userEvent.setup();
    mockedGet.mockResolvedValueOnce({ booking: pending }).mockResolvedValueOnce({ booking: accepted });
    mockedAccept.mockRejectedValue(
      new ApiError(409, {
        code: 'BOOKING_NOT_PENDING',
        message: 'This booking request is no longer available.',
        details: [],
      }),
    );
    renderRequest();
    await user.click(await screen.findByRole('button', { name: 'Accept Booking' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Accept Booking' }));

    expect(await screen.findByText('This booking request is no longer available for acceptance.')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Booking accepted' })).toBeInTheDocument();
    expect(screen.getByText('ACCEPTED')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept Booking' })).not.toBeInTheDocument();
  });

  it('supports keyboard cancel in the confirmation dialog', async () => {
    const user = userEvent.setup();
    mockedGet.mockResolvedValue({ booking: pending });
    renderRequest();
    await user.click(await screen.findByRole('button', { name: 'Accept Booking' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockedAccept).not.toHaveBeenCalled();
  });

  it('requires a rejection reason before calling the API', async () => {
    const user = userEvent.setup();
    mockedGet.mockResolvedValue({ booking: pending });
    renderRequest();
    await user.click(await screen.findByRole('button', { name: 'Reject Booking' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Reject this booking?' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Reject Booking' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('A short reason is required.');
    expect(mockedReject).not.toHaveBeenCalled();
  });

  it('rejects a PENDING booking and renders REJECTED', async () => {
    const user = userEvent.setup();
    mockedGet.mockResolvedValue({ booking: pending });
    let resolveReject: ((value: { booking: BookingView; message: string }) => void) | undefined;
    mockedReject.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveReject = resolve;
        }),
    );
    renderRequest();
    await user.click(await screen.findByRole('button', { name: 'Reject Booking' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Reason'), 'The schedule no longer works for me.');
    await user.click(within(dialog).getByRole('button', { name: 'Reject Booking' }));
    expect(within(dialog).getByRole('button', { name: 'Rejecting…' })).toBeDisabled();
    expect(mockedReject).toHaveBeenCalledTimes(1);
    expect(mockedReject).toHaveBeenCalledWith('booking_1', 'The schedule no longer works for me.');

    resolveReject?.({ booking: rejected, message: 'Booking rejected.' });
    expect(await screen.findByRole('heading', { name: 'Booking declined' })).toBeInTheDocument();
    expect(screen.getByText('REJECTED')).toBeInTheDocument();
    expect(screen.getByText('The schedule no longer works for me.')).toBeInTheDocument();
    expect(screen.getByText(/The Help Seeker can continue looking for another Student/)).toBeInTheDocument();
    expect(screen.getByText('Student declined')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reject Booking' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept Booking' })).not.toBeInTheDocument();
    expect(screen.queryByText('Payment authorization')).not.toBeInTheDocument();
    expect(screen.queryByText('Booking confirmed')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Payment' })).not.toBeInTheDocument();
  });

  it('refreshes stale booking data after a failed reject', async () => {
    const user = userEvent.setup();
    mockedGet.mockResolvedValueOnce({ booking: pending }).mockResolvedValueOnce({ booking: accepted });
    mockedReject.mockRejectedValue(
      new ApiError(409, {
        code: 'BOOKING_NOT_PENDING',
        message: 'This booking request is no longer available.',
        details: [],
      }),
    );
    renderRequest();
    await user.click(await screen.findByRole('button', { name: 'Reject Booking' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Reason'), 'The schedule no longer works for me.');
    await user.click(within(dialog).getByRole('button', { name: 'Reject Booking' }));

    expect(await screen.findByText('This booking request is no longer available.')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Booking accepted' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reject Booking' })).not.toBeInTheDocument();
  });

  it('supports keyboard cancel in the reject dialog', async () => {
    const user = userEvent.setup();
    mockedGet.mockResolvedValue({ booking: pending });
    renderRequest();
    await user.click(await screen.findByRole('button', { name: 'Reject Booking' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Reason')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockedReject).not.toHaveBeenCalled();
  });

  it('shows Start Task for a CONFIRMED job and hides it otherwise', async () => {
    mockedGet.mockResolvedValue({ booking: confirmed });
    mockedTimeline.mockResolvedValue({ paymentTimeline: reservedTimeline });
    renderRequest();

    expect(await screen.findByRole('heading', { name: 'Booking confirmed' })).toBeInTheDocument();
    expect(screen.getByText('Ready to start')).toBeInTheDocument();
    expect(screen.getByText('CONFIRMED')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Task' })).toBeEnabled();
    expect(await screen.findByText('Customer payment reserved')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept Booking' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark as Done' })).not.toBeInTheDocument();
  });

  it('opens start confirmation, disables submit while in flight, and renders IN_PROGRESS', async () => {
    const user = userEvent.setup();
    mockedGet.mockResolvedValue({ booking: confirmed });
    mockedTimeline
      .mockResolvedValueOnce({ paymentTimeline: reservedTimeline })
      .mockResolvedValue({ paymentTimeline: inProgressTimeline });
    let resolveStart: ((value: { booking: BookingView; message: string }) => void) | undefined;
    mockedStart.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveStart = resolve;
        }),
    );
    renderRequest();
    await user.click(await screen.findByRole('button', { name: 'Start Task' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Start this task?' })).toBeInTheDocument();
    expect(within(dialog).getByText(/Furniture Assembly/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Start Task' }));
    expect(within(dialog).getByRole('button', { name: 'Starting…' })).toBeDisabled();
    expect(mockedStart).toHaveBeenCalledTimes(1);
    expect(mockedStart).toHaveBeenCalledWith('booking_1');

    resolveStart?.({ booking: inProgress, message: 'Task started.' });
    expect(await screen.findByRole('heading', { name: 'Task in progress' })).toBeInTheDocument();
    expect(screen.getByText('IN_PROGRESS')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('10:03 AM')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start Task' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark as Done' })).toBeEnabled();
    expect(await screen.findByText('Customer payment reserved')).toBeInTheDocument();
    expect(screen.getAllByText('Task in progress').length).toBeGreaterThan(0);
  });

  it('renders a payment-not-authorized error', async () => {
    const user = userEvent.setup();
    mockedGet.mockResolvedValue({ booking: confirmed });
    mockedTimeline.mockResolvedValue({ paymentTimeline: reservedTimeline });
    mockedStart.mockRejectedValue(
      new ApiError(409, {
        code: 'PAYMENT_NOT_AUTHORIZED',
        message: 'This task cannot be started until payment authorization is complete.',
        details: [],
      }),
    );
    renderRequest();
    await user.click(await screen.findByRole('button', { name: 'Start Task' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Start Task' }));

    expect(
      await screen.findByText('This task cannot be started until payment authorization is complete.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Task' })).toBeEnabled();
  });

  it('refreshes stale booking data after a failed start', async () => {
    const user = userEvent.setup();
    mockedGet
      .mockResolvedValueOnce({ booking: confirmed })
      .mockResolvedValueOnce({ booking: inProgress });
    mockedTimeline.mockResolvedValue({ paymentTimeline: inProgressTimeline });
    mockedStart.mockRejectedValue(
      new ApiError(409, {
        code: 'TASK_ALREADY_STARTED',
        message: 'This task has already been started.',
        details: [],
      }),
    );
    renderRequest();
    await user.click(await screen.findByRole('button', { name: 'Start Task' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Start Task' }));

    expect(await screen.findByText('This task has already been started.')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Task in progress' })).toBeInTheDocument();
    expect(screen.getByText('IN_PROGRESS')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start Task' })).not.toBeInTheDocument();
  });

  it('renders unrelated start errors safely', async () => {
    const user = userEvent.setup();
    mockedGet.mockResolvedValue({ booking: confirmed });
    mockedTimeline.mockResolvedValue({ paymentTimeline: reservedTimeline });
    mockedStart.mockRejectedValue(new Error('boom'));
    renderRequest();
    await user.click(await screen.findByRole('button', { name: 'Start Task' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Start Task' }));

    expect(await screen.findByText('The request could not be completed. Try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Task' })).toBeEnabled();
  });

  it('supports keyboard cancel in the start confirmation dialog', async () => {
    const user = userEvent.setup();
    mockedGet.mockResolvedValue({ booking: confirmed });
    mockedTimeline.mockResolvedValue({ paymentTimeline: reservedTimeline });
    renderRequest();
    await user.click(await screen.findByRole('button', { name: 'Start Task' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockedStart).not.toHaveBeenCalled();
  });

  it('shows Mark as Done for an IN_PROGRESS job', async () => {
    mockedGet.mockResolvedValue({ booking: inProgress });
    mockedTimeline.mockResolvedValue({ paymentTimeline: inProgressTimeline });
    renderRequest();

    expect(await screen.findByRole('heading', { name: 'Task in progress' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark as Done' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Start Task' })).not.toBeInTheDocument();
  });

  it('opens done confirmation, disables submit while in flight, and renders AWAITING_SIGNOFF', async () => {
    const user = userEvent.setup();
    mockedGet.mockResolvedValue({ booking: inProgress });
    mockedTimeline
      .mockResolvedValueOnce({ paymentTimeline: inProgressTimeline })
      .mockResolvedValue({ paymentTimeline: awaitingSignoffTimeline });
    let resolveDone: ((value: { booking: BookingView; message: string }) => void) | undefined;
    mockedDone.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDone = resolve;
        }),
    );
    renderRequest();
    await user.click(await screen.findByRole('button', { name: 'Mark as Done' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Mark this task as done?' })).toBeInTheDocument();
    expect(
      within(dialog).getByText(/The payment will not be released until the Help Seeker confirms completion/),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Mark as Done' }));
    expect(within(dialog).getByRole('button', { name: 'Submitting…' })).toBeDisabled();
    expect(mockedDone).toHaveBeenCalledTimes(1);
    expect(mockedDone).toHaveBeenCalledWith('booking_1');

    resolveDone?.({ booking: awaitingSignoff, message: 'Task submitted for confirmation.' });
    expect(await screen.findByRole('heading', { name: 'Waiting for confirmation' })).toBeInTheDocument();
    expect(screen.getByText('AWAITING_SIGNOFF')).toBeInTheDocument();
    expect(screen.getByText('Waiting for Help Seeker confirmation')).toBeInTheDocument();
    expect(screen.getByText('1:42 PM')).toBeInTheDocument();
    expect(screen.queryByText('COMPLETED')).not.toBeInTheDocument();
    expect(screen.queryByText('PAID')).not.toBeInTheDocument();
    expect(screen.queryByText('PAYMENT RELEASED')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark as Done' })).not.toBeInTheDocument();
    expect(await screen.findByText('Waiting for customer confirmation')).toBeInTheDocument();
    expect(screen.getByText('Payment released')).toBeInTheDocument();
  });

  it('renders a not-in-progress error', async () => {
    const user = userEvent.setup();
    mockedGet.mockResolvedValue({ booking: inProgress });
    mockedTimeline.mockResolvedValue({ paymentTimeline: inProgressTimeline });
    mockedDone.mockRejectedValue(
      new ApiError(409, {
        code: 'TASK_NOT_IN_PROGRESS',
        message: 'This task is not currently in progress.',
        details: [],
      }),
    );
    renderRequest();
    await user.click(await screen.findByRole('button', { name: 'Mark as Done' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Mark as Done' }));

    expect(await screen.findByText('This task is not currently in progress.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark as Done' })).toBeEnabled();
  });

  it('refreshes stale booking data after a failed done submission', async () => {
    const user = userEvent.setup();
    mockedGet
      .mockResolvedValueOnce({ booking: inProgress })
      .mockResolvedValueOnce({ booking: awaitingSignoff });
    mockedTimeline.mockResolvedValue({ paymentTimeline: awaitingSignoffTimeline });
    mockedDone.mockRejectedValue(
      new ApiError(409, {
        code: 'TASK_ALREADY_SUBMITTED',
        message: 'This task has already been submitted for confirmation.',
        details: [],
      }),
    );
    renderRequest();
    await user.click(await screen.findByRole('button', { name: 'Mark as Done' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Mark as Done' }));

    expect(await screen.findByText('This task has already been submitted for confirmation.')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Waiting for confirmation' })).toBeInTheDocument();
    expect(screen.getByText('AWAITING_SIGNOFF')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark as Done' })).not.toBeInTheDocument();
  });

  it('supports keyboard cancel in the done confirmation dialog', async () => {
    const user = userEvent.setup();
    mockedGet.mockResolvedValue({ booking: inProgress });
    mockedTimeline.mockResolvedValue({ paymentTimeline: inProgressTimeline });
    renderRequest();
    await user.click(await screen.findByRole('button', { name: 'Mark as Done' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockedDone).not.toHaveBeenCalled();
  });

  it('renders COMPLETED without a Mark as Done action and shows the payment timeline', async () => {
    mockedGet.mockResolvedValue({
      booking: {
        ...awaitingSignoff,
        status: 'COMPLETED',
        completedAt: '2026-09-11T12:10:00.000Z',
        updatedAt: '2026-09-11T12:10:00.000Z',
      },
    });
    mockedTimeline.mockResolvedValue({
      paymentTimeline: {
        ...awaitingSignoffTimeline,
        paymentStatus: 'CAPTURED',
        headline: 'PAYMENT_RELEASED',
        summary: 'Payment released.',
        timeline: [
          { key: 'ACCEPTED', label: 'Booking accepted', status: 'COMPLETED', completedAt: '2026-09-10T08:05:00.000Z' },
          {
            key: 'HELD',
            label: 'Customer payment reserved',
            status: 'COMPLETED',
            completedAt: '2026-09-10T08:10:00.000Z',
          },
          { key: 'DONE', label: 'Task completed', status: 'COMPLETED', completedAt: null },
          { key: 'CONFIRMED', label: 'Customer confirms completion', status: 'COMPLETED', completedAt: null },
          { key: 'PAID', label: 'Payment released', status: 'COMPLETED', completedAt: null },
        ],
      },
    });
    renderRequest();

    expect(await screen.findByRole('heading', { name: 'Task completed' })).toBeInTheDocument();
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    expect(screen.getByText('Help Seeker confirmed at')).toBeInTheDocument();
    expect(screen.getByText('2:10 PM')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark as Done' })).not.toBeInTheDocument();
    expect(await screen.findAllByText('Payment released')).toHaveLength(2);
  });
});
