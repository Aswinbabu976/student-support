import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/require-auth.js';
import type { SessionService } from '../auth/session.service.js';
import type { TasksController } from './tasks.controller.js';

export function createTasksRouter(controller: TasksController, sessionService: SessionService): Router {
  const router = Router();

  router.post('/', requireAuth(sessionService), requireRole(UserRole.HELP_SEEKER), controller.create);
  router.get(
    '/:taskId',
    requireAuth(sessionService),
    requireRole(UserRole.HELP_SEEKER),
    controller.getOwned,
  );

  return router;
}
