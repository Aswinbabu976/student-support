export type TaskStatus = 'DRAFT' | 'PUBLISHED';

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

export type CreateTaskPayload = {
  title: string;
  description: string;
  skillIds: string[];
  location: { addressLine: string };
  timezone: string;
  preferredDate: string;
  preferredTime: string;
  estimatedDurationMinutes: number;
  specialInstructions: string;
};

export type CreateTaskResponse = {
  task: TaskView;
};

export type TaskResponse = {
  task: TaskView;
};

export type TaskFormValues = {
  title: string;
  description: string;
  skillIds: string[];
  locationLine: string;
  useSavedAddress: boolean;
  timezone: string;
  preferredDate: string;
  preferredTime: string;
  durationHours: string;
  durationMinutes: string;
  specialInstructions: string;
};
