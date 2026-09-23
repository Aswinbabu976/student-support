import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App';
import { resetProcessedVerificationTokens } from '../../features/auth/hooks/useVerifyStudentEmail';
import {
  getRegistrationConfig,
  registerStudent,
  verifyStudentEmail,
} from '../../features/auth/services/auth-api';
import { ApiError } from '../../services/api/client';

vi.mock('../../features/auth/services/auth-api', () => ({
  getRegistrationConfig: vi.fn(),
  registerStudent: vi.fn(),
  registerHelpSeeker: vi.fn(),
  getHelpSeekerAccount: vi.fn(),
  verifyStudentEmail: vi.fn(),
  login: vi.fn(),
}));

const mockedConfig = vi.mocked(getRegistrationConfig);
const mockedRegister = vi.mocked(registerStudent);
const mockedVerify = vi.mocked(verifyStudentEmail);

function renderApp(path = '/register/student') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('Student registration', () => {
  beforeEach(() => {
    mockedConfig.mockResolvedValue({
      universityEmailDomains: ['hs-heilbronn.de', 'tum.de'],
      passwordPolicy: { minLength: 10, requireLetter: true, requireNumber: true },
    });
    mockedRegister.mockReset();
    mockedVerify.mockReset();
    resetProcessedVerificationTokens();
  });

  it('validates required fields', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: 'Create student account' }));

    expect(await screen.findByText('University email is required.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
    expect(screen.getByText('Confirm your password.')).toBeInTheDocument();
    expect(mockedRegister).not.toHaveBeenCalled();
  });

  it('shows an invalid email error', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.type(screen.getByLabelText('University email'), 'not-an-email');
    await user.type(screen.getByLabelText('Password'), 'securePass12');
    await user.type(screen.getByLabelText('Confirm password'), 'securePass12');
    await user.click(screen.getByRole('button', { name: 'Create student account' }));

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(mockedRegister).not.toHaveBeenCalled();
  });

  it('shows a password mismatch error', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.type(screen.getByLabelText('University email'), 'student@tum.de');
    await user.type(screen.getByLabelText('Password'), 'securePass12');
    await user.type(screen.getByLabelText('Confirm password'), 'differentPass12');
    await user.click(screen.getByRole('button', { name: 'Create student account' }));

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
    expect(mockedRegister).not.toHaveBeenCalled();
  });

  it('disables submit and shows loading feedback while the request runs', async () => {
    const user = userEvent.setup();
    let resolveRegister: ((value: Awaited<ReturnType<typeof registerStudent>>) => void) | undefined;
    mockedRegister.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRegister = resolve;
        }),
    );
    renderApp();

    await user.type(screen.getByLabelText('University email'), 'student@tum.de');
    await user.type(screen.getByLabelText('Password'), 'securePass12');
    await user.type(screen.getByLabelText('Confirm password'), 'securePass12');
    await user.click(screen.getByRole('button', { name: 'Create student account' }));

    const pendingButton = await screen.findByRole('button', { name: 'Creating account…' });
    expect(pendingButton).toBeDisabled();
    expect(mockedRegister).toHaveBeenCalledTimes(1);

    resolveRegister?.({
      user: {
        id: 'user_1',
        email: 'student@tum.de',
        role: 'STUDENT',
        verificationStatus: 'UNVERIFIED',
      },
      message: 'Registration successful. Verify your university email.',
    });
  });

  it('renders a server validation error', async () => {
    const user = userEvent.setup();
    mockedRegister.mockRejectedValue(
      new ApiError(400, {
        code: 'UNSUPPORTED_UNIVERSITY_EMAIL',
        message: 'Use a supported university email address to register as a Student.',
        details: [
          {
            field: 'email',
            message: 'Use a supported university email address to register as a Student.',
          },
        ],
      }),
    );
    renderApp();

    await user.type(screen.getByLabelText('University email'), 'person@gmail.com');
    await user.type(screen.getByLabelText('Password'), 'securePass12');
    await user.type(screen.getByLabelText('Confirm password'), 'securePass12');
    await user.click(screen.getByRole('button', { name: 'Create student account' }));

    expect(
      await screen.findByText('Use a supported university email address to register as a Student.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('University email')).toHaveValue('person@gmail.com');
  });

  it('transitions to the verification page after success', async () => {
    const user = userEvent.setup();
    mockedRegister.mockResolvedValue({
      user: {
        id: 'user_1',
        email: 'student@tum.de',
        role: 'STUDENT',
        verificationStatus: 'UNVERIFIED',
      },
      message: 'Registration successful. Verify your university email.',
    });
    renderApp();

    await user.type(screen.getByLabelText('University email'), 'student@tum.de');
    await user.type(screen.getByLabelText('Password'), 'securePass12');
    await user.type(screen.getByLabelText('Confirm password'), 'securePass12');
    await user.click(screen.getByRole('button', { name: 'Create student account' }));

    expect(await screen.findByRole('heading', { name: 'Verify your university email' })).toBeInTheDocument();
    expect(screen.getByText('student@tum.de')).toBeInTheDocument();
    expect(screen.getByText(/remains unverified/i)).toBeInTheDocument();
  });
});

describe('Student email verification page', () => {
  beforeEach(() => {
    mockedConfig.mockResolvedValue({
      universityEmailDomains: ['tum.de'],
      passwordPolicy: { minLength: 10, requireLetter: true, requireNumber: true },
    });
    mockedVerify.mockReset();
    resetProcessedVerificationTokens();
  });

  it('shows pending verification for a newly registered email', async () => {
    renderApp('/verify-email?email=student%40tum.de');
    expect(await screen.findByRole('heading', { name: 'Verify your university email' })).toBeInTheDocument();
    expect(screen.getByText('student@tum.de')).toBeInTheDocument();
  });

  it('shows an invalid token state', async () => {
    mockedVerify.mockRejectedValue(
      new ApiError(400, {
        code: 'INVALID_VERIFICATION_TOKEN',
        message: 'This verification link is invalid.',
      }),
    );
    renderApp('/verify-email?token=bad-token');
    expect(await screen.findByRole('heading', { name: 'This link is invalid' })).toBeInTheDocument();
  });

  it('shows success after a valid token', async () => {
    mockedVerify.mockResolvedValue({
      user: {
        id: 'user_1',
        email: 'student@tum.de',
        role: 'STUDENT',
        verificationStatus: 'VERIFIED',
      },
      message: 'University email verified.',
    });
    renderApp('/verify-email?token=good-token');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'University email confirmed' })).toBeInTheDocument();
    });
  });
});
