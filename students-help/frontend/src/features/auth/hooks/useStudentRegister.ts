import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, userFacingAuthMessage } from '../../../services/api/client';
import { normalizeEmail, studentRegisterSchema } from '../schemas/student-register';
import { registerStudent } from '../services/auth-api';

export type RegisterFieldErrors = {
  email?: string;
  password?: string;
  confirmPassword?: string;
};

type RegisterState = {
  email: string;
  password: string;
  confirmPassword: string;
  fieldErrors: RegisterFieldErrors;
  formError: string | null;
  submitting: boolean;
};

const initialState: RegisterState = {
  email: '',
  password: '',
  confirmPassword: '',
  fieldErrors: {},
  formError: null,
  submitting: false,
};

export function useStudentRegister() {
  const navigate = useNavigate();
  const [state, setState] = useState<RegisterState>(initialState);

  function setEmail(email: string) {
    setState((current) => ({
      ...current,
      email,
      fieldErrors: { ...current.fieldErrors, email: undefined },
      formError: null,
    }));
  }

  function setPassword(password: string) {
    setState((current) => ({
      ...current,
      password,
      fieldErrors: { ...current.fieldErrors, password: undefined },
      formError: null,
    }));
  }

  function setConfirmPassword(confirmPassword: string) {
    setState((current) => ({
      ...current,
      confirmPassword,
      fieldErrors: { ...current.fieldErrors, confirmPassword: undefined },
      formError: null,
    }));
  }

  async function submit() {
    if (state.submitting) {
      return;
    }

    const parsed = studentRegisterSchema.safeParse({
      email: state.email,
      password: state.password,
      confirmPassword: state.confirmPassword,
    });

    if (!parsed.success) {
      const fieldErrors: RegisterFieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === 'email' || field === 'password' || field === 'confirmPassword') {
          fieldErrors[field] ??= issue.message;
        }
      }
      setState((current) => ({ ...current, fieldErrors, formError: null }));
      return;
    }

    setState((current) => ({ ...current, submitting: true, formError: null, fieldErrors: {} }));

    try {
      const result = await registerStudent({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      navigate(`/verify-email?email=${encodeURIComponent(result.user.email)}`, {
        replace: true,
      });
    } catch (error) {
      const fieldErrors: RegisterFieldErrors = {};
      if (error instanceof ApiError) {
        const emailMessage = error.fieldMessage('email');
        const passwordMessage = error.fieldMessage('password');
        if (emailMessage) {
          fieldErrors.email = emailMessage;
        }
        if (passwordMessage) {
          fieldErrors.password = passwordMessage;
        }
      }
      setState((current) => ({
        ...current,
        submitting: false,
        password: '',
        confirmPassword: '',
        email: normalizeEmail(current.email),
        fieldErrors,
        formError: Object.keys(fieldErrors).length ? null : userFacingAuthMessage(error),
      }));
    }
  }

  return {
    ...state,
    setEmail,
    setPassword,
    setConfirmPassword,
    submit,
  };
}
