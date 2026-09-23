import { TaskStatus } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { AppError, forbidden, taskCreationFailed, taskNotFound } from '../../shared/errors.js';
import { utcToZonedParts } from '../availability/availability.time.js';
import type { CreateTaskInput, TaskView } from './tasks.types.js';
import { assertSkillsExist } from './tasks.validation.js';

type TasksServiceDeps = {
  prisma: PrismaClient;
};

const taskSelect = {
  id: true,
  title: true,
  description: true,
  locationLine: true,
  timezone: true,
  preferredStartAt: true,
  estimatedDurationMinutes: true,
  specialInstructions: true,
  status: true,
  skills: {
    select: {
      skill: { select: { id: true, name: true, category: true } },
    },
  },
} as const;

export class TasksService {
  constructor(private readonly deps: TasksServiceDeps) {}

  async create(userId: string, input: CreateTaskInput): Promise<TaskView> {
    const profile = await this.requireHelpSeekerProfile(userId);
    const catalog = await this.deps.prisma.skill.findMany({
      where: { id: { in: input.skillIds } },
      select: { id: true, isActive: true },
    });
    assertSkillsExist(input.skillIds, catalog);

    try {
      const created = await this.deps.prisma.$transaction(async (tx) => {
        const task = await tx.task.create({
          data: {
            helpSeekerProfileId: profile.id,
            title: input.title,
            description: input.description,
            locationLine: input.locationLine,
            timezone: input.timezone,
            preferredStartAt: input.preferredStartAt,
            estimatedDurationMinutes: input.estimatedDurationMinutes,
            specialInstructions: input.specialInstructions,
            status: TaskStatus.PUBLISHED,
          },
          select: { id: true },
        });

        await tx.taskSkill.createMany({
          data: input.skillIds.map((skillId) => ({
            taskId: task.id,
            skillId,
          })),
        });

        return tx.task.findUniqueOrThrow({
          where: { id: task.id },
          select: taskSelect,
        });
      });
      return this.toView(created);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw taskCreationFailed();
    }
  }

  async getOwned(userId: string, taskId: string): Promise<TaskView> {
    const profile = await this.requireHelpSeekerProfile(userId);
    const task = await this.deps.prisma.task.findUnique({
      where: { id: taskId },
      select: { ...taskSelect, helpSeekerProfileId: true },
    });
    if (!task) {
      throw taskNotFound();
    }
    if (task.helpSeekerProfileId !== profile.id) {
      throw forbidden();
    }
    return this.toView(task);
  }

  private async requireHelpSeekerProfile(userId: string) {
    const profile = await this.deps.prisma.helpSeekerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) {
      throw forbidden();
    }
    return profile;
  }

  private toView(task: {
    id: string;
    title: string;
    description: string;
    locationLine: string;
    timezone: string;
    preferredStartAt: Date;
    estimatedDurationMinutes: number;
    specialInstructions: string | null;
    status: TaskStatus;
    skills: Array<{ skill: { id: string; name: string; category: string } }>;
  }): TaskView {
    const local = utcToZonedParts(task.preferredStartAt, task.timezone);
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      skills: task.skills.map((row) => row.skill),
      location: { addressLine: task.locationLine },
      timezone: task.timezone,
      preferredDate: local.date,
      preferredTime: `${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}`,
      preferredStartAt: task.preferredStartAt.toISOString(),
      estimatedDurationMinutes: task.estimatedDurationMinutes,
      specialInstructions: task.specialInstructions,
      status: task.status,
    };
  }
}
