export const EXPERIENCE_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'] as const;

export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
  EXPERT: 'Expert',
};

export const EXPERIENCE_LEVEL_HELP: Record<ExperienceLevel, string> = {
  BEGINNER: 'Basic familiarity; limited practical experience.',
  INTERMEDIATE: 'Can complete common tasks independently.',
  ADVANCED: 'Strong practical experience across varied tasks.',
  EXPERT: 'Extensive experience and high confidence in complex tasks.',
};

export type CatalogSkill = {
  id: string;
  name: string;
  slug: string;
  category: string;
};

export type StudentSkill = {
  id: string;
  skill: {
    id: string;
    name: string;
    category: string;
  };
  experienceLevel: ExperienceLevel;
  description: string | null;
  certificationReference: string | null;
};

export type StudentSkillsResponse = {
  skills: StudentSkill[];
};

export type SkillCatalogResponse = {
  skills: CatalogSkill[];
};

export type StudentSkillResponse = {
  skill: StudentSkill;
};

export type CreateStudentSkillInput = {
  skillId: string;
  experienceLevel: ExperienceLevel;
  description: string;
  certificationReference: string;
};

export type UpdateStudentSkillInput = {
  experienceLevel: ExperienceLevel;
  description: string;
  certificationReference: string;
};
