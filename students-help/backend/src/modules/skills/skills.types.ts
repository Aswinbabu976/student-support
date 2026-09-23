import type { ExperienceLevel } from '@prisma/client';

export type CatalogSkill = {
  id: string;
  name: string;
  slug: string;
  category: string;
};

export type StudentSkillView = {
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
