import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App';
import { getHelpSeekerAccount } from '../../features/auth/services/auth-api';
import { confirmCompletion, createBookingRequest, getBooking } from '../../features/booking/services/booking-api';
import type { BookingView } from '../../features/booking/types';
import { getPayment } from '../../features/payment/services/payment-api';
import { getCostEstimate } from '../../features/pricing/services/pricing-api';
import type { CostEstimate } from '../../features/pricing/types';
import { listRecommendations } from '../../features/matching/services/matching-api';
import type { Recommendation } from '../../features/matching/types';
import { getTask } from '../../features/tasks/services/tasks-api';
import type { TaskView } from '../../features/tasks/types';
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
}));

vi.mock('../../features/pricing/services/pricing-api', () => ({
  getCostEstimate: vi.fn(),
}));

vi.mock('../../features/matching/services/matching-api', () => ({
  listRecommendations: vi.fn(),
}));

vi.mock('../../features/tasks/services/tasks-api', () => ({
  createTask: vi.fn(),
  getTask: vi.fn(),
}));

vi.mock('../../features/skills/services/skills-api', () => ({
  listSkillCatalog: vi.fn(),
  listStudentSkills: vi.fn(),
  createStudentSkill: vi.fn(),
  updateStudentSkill: vi.fn(),
  deleteStudentSkill: vi.fn(),
}));

vi.mock('../../features/auth/services/auth-api', () => ({
  getRegistrationConfig: vi.fn(),
  registerStudent: vi.fn(),
  registerHelpSeeker: vi.fn(),
  getHelpSeekerAccount: vi.fn(),
  verifyStudentEmail: vi.fn(),
  login: vi.fn(),
}));

const mockedRecs = vi.mocked(listRecommendations);
const mockedTask = vi.mocked(getTask);
const mockedAccount = vi.mocked(getHelpSeekerAccount);
const mockedCreate = vi.mocked(createBookingRequest);
const mockedGetBooking = vi.mocked(getBooking);
const mockedCost = vi.mocked(getCostEstimate);
const mockedGetPayment = vi.mocked(getPayment);
const mockedConfirm = vi.mocked(confirmCompletion);

const estimate: CostEstimate = {
  currency: 'EUR',
  estimatedDurationMinutes: 180,
  estimatedHours: 3,
  baseHourlyRate: { amountMinor: 1500 },
  subtotal: { amountMinor: 4500 },
  platformFee: { amountMinor: 450 },
  total: { amountMinor: 4950 },
};

const task: TaskView = {
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
  specialInstructions: null,
  status: 'PUBLISHED',
};

const recommendation: Recommendation = {
  student: { id: 'student_1', verificationStatus: 'VERIFIED' },
  matchedSkills: [
    { skillId: 'skill_furniture', name: 'Furniture Assembly', experienceLevel: 'ADVANCED' },
  ],
  availability: { isAvailable: true },
  proximity: { relation: 'SAME_CITY', distanceKm: null },
  rating: null,
  completedJobsCount: 0,
  score: 82.5,
  matchFactors: {
    skill: {
      matched: true,
      matchedCount: 1,
      requiredCount: 1,
      matchedSkills: [
        { skillId: 'skill_furniture', name: 'Furniture Assembly', experienceLevel: 'ADVANCED' },
      ],
    },
    availability: {
      matched: true,
      requestedStart: '2028-09-20T08:00:00.000Z',
      requestedEnd: '2028-09-20T11:00:00.000Z',
    },
    proximity: { relation: 'SAME_CITY', distanceKm: null },
    experience: { level: 'ADVANCED', skillName: 'Furniture Assembly' },
    rating: { average: null, count: null },
    completedJobs: 0,
  },
  reasons: [{ type: 'SKILL', label: 'Matches your Furniture Assembly requirement' }],
};

const booking: BookingView = {
  id: 'booking_1',
  status: 'PENDING',
  createdAt: '2026-09-10T08:00:00.000Z',
  updatedAt: '2026-09-10T08:00:00.000Z',
  rejectionReason: null,
  rejectedAt: null,
  student: { id: 'student_1', verificationStatus: 'VERIFIED' },
  task: {
    id: task.id,
    title: task.title,
    description: task.description,
    skills: task.skills,
    location: task.location,
    timezone: task.timezone,
    preferredDate: task.preferredDate,
    preferredTime: task.preferredTime,
    preferredStartAt: task.preferredStartAt,
    estimatedDurationMinutes: task.estimatedDurationMinutes,
    specialInstructions: task.specialInstructions,
    status: task.status,
  },
};

