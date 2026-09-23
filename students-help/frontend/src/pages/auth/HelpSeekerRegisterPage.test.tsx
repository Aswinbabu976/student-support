import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App';
import {
  getHelpSeekerAccount,
  getRegistrationConfig,
  registerHelpSeeker,
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
const mockedRegister = vi.mocked(registerHelpSeeker);
const mockedAccount = vi.mocked(getHelpSeekerAccount);

function renderApp(path = '/register/help-seeker') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Full name'), 'Alex Example');
  await user.type(screen.getByLabelText('Email'), 'alex@example.com');
  await user.type(screen.getByLabelText('Password', { exact: true }), 'securePass12');
  await user.type(screen.getByLabelText('Confirm password'), 'securePass12');
  await user.type(screen.getByLabelText('Phone number'), '+46701234567');
  await user.type(screen.getByLabelText('Address'), 'Example Street 10, Stockholm');
  await user.selectOptions(screen.getByLabelText('Preferred payment method'), 'CARD');
}

describe('Help Seeker registration', () => {
  beforeEach(() => {
    mockedConfig.mockResolvedValue({
      universityEmailDomains: ['tum.de'],
      passwordPolicy: { minLength: 10, requireLetter: true, requireNumber: true },
      preferredPaymentMethods: ['CARD', 'PAYPAL', 'BANK_TRANSFER'],
    });
    mockedRegister.mockReset();
    mockedAccount.mockReset();
    vi.mocked(registerStudent).mockReset();
    vi.mocked(verifyStudentEmail).mockReset();
  });

  it('validates required fields', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Full name is required.')).toBeInTheDocument();
    expect(screen.getByText('Email is required.')).toBeInTheDocument();
    expect(screen.getByText('Phone number is required.')).toBeInTheDocument();
    expect(mockedRegister).not.toHaveBeenCalled();
  });

  it('shows an invalid email error', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText('Full name'), 'Alex Example');
    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.type(screen.getByLabelText('Password', { exact: true }), 'securePass12');
    await user.type(screen.getByLabelText('Confirm password'), 'securePass12');
    await user.type(screen.getByLabelText('Phone number'), '+46701234567');
    await user.type(screen.getByLabelText('Address'), 'Example Street 10, Stockholm');
    await user.selectOptions(screen.getByLabelText('Preferred payment method'), 'CARD');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(mockedRegister).not.toHaveBeenCalled();
  });

  it('shows a password mismatch error', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText('Full name'), 'Alex Example');
    await user.type(screen.getByLabelText('Email'), 'alex@example.com');
    await user.type(screen.getByLabelText('Password', { exact: true }), 'securePass12');
    await user.type(screen.getByLabelText('Confirm password'), 'differentPass12');
    await user.type(screen.getByLabelText('Phone number'), '+46701234567');
    await user.type(screen.getByLabelText('Address'), 'Example Street 10, Stockholm');
    await user.selectOptions(screen.getByLabelText('Preferred payment method'), 'CARD');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
  });

  it('disables submit while the request runs', async () => {
    const user = userEvent.setup();
    mockedRegister.mockImplementation(() => new Promise(() => undefined));
    renderApp();
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('button', { name: 'Creating account…' })).toBeDisabled();
    expect(mockedRegister).toHaveBeenCalledTimes(1);
  });

  it('renders a duplicate-email API error', async () => {
    const user = userEvent.setup();
    mockedRegister.mockRejectedValue(
      new ApiError(409, {
        code: 'EMAIL_ALREADY_REGISTERED',
        message: 'An account already exists for this email.',
        details: [{ field: 'email', message: 'An account already exists for this email.' }],
      }),
    );
    renderApp();
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('An account already exists for this email.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('alex@example.com');
  });

  it('redirects to the Help Seeker home after success', async () => {
    const user = userEvent.setup();
    mockedRegister.mockResolvedValue({
      user: { id: 'user_1', email: 'alex@example.com', role: 'HELP_SEEKER' },
      profile: {
        fullName: 'Alex Example',
        phone: '+46701234567',
        preferredPaymentMethod: 'CARD',
      },
      session: { expiresAt: new Date().toISOString() },
      message: 'Help Seeker account created.',
    });
    mockedAccount.mockResolvedValue({
      user: { id: 'user_1', email: 'alex@example.com', role: 'HELP_SEEKER' },
      profile: {
        fullName: 'Alex Example',
        phone: '+46701234567',
        preferredPaymentMethod: 'CARD',
      },
      address: { addressLine: 'Example Street 10, Stockholm', isDefault: true },
    });
    renderApp();
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('heading', { name: 'Your Help Seeker account' })).toBeInTheDocument();
    expect(screen.getByText(/Alex Example/)).toBeInTheDocument();
  });
});
