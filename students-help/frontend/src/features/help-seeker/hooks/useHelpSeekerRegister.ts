import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, userFacingAuthMessage } from '../../../services/api/client';
import { registerHelpSeeker } from '../../auth/services/auth-api';
import { helpSeekerRegisterSchema, normalizeEmail } from '../schemas/help-seeker-register';
import type { PreferredPaymentMethod } from '../types';

export type HelpSeekerFieldErrors = {
  fullName?: string;
  email?: string;
  phone?: string;
  address?: string;
  preferredPaymentMethod?: string;
  password?: string;
  confirmPassword?: string;
};

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  preferredPaymentMethod: string;
  password: string;
  confirmPassword: string;
  fieldErrors: HelpSeekerFieldErrors;
  formError: string | null;
  submitting: boolean;
};

const initialState: FormState = {
  fullName: '',
  email: '',
  phone: '',
  address: '',
  preferredPaymentMethod: '',
  password: '',
  confirmPassword: '',
  fieldErrors: {},
  formError: null,
  submitting: false,
};

const fieldKeys: Array<keyof HelpSeekerFieldErrors> = [
  'fullName',
  'email',
  'phone',
  'address',
  'preferredPaymentMethod',
  'password',
  'confirmPassword',
];

export function useHelpSeekerRegister() {
  const navigate = useNavigate();
  const [state, setState] = useState<FormState>(initialState);

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((current) => ({
      ...current,
      [key]: value,
      fieldErrors: { ...current.fieldErrors, [key]: undefined },
      formError: null,
    }));
  }

  async function submit() {
    if (state.submitting) {
      return;
    }

    const parsed = helpSeekerRegisterSchema.safeParse({
      fullName: state.fullName,
      email: state.email,
      phone: state.phone,
      address: state.address,
      preferredPaymentMethod: state.preferredPaymentMethod,
      password: state.password,
      confirmPassword: state.confirmPassword,
    });

    if (!parsed.success) {
      const fieldErrors: HelpSeekerFieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === 'string' && fieldKeys.includes(field as keyof HelpSeekerFieldErrors)) {
          fieldErrors[field as keyof HelpSeekerFieldErrors] ??= issue.message;
        }
      }
      setState((current) => ({ ...current, fieldErrors, formError: null }));
      return;
    }

    setState((current) => ({ ...current, submitting: true, formError: null, fieldErrors: {} }));

    try {
      await registerHelpSeeker({
        fullName: parsed.data.fullName,
        email: parsed.data.email,
        phone: parsed.data.phone,
        address: parsed.data.address,
        preferredPaymentMethod: parsed.data.preferredPaymentMethod as PreferredPaymentMethod,
        password: parsed.data.password,
      });
      navigate('/help-seeker', {
        replace: true,
        state: {
          user: {
            email: normalizeEmail(parsed.data.email),
            fullName: parsed.data.fullName,
          },
        },
      });
    } catch (error) {
      const fieldErrors: HelpSeekerFieldErrors = {};
      if (error instanceof ApiError) {
        for (const key of fieldKeys) {
          const message = error.fieldMessage(key);
          if (message) {
            fieldErrors[key] = message;
          }
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

  return { ...state, patch, submit };
}
