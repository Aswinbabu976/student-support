import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App';
import { getHelpSeekerAccount } from '../../features/auth/services/auth-api';
import { getCostEstimate } from '../../features/pricing/services/pricing-api';
import { listSkillCatalog } from '../../features/skills/services/skills-api';
import type { CatalogSkill } from '../../features/skills/types';
import { createTask, getTask } from '../../features/tasks/services/tasks-api';
import type { TaskView } from '../../features/tasks/types';
import { ApiError } from '../../services/api/client';

vi.mock('../../features/pricing/services/pricing-api', () => ({
  getCostEstimate: vi.fn(),
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

const mockedCatalog = vi.mocked(listSkillCatalog);
const mockedAccount = vi.mocked(getHelpSeekerAccount);
const mockedCreate = vi.mocked(createTask);
const mockedGetTask = vi.mocked(getTask);
const mockedCost = vi.mocked(getCostEstimate);

const catalog: CatalogSkill[] = [
  {
    id: 'skill_furniture',
    name: 'Furniture Assembly',
    slug: 'furniture-assembly',
    category: 'Household',
  },
  {
    id: 'skill_driving',
    name: 'Driving',
    slug: 'driving',
    category: 'Transport',
  },
];

const publishedTask: TaskView = {
  id: 'task_1',
  title: 'Furniture Assembly',
  description: 'Assemble one wardrobe and two bedside tables from flat-pack packages.',
  skills: [{ id: 'skill_furniture', name: 'Furniture Assembly', category: 'Household' }],
  location: { addressLine: 'Example Street 10, 111 22 Stockholm' },
  timezone: 'Europe/Berlin',
  preferredDate: '2028-09-20',
  preferredTime: '10:00',
  preferredStartAt: '2028-09-20T08:00:00.000Z',
  estimatedDurationMinutes: 180,
  specialInstructions: 'Please bring basic assembly tools.',
  status: 'PUBLISHED',
};

function renderCreatePage() {
  return render(
    <MemoryRouter initialEntries={['/help-seeker/tasks/create']}>
      <App />
    </MemoryRouter>,
  );
}

async function readyForm() {
  expect(await screen.findByRole('heading', { name: 'Create a task' })).toBeInTheDocument();
}

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>, options?: { skipSkill?: boolean }) {
  await user.type(screen.getByLabelText('Task title'), 'Furniture Assembly');
  await user.type(
    screen.getByLabelText('Task description'),
    'Assemble one wardrobe and two bedside tables from flat-pack packages.',
  );
  if (!options?.skipSkill) {
    await user.click(screen.getByRole('checkbox', { name: 'Furniture Assembly' }));
  }
  fireEvent.change(screen.getByLabelText('Preferred date'), { target: { value: '2028-09-20' } });
  fireEvent.change(screen.getByLabelText('Preferred time'), { target: { value: '10:00' } });
  await user.type(screen.getByLabelText('Hours'), '3');
  await user.type(
    screen.getByLabelText('Special instructions (optional)'),
    'Please bring basic assembly tools.',
  );
}

describe('Create task page', () => {
  beforeEach(() => {
    mockedCatalog.mockResolvedValue({ skills: catalog });
    mockedAccount.mockResolvedValue({
      user: { id: 'user_1', email: 'alex@example.com', role: 'HELP_SEEKER' },
      profile: {
        fullName: 'Alex Example',
        phone: '+46701234567',
        preferredPaymentMethod: 'CARD',
      },
      address: { addressLine: 'Example Street 10, 111 22 Stockholm', isDefault: true },
    });
    mockedCreate.mockReset();
    mockedGetTask.mockReset();
    mockedCost.mockResolvedValue({
      estimate: {
        currency: 'EUR',
        estimatedDurationMinutes: 180,
        estimatedHours: 3,
        baseHourlyRate: { amountMinor: 1500 },
        subtotal: { amountMinor: 4500 },
        platformFee: { amountMinor: 450 },
        total: { amountMinor: 4950 },
      },
    });
  });

  it('renders the required task fields', async () => {
    renderCreatePage();
    await readyForm();

    expect(screen.getByLabelText('Task title')).toBeInTheDocument();
    expect(screen.getByLabelText('Task description')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Furniture Assembly' })).toBeInTheDocument();
    expect(screen.getByLabelText('Task location')).toBeInTheDocument();
    expect(screen.getByLabelText('Preferred date')).toBeInTheDocument();
    expect(screen.getByLabelText('Preferred time')).toBeInTheDocument();
    expect(screen.getByLabelText('Hours')).toBeInTheDocument();
    expect(screen.getByLabelText('Minutes')).toBeInTheDocument();
    expect(screen.getByText(/Photos are optional/)).toBeInTheDocument();
    expect(screen.getByLabelText('Special instructions (optional)')).toBeInTheDocument();
  });

  it('does not submit an empty form', async () => {
    const user = userEvent.setup();
    renderCreatePage();
    await readyForm();

    await user.click(screen.getByRole('button', { name: 'Review task' }));

    expect(await screen.findByText('Title is required.')).toBeInTheDocument();
    expect(screen.getByText('Description is required.')).toBeInTheDocument();
    expect(screen.getByText('Select at least one required skill.')).toBeInTheDocument();
    expect(screen.getByText('Date is required.')).toBeInTheDocument();
    expect(screen.getByText('Time is required.')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid estimated duration.')).toBeInTheDocument();
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('lets the Help Seeker select and remove a catalog skill', async () => {
    const user = userEvent.setup();
    renderCreatePage();
    await readyForm();

    await user.click(screen.getByRole('checkbox', { name: 'Furniture Assembly' }));
    expect(screen.getByRole('checkbox', { name: 'Furniture Assembly' })).toBeChecked();
    const selected = screen.getByRole('list', { name: 'Selected skills' });
    expect(within(selected).getByText('Furniture Assembly')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove Furniture Assembly' }));
    expect(screen.getByRole('checkbox', { name: 'Furniture Assembly' })).not.toBeChecked();
    expect(screen.queryByRole('list', { name: 'Selected skills' })).not.toBeInTheDocument();
  });

  it('requires at least one skill before review', async () => {
    const user = userEvent.setup();
    renderCreatePage();
    await readyForm();
    await fillRequiredFields(user, { skipSkill: true });

    await user.click(screen.getByRole('button', { name: 'Review task' }));

    expect(await screen.findByText('Select at least one required skill.')).toBeInTheDocument();
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('shows an error for a past date', async () => {
    const user = userEvent.setup();
    renderCreatePage();
    await readyForm();
    await fillRequiredFields(user);
    fireEvent.change(screen.getByLabelText('Preferred date'), { target: { value: '2020-01-15' } });

    await user.click(screen.getByRole('button', { name: 'Review task' }));

    expect(await screen.findByText('Choose a future date and time.')).toBeInTheDocument();
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('shows an error for zero duration', async () => {
    const user = userEvent.setup();
    renderCreatePage();
    await readyForm();
    await fillRequiredFields(user);
    fireEvent.change(screen.getByLabelText('Hours'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '0' } });

    await user.click(screen.getByRole('button', { name: 'Review task' }));

    expect(await screen.findByText('Enter a duration between 1 minute and 24 hours.')).toBeInTheDocument();
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('lets the user skip photos and review the entered values', async () => {
    const user = userEvent.setup();
    renderCreatePage();
    await readyForm();
    await fillRequiredFields(user);

    await user.click(screen.getByRole('button', { name: 'Review task' }));

    expect(await screen.findByRole('heading', { name: 'Check the task before publishing' })).toBeInTheDocument();
    expect(screen.getAllByText('Furniture Assembly').length).toBeGreaterThan(0);
    expect(
      screen.getByText('Assemble one wardrobe and two bedside tables from flat-pack packages.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Example Street 10, 111 22 Stockholm')).toBeInTheDocument();
    expect(screen.getByText('2028-09-20')).toBeInTheDocument();
    expect(screen.getByText(/10:00/)).toBeInTheDocument();
    expect(screen.getByText('3 hours')).toBeInTheDocument();
    expect(screen.getByText(/0 — photo upload is not available yet/)).toBeInTheDocument();
    expect(screen.getByText('Please bring basic assembly tools.')).toBeInTheDocument();
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('prevents a second publish while the request is in flight', async () => {
    const user = userEvent.setup();
    let resolveCreate: ((value: { task: TaskView }) => void) | undefined;
    mockedCreate.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );
    renderCreatePage();
    await readyForm();
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Review task' }));
    expect(await screen.findByRole('button', { name: 'Publish Task' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Publish Task' }));
    expect(screen.getByRole('button', { name: 'Publishing…' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Publishing…' }));
    expect(mockedCreate).toHaveBeenCalledTimes(1);

    resolveCreate?.({ task: publishedTask });
    expect(await screen.findByText('Task published successfully.')).toBeInTheDocument();
  });

  it('keeps form values when publishing fails', async () => {
    const user = userEvent.setup();
    mockedCreate.mockRejectedValue(
      new ApiError(500, {
        code: 'TASK_CREATION_FAILED',
        message: 'The task could not be created.',
        details: [],
      }),
    );
    renderCreatePage();
    await readyForm();
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Review task' }));
    await user.click(await screen.findByRole('button', { name: 'Publish Task' }));

    expect(await screen.findByText('The task could not be created.')).toBeInTheDocument();
    expect(screen.getAllByText('Furniture Assembly').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Publish Task' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('Task title')).toHaveValue('Furniture Assembly');
    expect(screen.getByLabelText('Task description')).toHaveValue(
      'Assemble one wardrobe and two bedside tables from flat-pack packages.',
    );
  });

  it('shows success and opens the published task', async () => {
    const user = userEvent.setup();
    mockedCreate.mockResolvedValue({ task: publishedTask });
    mockedGetTask.mockResolvedValue({ task: publishedTask });
    renderCreatePage();
    await readyForm();
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Review task' }));
    await user.click(await screen.findByRole('button', { name: 'Publish Task' }));

    expect(await screen.findByText('Task published successfully.')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'View task' }));
    expect(await screen.findByRole('heading', { name: 'Furniture Assembly' })).toBeInTheDocument();
    expect(screen.getAllByText('3 hours').length).toBeGreaterThan(0);
  });

  it('tells Students they cannot create a Help Seeker task', async () => {
    mockedAccount.mockRejectedValue(
      new ApiError(403, { code: 'FORBIDDEN', message: 'You do not have access to this resource.', details: [] }),
    );
    renderCreatePage();

    expect(await screen.findByText('Only Help Seekers can create tasks.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Create a task' })).not.toBeInTheDocument();
  });
});
