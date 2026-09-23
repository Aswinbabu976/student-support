import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App';
import { getTask } from '../../features/tasks/services/tasks-api';
import type { TaskView } from '../../features/tasks/types';
import { getCostEstimate } from '../../features/pricing/services/pricing-api';

vi.mock('../../features/pricing/services/pricing-api', () => ({
  getCostEstimate: vi.fn(),
}));

vi.mock('../../features/tasks/services/tasks-api', () => ({
  createTask: vi.fn(),
  getTask: vi.fn(),
}));

vi.mock('../../features/auth/services/auth-api', () => ({
  getRegistrationConfig: vi.fn(),
  registerStudent: vi.fn(),
  registerHelpSeeker: vi.fn(),
  getHelpSeekerAccount: vi.fn(),
  verifyStudentEmail: vi.fn(),
  login: vi.fn(),
}));

const mockedTask = vi.mocked(getTask);
const mockedCost = vi.mocked(getCostEstimate);

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

describe('Task details cost estimate', () => {
  beforeEach(() => {
    mockedTask.mockResolvedValue({ task });
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

  it('shows the estimate before the Help Seeker books a Student', async () => {
    render(
      <MemoryRouter initialEntries={['/help-seeker/tasks/task_1']}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Furniture Assembly' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Estimated Cost' })).toBeInTheDocument();
    expect(screen.getAllByText('€49.50').length).toBeGreaterThan(0);
  });
});
