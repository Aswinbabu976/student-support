import type { TaskStatus } from '@prisma/client';

export type CreateTaskInput = {
  title: string;
  description: string;
  skillIds: string[];
  locationLine: string;
  timezone: string;
  preferredDate: string;
  preferredTime: string;
  preferredStartAt: Date;
  estimatedDurationMinutes: number;
  specialInstructions: string | null;
};

export type TaskSkillView = {
  id: string;
  name: string;
  category: string;
};

export type TaskView = {
  id: string;
  title: string;
  description: string;
  skills: TaskSkillView[];
  location: { addressLine: string };
  timezone: string;
  preferredDate: string;
  preferredTime: string;
  preferredStartAt: string;
  estimatedDurationMinutes: number;
  specialInstructions: string | null;
  status: TaskStatus;
};
