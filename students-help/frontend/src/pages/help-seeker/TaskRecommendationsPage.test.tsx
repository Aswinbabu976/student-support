import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App';
import { getHelpSeekerAccount } from '../../features/auth/services/auth-api';
import { listRecommendations } from '../../features/matching/services/matching-api';
import type { Recommendation } from '../../features/matching/types';
import { getTask } from '../../features/tasks/services/tasks-api';
import type { TaskView } from '../../features/tasks/types';
import { ApiError } from '../../services/api/client';

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

function recommendation(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
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
    reasons: [
      { type: 'SKILL', label: 'Matches your Furniture Assembly requirement' },
      { type: 'AVAILABILITY', label: 'Available at your requested time' },
      { type: 'PROXIMITY', label: 'Located in the same area' },
      { type: 'EXPERIENCE', label: 'Advanced experience in Furniture Assembly' },
    ],
    ...overrides,
  };
}

function renderRecommendations() {
  return render(
    <MemoryRouter initialEntries={['/help-seeker/tasks/task_1/recommendations']}>
      <App />
    </MemoryRouter>,
  );
}

describe('Recommended Students page', () => {
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
    mockedRecs.mockReset();
  });

  it('renders a loading state', () => {
    mockedRecs.mockImplementation(() => new Promise(() => undefined));
    renderRecommendations();
    expect(screen.getByText('Loading recommendations…')).toBeInTheDocument();
  });

  it('renders real Student recommendation data and match reasons', async () => {
    mockedRecs.mockResolvedValue({ taskId: 'task_1', recommendations: [recommendation()] });
    renderRecommendations();

    expect(await screen.findByRole('heading', { name: 'Recommended Students' })).toBeInTheDocument();
    expect(screen.getByText('For Furniture Assembly.')).toBeInTheDocument();
    expect(screen.getByText('Verified student')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Furniture Assembly' })).toBeInTheDocument();
    expect(screen.getByText('Advanced')).toBeInTheDocument();
    expect(screen.getByText('Matches your Furniture Assembly requirement')).toBeInTheDocument();
    expect(screen.getByText('Available at your requested time')).toBeInTheDocument();
    expect(screen.getByText('Located in the same area')).toBeInTheDocument();
    expect(screen.queryByText('82.5')).not.toBeInTheDocument();
    expect(screen.queryByText(/4\.8/)).not.toBeInTheDocument();
    expect(screen.queryByText(/completed jobs/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ai[- ]powered/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/98%/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request Booking' })).toHaveAttribute(
      'href',
      '/help-seeker/tasks/task_1/book/student_1',
    );
    expect(screen.queryByRole('button', { name: /book/i })).not.toBeInTheDocument();
  });

  it('omits missing optional factors and keeps the list readable', async () => {
    mockedRecs.mockResolvedValue({
      taskId: 'task_1',
      recommendations: [
        recommendation({
          availability: { isAvailable: false },
          proximity: { relation: 'UNKNOWN', distanceKm: null },
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
              matched: false,
              requestedStart: '2028-09-20T08:00:00.000Z',
              requestedEnd: '2028-09-20T11:00:00.000Z',
            },
            proximity: { relation: 'UNKNOWN', distanceKm: null },
            experience: { level: null, skillName: null },
            rating: { average: null, count: null },
            completedJobs: 0,
          },
          reasons: [{ type: 'SKILL', label: 'Matches your Furniture Assembly requirement' }],
        }),
      ],
    });
    renderRecommendations();

    expect(await screen.findByText('Matches your Furniture Assembly requirement')).toBeInTheDocument();
    expect(screen.queryByText('Available at your requested time')).not.toBeInTheDocument();
    expect(screen.queryByText('Located in the same area')).not.toBeInTheDocument();
    expect(screen.queryByText(/km away/)).not.toBeInTheDocument();
    expect(screen.queryByText(/average rating/i)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Furniture Assembly' })).toBeInTheDocument();
  });

  it('shows an accurate partial skill label', async () => {
    mockedRecs.mockResolvedValue({
      taskId: 'task_1',
      recommendations: [
        recommendation({
          matchFactors: {
            skill: {
              matched: false,
              matchedCount: 1,
              requiredCount: 2,
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
          reasons: [
            { type: 'SKILL', label: 'Matches 1 of 2 required skills' },
            { type: 'AVAILABILITY', label: 'Available at your requested time' },
          ],
        }),
      ],
    });
    renderRecommendations();

    expect(await screen.findByText('Matches 1 of 2 required skills')).toBeInTheDocument();
    expect(screen.queryByText('Matches all required skills')).not.toBeInTheDocument();
  });

  it('renders exact distance when the API provides it', async () => {
    mockedRecs.mockResolvedValue({
      taskId: 'task_1',
      recommendations: [
        recommendation({
          proximity: { relation: 'UNKNOWN', distanceKm: 2.5 },
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
            proximity: { relation: 'UNKNOWN', distanceKm: 2.5 },
            experience: { level: 'ADVANCED', skillName: 'Furniture Assembly' },
            rating: { average: null, count: null },
            completedJobs: 0,
          },
          reasons: [
            { type: 'SKILL', label: 'Matches your Furniture Assembly requirement' },
            { type: 'AVAILABILITY', label: 'Available at your requested time' },
            { type: 'PROXIMITY', label: '2.5 km away' },
          ],
        }),
      ],
    });
    renderRecommendations();

    expect(await screen.findByText('2.5 km away')).toBeInTheDocument();
    expect(screen.queryByText('Located in the same area')).not.toBeInTheDocument();
  });

  it('opens and closes the expanded explanation with pointer and keyboard', async () => {
    mockedRecs.mockResolvedValue({ taskId: 'task_1', recommendations: [recommendation()] });
    const user = userEvent.setup();
    renderRecommendations();

    const toggle = await screen.findByRole('button', { name: 'Why this matches' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('heading', { name: 'Schedule' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Location' })).toBeInTheDocument();
    expect(screen.getByText('Advanced experience in Furniture Assembly')).toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('heading', { name: 'Schedule' })).not.toBeInTheDocument();

    toggle.focus();
    await user.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('region', { name: 'Match explanation' })).toBeInTheDocument();
  });

  it('still renders when optional matchFactors are missing', async () => {
    mockedRecs.mockResolvedValue({
      taskId: 'task_1',
      recommendations: [
        {
          ...recommendation(),
          matchFactors: undefined,
          reasons: [{ type: 'SKILL', label: 'Matches your Furniture Assembly requirement' }],
        } as unknown as Recommendation,
      ],
    });
    renderRecommendations();

    expect(await screen.findByRole('heading', { name: 'Furniture Assembly' })).toBeInTheDocument();
    expect(screen.getByText('Matches your Furniture Assembly requirement')).toBeInTheDocument();
  });

  it('renders an empty state', async () => {
    mockedRecs.mockResolvedValue({ taskId: 'task_1', recommendations: [] });
    renderRecommendations();

    expect(
      await screen.findByText('No suitable Students are available for this task right now.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Try adjusting the task time or required skills later.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Task' })).toHaveAttribute(
      'href',
      '/help-seeker/tasks/task_1',
    );
  });

  it('renders an error state instead of an empty list', async () => {
    mockedRecs.mockRejectedValue(
      new ApiError(500, {
        code: 'MATCHING_SERVICE_ERROR',
        message: 'Recommendations could not be loaded.',
        details: [],
      }),
    );
    renderRecommendations();

    expect(await screen.findByText('Recommendations could not be loaded.')).toBeInTheDocument();
    expect(
      screen.queryByText('No suitable Students are available for this task right now.'),
    ).not.toBeInTheDocument();
  });

  it('does not invent a View Profile route', async () => {
    mockedRecs.mockResolvedValue({ taskId: 'task_1', recommendations: [recommendation()] });
    renderRecommendations();
    await screen.findByText('Verified student');
    expect(screen.queryByRole('link', { name: /view profile/i })).not.toBeInTheDocument();
  });

  it('keeps the recommendation list readable on a narrow layout', async () => {
    mockedRecs.mockResolvedValue({ taskId: 'task_1', recommendations: [recommendation()] });
    const user = userEvent.setup();
    renderRecommendations();
    expect(await screen.findByText('Verified student')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recommended Students' })).toBeInTheDocument();
    await user.tab();
    expect(document.body).toContainElement(screen.getByRole('heading', { name: 'Recommended Students' }));
  });
});
