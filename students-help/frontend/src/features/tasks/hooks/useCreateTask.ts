import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { COMMON_TIMEZONES } from '../../availability/types';
import { getHelpSeekerAccount } from '../../auth/services/auth-api';
import { listSkillCatalog } from '../../skills/services/skills-api';
import type { CatalogSkill } from '../../skills/types';
import { ApiError, userFacingAuthMessage } from '../../../services/api/client';
import { emptyTaskForm, taskFormToPayload, type TaskFormErrors } from '../schemas/create-task';
import { createTask } from '../services/tasks-api';
import type { TaskFormValues, TaskView } from '../types';

export type CreateTaskStage = 'form' | 'review' | 'success';

function defaultTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin';
  } catch {
    return 'Europe/Berlin';
  }
}

function timezoneOptions(current: string): string[] {
  return [...new Set([current, ...COMMON_TIMEZONES])];
}

const fieldKeys: Array<keyof TaskFormErrors> = [
  'title',
  'description',
  'skillIds',
  'locationLine',
  'timezone',
  'preferredDate',
  'preferredTime',
  'estimatedDurationMinutes',
  'specialInstructions',
];

function errorsFromApi(error: ApiError): TaskFormErrors {
  const errors: TaskFormErrors = {};
  const locationMessage = error.fieldMessage('location') ?? error.fieldMessage('location.addressLine');
  if (locationMessage) {
    errors.locationLine = locationMessage;
  }
  for (const key of fieldKeys) {
    if (key === 'locationLine') {
      continue;
    }
    const message = error.fieldMessage(key);
    if (message) {
      errors[key] = message;
    }
  }
  return errors;
}

export function useCreateTask() {
  const navigate = useNavigate();
  const reviewHeadingReady = useRef(false);
  const [stage, setStage] = useState<CreateTaskStage>('form');
  const [form, setForm] = useState<TaskFormValues>(() => emptyTaskForm(defaultTimezone()));
  const [fieldErrors, setFieldErrors] = useState<TaskFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogSkill[]>([]);
  const [savedAddress, setSavedAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdTask, setCreatedTask] = useState<TaskView | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listSkillCatalog(), getHelpSeekerAccount()])
      .then(([catalogResponse, account]) => {
        if (cancelled) {
          return;
        }
        const address = account.address?.addressLine ?? null;
        setCatalog(catalogResponse.skills);
        setSavedAddress(address);
        setForm((current) => ({
          ...current,
          locationLine: address && !current.locationLine ? address : current.locationLine,
          useSavedAddress: Boolean(address) && (!current.locationLine || current.locationLine === address),
        }));
        setLoading(false);
      })
      .catch((caught: unknown) => {
        if (cancelled) {
          return;
        }
        if (caught instanceof ApiError && (caught.status === 401 || caught.code === 'UNAUTHORIZED')) {
          navigate('/login', { replace: true });
          return;
        }
        if (caught instanceof ApiError && (caught.status === 403 || caught.code === 'FORBIDDEN')) {
          setAccessError('Only Help Seekers can create tasks.');
          setLoading(false);
          return;
        }
        setLoadError('The task form could not be loaded.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    if (stage === 'review' && reviewHeadingReady.current) {
      document.getElementById('task-review-heading')?.focus();
    }
    reviewHeadingReady.current = true;
  }, [stage]);

  const timezones = useMemo(() => timezoneOptions(form.timezone), [form.timezone]);

  function patchForm(patch: Partial<TaskFormValues>) {
    setForm((current) => ({ ...current, ...patch }));
    setFieldErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch) as Array<keyof TaskFormValues>) {
        if (key === 'skillIds') {
          delete next.skillIds;
        } else if (key === 'locationLine' || key === 'useSavedAddress') {
          delete next.locationLine;
        } else if (key === 'durationHours' || key === 'durationMinutes') {
          delete next.estimatedDurationMinutes;
        } else if (key in next) {
          delete next[key as keyof TaskFormErrors];
        }
      }
      return next;
    });
    setFormError(null);
  }

  function toggleSkill(skillId: string) {
    const skillIds = form.skillIds.includes(skillId)
      ? form.skillIds.filter((id) => id !== skillId)
      : [...form.skillIds, skillId];
    patchForm({ skillIds });
  }

  function removeSkill(skillId: string) {
    patchForm({ skillIds: form.skillIds.filter((id) => id !== skillId) });
  }

  function goToReview() {
    const result = taskFormToPayload(form);
    if ('errors' in result) {
      setFieldErrors(result.errors);
      setFormError('Fix the highlighted fields before reviewing.');
      setStage('form');
      return;
    }
    setFieldErrors({});
    setFormError(null);
    setStage('review');
  }

  function backToForm() {
    setStage('form');
  }

  async function publish() {
    if (submitting) {
      return;
    }
    const result = taskFormToPayload(form);
    if ('errors' in result) {
      setFieldErrors(result.errors);
      setFormError('Fix the highlighted fields before publishing.');
      setStage('form');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const response = await createTask(result);
      setCreatedTask(response.task);
      setStage('success');
      setSubmitting(false);
    } catch (error) {
      const mapped = error instanceof ApiError ? errorsFromApi(error) : {};
      setFieldErrors(mapped);
      setFormError(Object.keys(mapped).length ? null : userFacingAuthMessage(error));
      setSubmitting(false);
    }
  }

  function startNew() {
    setCreatedTask(null);
    setFieldErrors({});
    setFormError(null);
    setSubmitting(false);
    setForm({
      ...emptyTaskForm(form.timezone),
      locationLine: savedAddress ?? '',
      useSavedAddress: Boolean(savedAddress),
    });
    setStage('form');
  }

  return {
    stage,
    form,
    fieldErrors,
    formError,
    catalog,
    savedAddress,
    loading,
    loadError,
    accessError,
    submitting,
    createdTask,
    timezones,
    patchForm,
    toggleSkill,
    removeSkill,
    goToReview,
    backToForm,
    publish,
    startNew,
  };
}
