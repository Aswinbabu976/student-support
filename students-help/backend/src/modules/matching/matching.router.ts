import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/require-auth.js';
import type { SessionService } from '../auth/session.service.js';
import type { MatchingController } from './matching.controller.js';

export function createMatchingRouter(
  controller: MatchingController,
  sessionService: SessionService,
): Router {
  const router = Router();
  router.get(
    '/:taskId/recommendations',
    requireAuth(sessionService),
    requireRole(UserRole.HELP_SEEKER),
    controller.list,
  );
  return router;
}
