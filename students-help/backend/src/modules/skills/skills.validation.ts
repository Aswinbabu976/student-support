import { ExperienceLevel } from '@prisma/client';
import { z } from 'zod';
import { validationError } from '../../shared/errors.js';

const EXPERIENCE_LEVELS = new Set<string>(Object.values(ExperienceLevel));

export const createStudentSkillSchema = z
  .object({
    skillId: z
      .string({ error: 'Select a skill.' })
      .trim()
      .min(1, 'Select a skill.'),
    experienceLevel: z
      .string({ error: 'Select an experience level.' })
      .trim()
      .min(1, 'Select an experience level.'),
    description: z.union([z.string(), z.null()]).optional(),
    certificationReference: z.union([z.string(), z.null()]).optional(),
  })
  .strict();

export const updateStudentSkillSchema = z
  .object({
    experienceLevel: z.string().trim().min(1, 'Select an experience level.').optional(),
    description: z.union([z.string(), z.null()]).optional(),
    certificationReference: z.union([z.string(), z.null()]).optional(),
  })
  .strict();

export type CreateStudentSkillInput = {
  skillId: string;
  experienceLevel: ExperienceLevel;
  description: string | null;
  certificationReference: string | null;
};

export type UpdateStudentSkillInput = {
  experienceLevel?: ExperienceLevel;
  description?: string | null;
  certificationReference?: string | null;
};

function parseExperienceLevel(value: string): ExperienceLevel {
  if (!EXPERIENCE_LEVELS.has(value)) {
    throw validationError('The submitted data is invalid.', [
      { field: 'experienceLevel', message: 'Choose Beginner, Intermediate, Advanced, or Expert.' },
    ]);
  }
  return value as ExperienceLevel;
}

function normalizeOptionalText(
  value: string | null | undefined,
  max: number,
  field: string,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw validationError('The submitted data is invalid.', [
      { field, message: `${field} must be ${max} characters or fewer.` },
    ]);
  }
  return trimmed.length > 0 ? trimmed : null;
}

export function parseCreateStudentSkill(body: unknown): CreateStudentSkillInput {
  const parsed = createStudentSkillSchema.parse(body);
  return {
    skillId: parsed.skillId,
    experienceLevel: parseExperienceLevel(parsed.experienceLevel),
    description: normalizeOptionalText(parsed.description, 400, 'description') ?? null,
    certificationReference:
      normalizeOptionalText(parsed.certificationReference, 200, 'certificationReference') ?? null,
  };
}

export function parseUpdateStudentSkill(body: unknown): UpdateStudentSkillInput {
  const parsed = updateStudentSkillSchema.parse(body);
  const experienceLevel =
    parsed.experienceLevel === undefined ? undefined : parseExperienceLevel(parsed.experienceLevel);
  const description = normalizeOptionalText(parsed.description, 400, 'description');
  const certificationReference = normalizeOptionalText(
    parsed.certificationReference,
    200,
    'certificationReference',
  );

  if (
    experienceLevel === undefined &&
    description === undefined &&
    certificationReference === undefined
  ) {
    throw validationError('The submitted data is invalid.', [
      { message: 'Provide at least one field to update.' },
    ]);
  }

  return {
    experienceLevel,
    description,
    certificationReference,
  };
}
