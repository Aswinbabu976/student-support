import type { PrismaClient } from '@prisma/client';
import {
  forbidden,
  skillNotFound,
  studentSkillAlreadyExists,
  studentSkillNotFound,
} from '../../shared/errors.js';
import { isUniqueConstraintError } from '../../shared/prisma-errors.js';
import type { CreateStudentSkillInput, UpdateStudentSkillInput } from './skills.validation.js';
import type { CatalogSkill, StudentSkillView } from './skills.types.js';

type SkillsServiceDeps = {
  prisma: PrismaClient;
};

const studentSkillSelect = {
  id: true,
  experienceLevel: true,
  description: true,
  certificationReference: true,
  skill: {
    select: { id: true, name: true, category: true },
  },
} as const;

export class SkillsService {
  constructor(private readonly deps: SkillsServiceDeps) {}

  async listCatalog(): Promise<CatalogSkill[]> {
    return this.deps.prisma.skill.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true, category: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async listMine(userId: string): Promise<StudentSkillView[]> {
    const profile = await this.requireProfile(userId);
    return this.deps.prisma.studentSkill.findMany({
      where: { studentProfileId: profile.id },
      select: studentSkillSelect,
      orderBy: { createdAt: 'asc' },
    });
  }

  async addMine(userId: string, input: CreateStudentSkillInput): Promise<StudentSkillView> {
    const profile = await this.requireProfile(userId);
    const skill = await this.deps.prisma.skill.findUnique({
      where: { id: input.skillId },
      select: { id: true, isActive: true },
    });
    if (!skill || !skill.isActive) {
      throw skillNotFound();
    }

    const existing = await this.deps.prisma.studentSkill.findUnique({
      where: {
        studentProfileId_skillId: {
          studentProfileId: profile.id,
          skillId: skill.id,
        },
      },
      select: { id: true },
    });
    if (existing) {
      throw studentSkillAlreadyExists();
    }

    try {
      return await this.deps.prisma.studentSkill.create({
        data: {
          studentProfileId: profile.id,
          skillId: skill.id,
          experienceLevel: input.experienceLevel,
          description: input.description,
          certificationReference: input.certificationReference,
        },
        select: studentSkillSelect,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw studentSkillAlreadyExists();
      }
      throw error;
    }
  }

  async updateMine(
    userId: string,
    studentSkillId: string,
    input: UpdateStudentSkillInput,
  ): Promise<StudentSkillView> {
    await this.requireOwnedSkill(userId, studentSkillId);
    return this.deps.prisma.studentSkill.update({
      where: { id: studentSkillId },
      data: {
        ...(input.experienceLevel !== undefined ? { experienceLevel: input.experienceLevel } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.certificationReference !== undefined
          ? { certificationReference: input.certificationReference }
          : {}),
      },
      select: studentSkillSelect,
    });
  }

  async removeMine(userId: string, studentSkillId: string): Promise<void> {
    await this.requireOwnedSkill(userId, studentSkillId);
    await this.deps.prisma.studentSkill.delete({
      where: { id: studentSkillId },
    });
  }

  private async requireProfile(userId: string) {
    const existing = await this.deps.prisma.studentProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (existing) {
      return existing;
    }
    return this.deps.prisma.studentProfile.create({
      data: { userId },
      select: { id: true },
    });
  }

  private async requireOwnedSkill(userId: string, studentSkillId: string) {
    const profile = await this.requireProfile(userId);
    const record = await this.deps.prisma.studentSkill.findUnique({
      where: { id: studentSkillId },
      select: { id: true, studentProfileId: true },
    });
    if (!record) {
      throw studentSkillNotFound();
    }
    if (record.studentProfileId !== profile.id) {
      throw forbidden();
    }
    return record;
  }
}
