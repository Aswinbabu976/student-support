import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App';
import { ApiError } from '../../services/api/client';
import {
  createUnavailablePeriod,
  deleteUnavailablePeriod,
  getAvailability,
  saveWeeklyAvailability,
} from '../../features/availability/services/availability-api';

vi.mock('../../features/availability/services/availability-api', () => ({
  getAvailability: vi.fn(),
  saveWeeklyAvailability: vi.fn(),
  createUnavailablePeriod: vi.fn(),
  deleteUnavailablePeriod: vi.fn(),
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

const mockedGet = vi.mocked(getAvailability);
const mockedSave = vi.mocked(saveWeeklyAvailability);
const mockedCreateUnavailable = vi.mocked(createUnavailablePeriod);
const mockedDeleteUnavailable = vi.mocked(deleteUnavailablePeriod);

function renderAvailability() {
  return render(
    <MemoryRouter initialEntries={['/student/availability']}>
      <App />
    </MemoryRouter>,
  );
}

async function openEditor(user: ReturnType<typeof userEvent.setup>) {
  expect(await screen.findByRole('heading', { name: 'Availability' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Set availability' }));
  expect(await screen.findByRole('heading', { name: 'Weekly availability' })).toBeInTheDocument();
}

describe('Student availability page', () => {
  beforeAll(() => {
    if (typeof HTMLDialogElement !== 'undefined') {
      HTMLDialogElement.prototype.showModal = function showModal() {
        this.setAttribute('open', '');
      };
      HTMLDialogElement.prototype.close = function close() {
        this.removeAttribute('open');
      };
    }
  });

  beforeEach(() => {
    mockedGet.mockResolvedValue({ timezone: null, weekly: [], unavailable: [] });
    mockedSave.mockReset();
    mockedCreateUnavailable.mockReset();
    mockedDeleteUnavailable.mockReset();
  });

  it('renders an empty state', async () => {
    renderAvailability();
    expect(await screen.findByText("You haven't added any availability yet.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set availability' })).toBeInTheDocument();
  });

  it('lets a student enable a day, add a slot, and save', async () => {
    const user = userEvent.setup();
    mockedSave.mockResolvedValue({
      timezone: 'Europe/Stockholm',
      weekly: [
        { id: 'slot_1', dayOfWeek: 'MONDAY', startTime: '16:00', endTime: '20:00' },
      ],
      unavailable: [],
    });
    renderAvailability();
    await openEditor(user);

    await user.selectOptions(screen.getByLabelText('Timezone'), 'Europe/Stockholm');
    await user.click(screen.getByRole('checkbox', { name: /Monday, not available/i }));
    await user.type(screen.getByLabelText('Start'), '16:00');
    await user.type(screen.getByLabelText('End'), '20:00');
    await user.click(screen.getByRole('button', { name: 'Save weekly availability' }));

    expect(await screen.findByText('Weekly availability saved.')).toBeInTheDocument();
    expect(mockedSave).toHaveBeenCalledWith({
      timezone: 'Europe/Stockholm',
      days: [{ dayOfWeek: 'MONDAY', slots: [{ start: '16:00', end: '20:00' }] }],
    });
  });

  it('requires times and rejects overlapping slots', async () => {
    const user = userEvent.setup();
    renderAvailability();
    await openEditor(user);

    await user.click(screen.getByRole('checkbox', { name: /Monday, not available/i }));
    await user.click(screen.getByRole('button', { name: 'Save weekly availability' }));
    expect(await screen.findByText('Choose a timezone.')).toBeInTheDocument();
    expect(screen.getAllByText('Start time is required.').length).toBeGreaterThan(0);
    expect(screen.getAllByText('End time is required.').length).toBeGreaterThan(0);

    await user.selectOptions(screen.getByLabelText('Timezone'), 'Europe/Berlin');
    await user.type(screen.getByLabelText('Start'), '10:00');
    await user.type(screen.getByLabelText('End'), '14:00');
    await user.click(screen.getByRole('button', { name: 'Add another slot' }));
    const starts = screen.getAllByLabelText('Start');
    const ends = screen.getAllByLabelText('End');
    await user.type(starts[1]!, '13:00');
    await user.type(ends[1]!, '16:00');
    await user.click(screen.getByRole('button', { name: 'Save weekly availability' }));

    expect(
      await screen.findByText('This time overlaps with another availability slot.'),
    ).toBeInTheDocument();
    expect(mockedSave).not.toHaveBeenCalled();
  });

  it('removes a slot from the editor', async () => {
    const user = userEvent.setup();
    renderAvailability();
    await openEditor(user);
    await user.click(screen.getByRole('checkbox', { name: /Saturday, not available/i }));
    await user.click(screen.getByRole('button', { name: 'Add another slot' }));
    expect(screen.getAllByLabelText('Start')).toHaveLength(2);
    await user.click(screen.getAllByRole('button', { name: 'Remove slot' })[1]!);
    expect(screen.getAllByLabelText('Start')).toHaveLength(1);
  });

  it('validates the vacation form and shows a server error', async () => {
    const user = userEvent.setup();
    mockedSave.mockResolvedValue({
      timezone: 'Europe/Stockholm',
      weekly: [{ id: 'slot_1', dayOfWeek: 'MONDAY', startTime: '16:00', endTime: '20:00' }],
      unavailable: [],
    });
    mockedCreateUnavailable.mockRejectedValue(
      new ApiError(409, {
        code: 'UNAVAILABLE_PERIOD_OVERLAP',
        message: 'This period overlaps with another unavailable period.',
      }),
    );
    renderAvailability();
    await openEditor(user);

    await user.click(screen.getByRole('button', { name: 'Add unavailable period' }));
    expect(await screen.findByText('Start date is required.')).toBeInTheDocument();
    expect(screen.getByText('End date is required.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Start date'), '2026-09-27');
    await user.type(screen.getByLabelText('End date'), '2026-09-20');
    await user.click(screen.getByRole('button', { name: 'Add unavailable period' }));
    expect(await screen.findByText('End date must be on or after the start date.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Start date'));
    await user.clear(screen.getByLabelText('End date'));
    await user.selectOptions(screen.getByLabelText('Timezone'), 'Europe/Stockholm');
    await user.type(screen.getByLabelText('Start date'), '2026-09-20');
    await user.type(screen.getByLabelText('End date'), '2026-09-27');
    await user.click(screen.getByRole('button', { name: 'Add unavailable period' }));
    expect(
      await screen.findByText('This period overlaps with another unavailable period.'),
    ).toBeInTheDocument();
  });

  it('saves an unavailable period after a successful request', async () => {
    const user = userEvent.setup();
    mockedCreateUnavailable.mockResolvedValue({
      period: {
        id: 'u1',
        startDate: '2026-09-20',
        endDate: '2026-09-27',
        startDateTime: '2026-09-19T22:00:00.000Z',
        endDateTime: '2026-09-27T22:00:00.000Z',
        reason: 'Vacation',
      },
    });
    renderAvailability();
    await openEditor(user);
    await user.selectOptions(screen.getByLabelText('Timezone'), 'Europe/Stockholm');
    await user.type(screen.getByLabelText('Start date'), '2026-09-20');
    await user.type(screen.getByLabelText('End date'), '2026-09-27');
    await user.type(screen.getByLabelText('Reason (optional)'), 'Vacation');
    await user.click(screen.getByRole('button', { name: 'Add unavailable period' }));

    expect(await screen.findByText('Unavailable period added.')).toBeInTheDocument();
    expect(screen.getByText('Vacation')).toBeInTheDocument();
    expect(mockedCreateUnavailable).toHaveBeenCalledWith({
      startDate: '2026-09-20',
      endDate: '2026-09-27',
      reason: 'Vacation',
    });
  });

  it('confirms removal of an unavailable period', async () => {
    const user = userEvent.setup();
    mockedGet.mockResolvedValue({
      timezone: 'Europe/Stockholm',
      weekly: [{ id: 'slot_1', dayOfWeek: 'MONDAY', startTime: '16:00', endTime: '20:00' }],
      unavailable: [
        {
          id: 'u1',
          startDate: '2026-09-20',
          endDate: '2026-09-27',
          startDateTime: '2026-09-19T22:00:00.000Z',
          endDateTime: '2026-09-27T22:00:00.000Z',
          reason: 'Vacation',
        },
      ],
    });
    mockedDeleteUnavailable.mockResolvedValue(undefined);
    renderAvailability();

    expect(await screen.findByText('Vacation')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove period' }));
    expect(await screen.findByText('Unavailable period removed.')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('Vacation')).not.toBeInTheDocument();
    });
  });
});
