import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/require-auth.js';
import type { SessionService } from '../auth/session.service.js';
import type { AvailabilityController } from './availability.controller.js';

export function createAvailabilityRouter(
  controller: AvailabilityController,
  sessionService: SessionService,
): Router {
  const router = Router();

  router.get('/', requireAuth(sessionService), requireRole(UserRole.STUDENT), controller.getMine);
  router.put(
    '/weekly',
    requireAuth(sessionService),
    requireRole(UserRole.STUDENT),
    controller.replaceWeekly,
  );
  router.post(
    '/unavailable',
    requireAuth(sessionService),
    requireRole(UserRole.STUDENT),
    controller.addUnavailable,
  );
  router.patch(
    '/unavailable/:periodId',
    requireAuth(sessionService),
    requireRole(UserRole.STUDENT),
    controller.updateUnavailable,
  );
  router.delete(
    '/unavailable/:periodId',
    requireAuth(sessionService),
    requireRole(UserRole.STUDENT),
    controller.removeUnavailable,
  );

  return router;
}
