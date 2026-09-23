import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/require-auth.js';
import type { SessionService } from '../auth/session.service.js';
import type { HelpSeekerController } from './help-seeker.controller.js';

export function createHelpSeekerRouter(
  controller: HelpSeekerController,
  sessionService: SessionService,
): Router {
  const router = Router();
  router.get(
    '/account',
    requireAuth(sessionService),
    requireRole(UserRole.HELP_SEEKER),
    controller.getAccount,
  );
  return router;
}
