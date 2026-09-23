import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/require-auth.js';
import type { SessionService } from '../auth/session.service.js';
import type { PricingController } from './pricing.controller.js';

export function createTaskPricingRouter(
  controller: PricingController,
  sessionService: SessionService,
): Router {
  const router = Router();
  router.get(
    '/:taskId/cost-estimate',
    requireAuth(sessionService),
    requireRole(UserRole.HELP_SEEKER),
    controller.estimateForTask,
  );
  return router;
}
