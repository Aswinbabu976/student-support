import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, userFacingAuthMessage } from '../../../services/api/client';
import { studentSkillFormSchema, type SkillFormErrors, type SkillFormValues } from '../schemas/student-skill';
import {
  createStudentSkill,
  deleteStudentSkill,
  listSkillCatalog,
  listStudentSkills,
  updateStudentSkill,
} from '../services/skills-api';
import type { CatalogSkill, ExperienceLevel, StudentSkill } from '../types';

export type SkillsPageMode = 'list' | 'create' | 'edit';

const emptyForm: SkillFormValues = {
  category: '',
  skillId: '',
  experienceLevel: '',
  description: '',
  certificationReference: '',
};

const formFieldKeys: Array<keyof SkillFormErrors> = [
  'skillId',
  'experienceLevel',
  'description',
  'certificationReference',
];

type SkillsState = {
  catalog: CatalogSkill[];
  skills: StudentSkill[];
  loading: boolean;
  loadError: string | null;
  mode: SkillsPageMode;
  form: SkillFormValues;
  fieldErrors: SkillFormErrors;
  formError: string | null;
  submitting: boolean;
  successMessage: string | null;
  editing: StudentSkill | null;
  pendingDelete: StudentSkill | null;
  deleting: boolean;
};

const initialState: SkillsState = {
  catalog: [],
  skills: [],
  loading: true,
  loadError: null,
  mode: 'list',
  form: emptyForm,
  fieldErrors: {},
  formError: null,
  submitting: false,
  successMessage: null,
  editing: null,
  pendingDelete: null,
  deleting: false,
};

function mapFieldErrors(error: unknown): SkillFormErrors {
  const fieldErrors: SkillFormErrors = {};
  if (!(error instanceof ApiError)) {
    return fieldErrors;
  }
  for (const key of formFieldKeys) {
    const message = error.fieldMessage(key);
    if (message) {
      fieldErrors[key] = message;
    }
  }
  return fieldErrors;
}

export function useStudentSkills() {
  const navigate = useNavigate();
  const [state, setState] = useState<SkillsState>(initialState);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [catalogResponse, skillsResponse] = await Promise.all([
          listSkillCatalog(),
          listStudentSkills(),
        ]);
        if (cancelled) {
          return;
        }
        setState((current) => ({
          ...current,
          catalog: catalogResponse.skills,
          skills: skillsResponse.skills,
          loading: false,
          loadError: null,
        }));
      } catch (error) {
        if (cancelled) {
          return;
        }
        if (error instanceof ApiError && error.status === 401) {
          navigate('/login', { replace: true });
          return;
        }
        if (error instanceof ApiError && error.status === 403) {
          navigate('/', { replace: true });
          return;
        }
        setState((current) => ({
          ...current,
          loading: false,
          loadError: 'Your skills could not be loaded. Try again.',
        }));
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  function startCreate() {
    setState((current) => ({
      ...current,
      mode: 'create',
      editing: null,
      form: emptyForm,
      fieldErrors: {},
      formError: null,
      successMessage: null,
    }));
  }

  function startEdit(item: StudentSkill) {
    setState((current) => ({
      ...current,
      mode: 'edit',
      editing: item,
      form: {
        category: item.skill.category,
        skillId: item.skill.id,
        experienceLevel: item.experienceLevel,
        description: item.description ?? '',
        certificationReference: item.certificationReference ?? '',
      },
      fieldErrors: {},
      formError: null,
      successMessage: null,
    }));
  }

  function cancelForm() {
    setState((current) => ({
      ...current,
      mode: 'list',
      editing: null,
      form: emptyForm,
      fieldErrors: {},
      formError: null,
      submitting: false,
    }));
  }

  function patchForm(patch: Partial<SkillFormValues>) {
    setState((current) => ({
      ...current,
      form: { ...current.form, ...patch },
      fieldErrors: Object.fromEntries(
        Object.entries(current.fieldErrors).filter(([key]) => !(key in patch)),
      ) as SkillFormErrors,
      formError: null,
    }));
  }

  async function submitForm() {
    if (state.submitting) {
      return;
    }

    const parsed = studentSkillFormSchema.safeParse(state.form);
    if (!parsed.success) {
      const fieldErrors: SkillFormErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === 'string' && formFieldKeys.includes(field as keyof SkillFormErrors)) {
          fieldErrors[field as keyof SkillFormErrors] ??= issue.message;
        }
      }
      setState((current) => ({ ...current, fieldErrors, formError: null }));
      return;
    }

    setState((current) => ({ ...current, submitting: true, formError: null, fieldErrors: {} }));

    try {
      if (state.mode === 'edit' && state.editing) {
        const response = await updateStudentSkill(state.editing.id, {
          experienceLevel: parsed.data.experienceLevel as ExperienceLevel,
          description: parsed.data.description,
          certificationReference: parsed.data.certificationReference,
        });
        setState((current) => ({
          ...current,
          skills: current.skills.map((item) =>
            item.id === response.skill.id ? response.skill : item,
          ),
          mode: 'list',
          editing: null,
          form: emptyForm,
          submitting: false,
          successMessage: 'Skill updated.',
        }));
        return;
      }

      const response = await createStudentSkill({
        skillId: parsed.data.skillId,
        experienceLevel: parsed.data.experienceLevel as ExperienceLevel,
        description: parsed.data.description,
        certificationReference: parsed.data.certificationReference,
      });
      setState((current) => ({
        ...current,
        skills: [...current.skills, response.skill],
        mode: 'list',
        form: emptyForm,
        submitting: false,
        successMessage: 'Skill added.',
      }));
    } catch (error) {
      const fieldErrors = mapFieldErrors(error);
      setState((current) => ({
        ...current,
        submitting: false,
        fieldErrors,
        formError: Object.keys(fieldErrors).length ? null : userFacingAuthMessage(error),
      }));
    }
  }

  function requestDelete(item: StudentSkill) {
    setState((current) => ({ ...current, pendingDelete: item }));
  }

  function cancelDelete() {
    if (state.deleting) {
      return;
    }
    setState((current) => ({ ...current, pendingDelete: null }));
  }

  async function confirmDelete() {
    const target = state.pendingDelete;
    if (!target || state.deleting) {
      return;
    }
    setState((current) => ({ ...current, deleting: true }));
    try {
      await deleteStudentSkill(target.id);
      setState((current) => ({
        ...current,
        skills: current.skills.filter((item) => item.id !== target.id),
        pendingDelete: null,
        deleting: false,
        successMessage: 'Skill removed.',
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        deleting: false,
        pendingDelete: null,
        formError: null,
        successMessage: null,
        loadError: userFacingAuthMessage(error),
      }));
    }
  }

  return {
    ...state,
    startCreate,
    startEdit,
    cancelForm,
    patchForm,
    submitForm,
    requestDelete,
    cancelDelete,
    confirmDelete,
  };
}
