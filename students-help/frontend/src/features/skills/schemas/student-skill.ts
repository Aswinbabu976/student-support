import { z } from 'zod';
import { EXPERIENCE_LEVELS, type ExperienceLevel } from '../types';

export const DESCRIPTION_MAX = 400;
export const CERTIFICATION_MAX = 200;

export type SkillFormValues = {
  category: string;
  skillId: string;
  experienceLevel: string;
  description: string;
  certificationReference: string;
};

export type SkillFormErrors = {
  skillId?: string;
  experienceLevel?: string;
  description?: string;
  certificationReference?: string;
};

export const studentSkillFormSchema = z.object({
  skillId: z.string().trim().min(1, 'Select a skill.'),
  experienceLevel: z
    .string()
    .min(1, 'Select an experience level.')
    .refine((value): value is ExperienceLevel => EXPERIENCE_LEVELS.includes(value as ExperienceLevel), {
      message: 'Select an experience level.',
    }),
  description: z
    .string()
    .trim()
    .max(DESCRIPTION_MAX, `Description must be ${DESCRIPTION_MAX} characters or fewer.`),
  certificationReference: z
    .string()
    .trim()
    .max(CERTIFICATION_MAX, `Certification / reference must be ${CERTIFICATION_MAX} characters or fewer.`),
});

export type StudentSkillFormValues = z.infer<typeof studentSkillFormSchema>;
