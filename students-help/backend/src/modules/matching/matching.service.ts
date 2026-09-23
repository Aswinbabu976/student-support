import { TaskStatus, UserRole, VerificationStatus } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { AppError, forbidden, matchingServiceError, taskNotFound, taskNotPublished } from '../../shared/errors.js';
import { isAvailableFromSnapshot } from '../availability/availability.service.js';
import { toRecommendationView } from './matching.mapper.js';
import { rankCandidates, scoreCandidate } from './matching.score.js';
import type { CandidateSnapshot, RecommendationsResponse } from './matching.types.js';

type MatchingServiceDeps = {
  prisma: PrismaClient;
};

export class MatchingService {
  constructor(private readonly deps: MatchingServiceDeps) {}

  async listForTask(userId: string, taskId: string): Promise<RecommendationsResponse> {
    const profile = await this.deps.prisma.helpSeekerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) {
      throw forbidden();
    }

    const task = await this.deps.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        helpSeekerProfileId: true,
        status: true,
        locationLine: true,
        preferredStartAt: true,
        estimatedDurationMinutes: true,
        skills: {
          select: { skillId: true, skill: { select: { id: true, name: true } } },
        },
      },
    });
    if (!task) {
      throw taskNotFound();
    }
    if (task.helpSeekerProfileId !== profile.id) {
      throw forbidden();
    }
    if (task.status !== TaskStatus.PUBLISHED) {
      throw taskNotPublished();
    }

    const requiredSkillIds = task.skills.map((row) => row.skillId);
    const preferredEndAt = new Date(
      task.preferredStartAt.getTime() + task.estimatedDurationMinutes * 60 * 1000,
    );

    try {
      const students = await this.deps.prisma.studentProfile.findMany({
        where: {
          user: {
            role: UserRole.STUDENT,
            verificationStatus: VerificationStatus.VERIFIED,
          },
          skills: {
            some: { skillId: { in: requiredSkillIds } },
          },
        },
        select: {
          id: true,
          timezone: true,
          user: {
            select: {
              email: true,
              verificationStatus: true,
            },
          },
          skills: {
            where: { skillId: { in: requiredSkillIds } },
            select: {
              skillId: true,
              experienceLevel: true,
              skill: { select: { name: true } },
            },
          },
          recurringAvailability: {
            where: { isActive: true },
            select: { dayOfWeek: true, startTime: true, endTime: true, isActive: true },
          },
          unavailablePeriods: {
            select: { startDateTime: true, endDateTime: true },
          },
        },
      });

      const eligible: CandidateSnapshot[] = [];
      for (const student of students) {
        if (student.skills.length === 0) {
          continue;
        }
        const available = isAvailableFromSnapshot(
          {
            timezone: student.timezone,
            recurringAvailability: student.recurringAvailability,
            unavailablePeriods: student.unavailablePeriods,
          },
          task.preferredStartAt,
          preferredEndAt,
        );
        if (!available) {
          continue;
        }
        eligible.push({
          studentId: student.id,
          email: student.user.email,
          verificationStatus: student.user.verificationStatus,
          matchedSkills: student.skills.map((row) => ({
            skillId: row.skillId,
            name: row.skill.name,
            experienceLevel: row.experienceLevel,
          })),
          rating: null,
          completedJobsCount: 0,
        });
      }

      const ranked = rankCandidates(
        eligible.map((candidate) => scoreCandidate(candidate, requiredSkillIds.length, task.locationLine)),
      );

      return {
        taskId: task.id,
        recommendations: ranked.map((row) =>
          toRecommendationView(row, {
            requiredSkillCount: requiredSkillIds.length,
            requestedStart: task.preferredStartAt,
            requestedEnd: preferredEndAt,
          }),
        ),
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw matchingServiceError();
    }
  }
}
