import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App';
import { ApiError } from '../../services/api/client';
import {
  createStudentSkill,
  deleteStudentSkill,
  listSkillCatalog,
  listStudentSkills,
  updateStudentSkill,
} from '../../features/skills/services/skills-api';
import type { CatalogSkill, StudentSkill } from '../../features/skills/types';

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
const mockedList = vi.mocked(listStudentSkills);
const mockedCreate = vi.mocked(createStudentSkill);
const mockedUpdate = vi.mocked(updateStudentSkill);
const mockedDelete = vi.mocked(deleteStudentSkill);

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

const furnitureSkill: StudentSkill = {
  id: 'student_skill_1',
  skill: { id: 'skill_furniture', name: 'Furniture Assembly', category: 'Household' },
  experienceLevel: 'ADVANCED',
  description: 'Comfortable assembling wardrobes, desks, shelving and flat-pack furniture.',
  certificationReference: 'IKEA Family workshop',
};

function renderSkillsPage() {
  return render(
    <MemoryRouter initialEntries={['/student/skills']}>
      <App />
    </MemoryRouter>,
  );
}

async function openAddSkill(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole('heading', { name: 'Skills & Experience' });
  await user.click(screen.getByRole('button', { name: 'Add Skill' }));
  expect(await screen.findByRole('heading', { name: 'Add a skill' })).toBeInTheDocument();
}

describe('Student skills page', () => {
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
    mockedCatalog.mockResolvedValue({ skills: catalog });
    mockedList.mockResolvedValue({ skills: [] });
    mockedCreate.mockReset();
    mockedUpdate.mockReset();
    mockedDelete.mockReset();
  });

  it('renders an empty state', async () => {
    renderSkillsPage();

    expect(await screen.findByRole('heading', { name: 'Skills & Experience' })).toBeInTheDocument();
    expect(screen.getByText("You haven't added any skills yet.")).toBeInTheDocument();
    expect(
      screen.getByText('Add the skills you can offer so Help Seekers can find you for relevant tasks.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Skill' })).toBeInTheDocument();
  });

  it('requires a skill and experience level before submit', async () => {
    const user = userEvent.setup();
    renderSkillsPage();
    await openAddSkill(user);

    await user.click(screen.getByRole('button', { name: 'Add Skill' }));

    expect(await screen.findByText('Select a skill.')).toBeInTheDocument();
    expect(screen.getByText('Select an experience level.')).toBeInTheDocument();
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('adds a skill and shows it in the list', async () => {
    const user = userEvent.setup();
    mockedCreate.mockResolvedValue({ skill: furnitureSkill });
    renderSkillsPage();
    await openAddSkill(user);

    await user.selectOptions(screen.getByLabelText('Skill category'), 'Household');
    await user.selectOptions(screen.getByLabelText('Skill'), 'skill_furniture');
    await user.click(screen.getByRole('radio', { name: /Advanced/ }));
    await user.type(
      screen.getByLabelText('Description (optional)'),
      'Comfortable assembling wardrobes, desks, shelving and flat-pack furniture.',
    );
    await user.type(screen.getByLabelText('Certification / reference (optional)'), 'IKEA Family workshop');
    await user.click(screen.getByRole('button', { name: 'Add Skill' }));

    expect(await screen.findByText('Skill added.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Furniture Assembly' })).toBeInTheDocument();
    expect(screen.getByText('Advanced')).toBeInTheDocument();
    expect(
      screen.getByText('Comfortable assembling wardrobes, desks, shelving and flat-pack furniture.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Reference available')).toBeInTheDocument();
    expect(mockedCreate).toHaveBeenCalledWith({
      skillId: 'skill_furniture',
      experienceLevel: 'ADVANCED',
      description: 'Comfortable assembling wardrobes, desks, shelving and flat-pack furniture.',
      certificationReference: 'IKEA Family workshop',
    });
  });

  it('shows a duplicate skill error', async () => {
    const user = userEvent.setup();
    mockedCreate.mockRejectedValue(
      new ApiError(409, {
        code: 'STUDENT_SKILL_ALREADY_EXISTS',
        message: "You've already added this skill.",
        details: [{ field: 'skillId', message: "You've already added this skill." }],
      }),
    );
    renderSkillsPage();
    await openAddSkill(user);

    await user.selectOptions(screen.getByLabelText('Skill category'), 'Household');
    await user.selectOptions(screen.getByLabelText('Skill'), 'skill_furniture');
    await user.click(screen.getByRole('radio', { name: /Beginner/ }));
    await user.click(screen.getByRole('button', { name: 'Add Skill' }));

    expect(await screen.findByText("You've already added this skill.")).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Add a skill' })).toBeInTheDocument();
  });

  it('updates a skill from the edit flow', async () => {
    const user = userEvent.setup();
    mockedList.mockResolvedValue({ skills: [furnitureSkill] });
    mockedUpdate.mockResolvedValue({
      skill: {
        ...furnitureSkill,
        experienceLevel: 'EXPERT',
        description: 'Now including kitchen units.',
      },
    });
    renderSkillsPage();

    expect(await screen.findByRole('heading', { name: 'Furniture Assembly' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(await screen.findByRole('heading', { name: 'Update experience' })).toBeInTheDocument();
    expect(screen.getByText('Furniture Assembly')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /Expert/ }));
    await user.clear(screen.getByLabelText('Description (optional)'));
    await user.type(screen.getByLabelText('Description (optional)'), 'Now including kitchen units.');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Skill updated.')).toBeInTheDocument();
    expect(screen.getByText('Expert')).toBeInTheDocument();
    expect(screen.getByText('Now including kitchen units.')).toBeInTheDocument();
    expect(mockedUpdate).toHaveBeenCalledWith('student_skill_1', {
      experienceLevel: 'EXPERT',
      description: 'Now including kitchen units.',
      certificationReference: 'IKEA Family workshop',
    });
  });

  it('asks for confirmation before removing a skill and updates the list', async () => {
    const user = userEvent.setup();
    mockedList.mockResolvedValue({ skills: [furnitureSkill] });
    mockedDelete.mockResolvedValue(undefined);
    renderSkillsPage();

    expect(await screen.findByRole('heading', { name: 'Furniture Assembly' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Remove "Furniture Assembly"?' })).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        'This skill will no longer appear on your Student profile and may affect future matching.',
      ),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: 'Furniture Assembly' })).toBeInTheDocument();
    expect(mockedDelete).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Remove' }));
    await user.click(await screen.findByRole('button', { name: 'Remove Skill' }));

    expect(await screen.findByText('Skill removed.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Furniture Assembly' })).not.toBeInTheDocument();
    expect(screen.getByText("You haven't added any skills yet.")).toBeInTheDocument();
    expect(mockedDelete).toHaveBeenCalledWith('student_skill_1');
  });
});