function renderCreatePage() {
  return render(
    <MemoryRouter initialEntries={['/help-seeker/tasks/task_1/book/student_1']}>
      <App />
    </MemoryRouter>,
  );
}

describe('Booking request flow', () => {
  beforeEach(() => {
    mockedAccount.mockResolvedValue({
      user: { id: 'user_1', email: 'alex@example.com', role: 'HELP_SEEKER' },
      profile: {
        fullName: 'Alex Example',
        phone: '+46701234567',
        preferredPaymentMethod: 'CARD',
      },
      address: { addressLine: 'Marienplatz 1, 80331 Munich', isDefault: true },
    });
    mockedTask.mockResolvedValue({ task });
    mockedRecs.mockResolvedValue({ taskId: 'task_1', recommendations: [recommendation] });
    mockedCreate.mockReset();
    mockedGetBooking.mockReset();
    mockedConfirm.mockReset();
    mockedCost.mockResolvedValue({ estimate });
    mockedGetPayment.mockResolvedValue({ payment: null });
  });

  it('renders the booking summary for the selected Student and task', async () => {
    renderCreatePage();

    expect(await screen.findByRole('heading', { name: 'Booking Request' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Student' })).toBeInTheDocument();
    expect(screen.getByText('Verified student')).toBeInTheDocument();
    expect(screen.getByText('Advanced')).toBeInTheDocument();
    expect(screen.getByText('Wednesday, 20 September 2028')).toBeInTheDocument();
    expect(screen.getByText('10:00 (Europe/Berlin)')).toBeInTheDocument();
    expect(screen.getAllByText('3 hours').length).toBeGreaterThan(0);
    expect(screen.getByText('Marienplatz 1, 80331 Munich')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Estimated Cost' })).toBeInTheDocument();
    expect((await screen.findAllByText('€49.50')).length).toBeGreaterThan(0);
    expect(screen.getByText('€15.00')).toBeInTheDocument();
    expect(screen.getByText('€45.00')).toBeInTheDocument();
    expect(screen.getByText('€4.50')).toBeInTheDocument();
    expect(
      screen.getByText('This is an estimate based on the task duration and current platform pricing.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send Booking Request' })).toBeEnabled();
  });

  it('prevents a second submit while the request is in flight', async () => {
    const user = userEvent.setup();
    let resolveCreate: ((value: { booking: BookingView; message: string }) => void) | undefined;
    mockedCreate.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );
    mockedGetBooking.mockResolvedValue({ booking });
    renderCreatePage();
    expect(await screen.findByRole('button', { name: 'Send Booking Request' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Send Booking Request' }));
    expect(screen.getByRole('button', { name: 'Sending request…' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Sending request…' }));
    expect(mockedCreate).toHaveBeenCalledTimes(1);
    expect(mockedCreate).toHaveBeenCalledWith('task_1', 'student_1');

    resolveCreate?.({ booking, message: 'Booking request sent.' });
    expect(await screen.findByRole('heading', { name: 'Booking request sent' })).toBeInTheDocument();
  });

  it('renders a duplicate request error and keeps the summary', async () => {
    const user = userEvent.setup();
    mockedCreate.mockRejectedValue(
      new ApiError(409, {
        code: 'BOOKING_REQUEST_ALREADY_EXISTS',
        message: 'You already sent a booking request to this Student for this task.',
        details: [],
      }),
    );
    renderCreatePage();
    await user.click(await screen.findByRole('button', { name: 'Send Booking Request' }));

    expect(
      await screen.findByText('You already sent a booking request to this Student for this task.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Booking Request' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send Booking Request' })).toBeEnabled();
  });

  it('renders an unavailable Student error', async () => {
    const user = userEvent.setup();
    mockedCreate.mockRejectedValue(
      new ApiError(409, {
        code: 'STUDENT_NOT_AVAILABLE',
        message: 'This Student is no longer available at the selected time.',
        details: [],
      }),
    );
    renderCreatePage();
    await user.click(await screen.findByRole('button', { name: 'Send Booking Request' }));

    expect(
      await screen.findByText('This Student is no longer available at the selected time.'),
    ).toBeInTheDocument();
  });

  it('shows PENDING after a successful request without completing later steps', async () => {
    mockedGetBooking.mockResolvedValue({ booking });
    render(
      <MemoryRouter initialEntries={['/help-seeker/bookings/booking_1']}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Booking request sent' })).toBeInTheDocument();
    expect(
      screen.getByText('Your booking is not confirmed yet. The Student needs to accept your request first.'),
    ).toBeInTheDocument();
    expect(screen.getByText('PENDING')).toBeInTheDocument();
    expect(screen.getByText('Waiting for Student')).toBeInTheDocument();
    expect(screen.getByText('Payment authorization')).toBeInTheDocument();
    expect(screen.getByText('Booking confirmed')).toBeInTheDocument();
    expect(screen.getByText('Furniture Assembly')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Estimated Cost' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Task' })).toHaveAttribute(
      'href',
      '/help-seeker/tasks/task_1',
    );
    expect(screen.queryByRole('heading', { name: 'Payment' })).not.toBeInTheDocument();
    expect(screen.queryByText('CONFIRMED')).not.toBeInTheDocument();
  });

  it('keeps payment authorization current after the Student accepts', async () => {
    mockedGetBooking.mockResolvedValue({
      booking: { ...booking, status: 'ACCEPTED', updatedAt: '2026-09-10T08:05:00.000Z' },
    });
    render(
      <MemoryRouter initialEntries={['/help-seeker/bookings/booking_1']}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Student accepted' })).toBeInTheDocument();
    expect(screen.getByText('Payment authorization pending')).toBeInTheDocument();
    expect(screen.getByText('ACCEPTED')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Payment' })).toBeInTheDocument();
    expect(await screen.findByText('Estimated total €49.50')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue to Payment' })).toBeEnabled();
    expect(screen.queryByText('CONFIRMED')).not.toBeInTheDocument();
  });

  it('stops the tracker at declined after a rejection', async () => {
    mockedGetBooking.mockResolvedValue({
      booking: {
        ...booking,
        status: 'REJECTED',
        rejectionReason: 'The schedule no longer works for me.',
        rejectedAt: '2026-09-10T08:06:00.000Z',
        updatedAt: '2026-09-10T08:06:00.000Z',
      },
    });
    render(
      <MemoryRouter initialEntries={['/help-seeker/bookings/booking_1']}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Booking declined' })).toBeInTheDocument();
    expect(screen.getByText('Student declined')).toBeInTheDocument();
    expect(screen.getByText('The schedule no longer works for me.')).toBeInTheDocument();
    expect(screen.queryByText('Payment authorization')).not.toBeInTheDocument();
    expect(screen.queryByText('Booking confirmed')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Payment' })).not.toBeInTheDocument();
  });

  it('lets the user go back to recommendations from the summary', async () => {
    renderCreatePage();
    const back = await screen.findByRole('link', { name: 'Back' });
    expect(back).toHaveAttribute('href', '/help-seeker/tasks/task_1/recommendations');
  });

  it('shows Confirm Completion only while AWAITING_SIGNOFF', async () => {
    mockedGetBooking.mockResolvedValue({
      booking: {
        ...booking,
        status: 'AWAITING_SIGNOFF',
        startedAt: '2026-09-11T08:03:00.000Z',
        submittedForSignoffAt: '2026-09-11T11:42:00.000Z',
        updatedAt: '2026-09-11T11:42:00.000Z',
      },
    });
    render(
      <MemoryRouter initialEntries={['/help-seeker/bookings/booking_1']}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Waiting for confirmation' })).toBeInTheDocument();
    expect(screen.getByText('AWAITING_SIGNOFF')).toBeInTheDocument();
    expect(
      screen.getAllByText('Student has marked the task as done. Confirmation is required.').length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('1:42 PM')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm Completion' })).toBeEnabled();
    expect(screen.queryByText('COMPLETED')).not.toBeInTheDocument();
    expect(screen.queryByText(/already been paid/i)).not.toBeInTheDocument();
  });

  it('opens confirmation, disables submit while in flight, and renders COMPLETED without claiming payout', async () => {
    const user = userEvent.setup();
    const awaiting: BookingView = {
      ...booking,
      status: 'AWAITING_SIGNOFF',
      startedAt: '2026-09-11T08:03:00.000Z',
      submittedForSignoffAt: '2026-09-11T11:42:00.000Z',
      updatedAt: '2026-09-11T11:42:00.000Z',
    };
    const completed: BookingView = {
      ...awaiting,
      status: 'COMPLETED',
      completedAt: '2026-09-11T12:10:00.000Z',
      updatedAt: '2026-09-11T12:10:00.000Z',
    };
    mockedGetBooking.mockResolvedValue({ booking: awaiting });
    let resolveConfirm: ((value: { booking: BookingView; message: string }) => void) | undefined;
    mockedConfirm.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveConfirm = resolve;
        }),
    );
    render(
      <MemoryRouter initialEntries={['/help-seeker/bookings/booking_1']}>
        <App />
      </MemoryRouter>,
    );
    await user.click(await screen.findByRole('button', { name: 'Confirm Completion' }));

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByRole('heading', { name: 'Confirm that this task is complete?' }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Confirming completion does not mean the Student has already been paid/),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Confirm Completion' }));
    expect(within(dialog).getByRole('button', { name: 'Confirming…' })).toBeDisabled();
    expect(mockedConfirm).toHaveBeenCalledTimes(1);
    expect(mockedConfirm).toHaveBeenCalledWith('booking_1');

    resolveConfirm?.({ booking: completed, message: 'Task completion confirmed.' });
    expect(await screen.findByRole('heading', { name: 'Task completed' })).toBeInTheDocument();
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    expect(screen.getByText('2:10 PM')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm Completion' })).not.toBeInTheDocument();
    expect(screen.queryByText('PAID')).not.toBeInTheDocument();
    expect(screen.queryByText(/already been paid/i)).not.toBeInTheDocument();
  });

  it('refreshes stale booking data after a failed confirmation', async () => {
    const user = userEvent.setup();
    const awaiting: BookingView = {
      ...booking,
      status: 'AWAITING_SIGNOFF',
      startedAt: '2026-09-11T08:03:00.000Z',
      submittedForSignoffAt: '2026-09-11T11:42:00.000Z',
      updatedAt: '2026-09-11T11:42:00.000Z',
    };
    const completed: BookingView = {
      ...awaiting,
      status: 'COMPLETED',
      completedAt: '2026-09-11T12:10:00.000Z',
      updatedAt: '2026-09-11T12:10:00.000Z',
    };
    mockedGetBooking.mockResolvedValueOnce({ booking: awaiting }).mockResolvedValueOnce({ booking: completed });
    mockedConfirm.mockRejectedValue(
      new ApiError(409, {
        code: 'TASK_ALREADY_COMPLETED',
        message: 'This task has already been completed.',
        details: [],
      }),
    );
    render(
      <MemoryRouter initialEntries={['/help-seeker/bookings/booking_1']}>
        <App />
      </MemoryRouter>,
    );
    await user.click(await screen.findByRole('button', { name: 'Confirm Completion' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirm Completion' }));

    expect(await screen.findByText('This task has already been completed.')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Task completed' })).toBeInTheDocument();
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm Completion' })).not.toBeInTheDocument();
  });

  it('supports keyboard cancel in the confirmation dialog', async () => {
    const user = userEvent.setup();
    mockedGetBooking.mockResolvedValue({
      booking: {
        ...booking,
        status: 'AWAITING_SIGNOFF',
        startedAt: '2026-09-11T08:03:00.000Z',
        submittedForSignoffAt: '2026-09-11T11:42:00.000Z',
        updatedAt: '2026-09-11T11:42:00.000Z',
      },
    });
    render(
      <MemoryRouter initialEntries={['/help-seeker/bookings/booking_1']}>
        <App />
      </MemoryRouter>,
    );
    await user.click(await screen.findByRole('button', { name: 'Confirm Completion' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockedConfirm).not.toHaveBeenCalled();
  });
});
