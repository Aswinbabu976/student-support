import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/require-auth.js';
import type { SessionService } from '../auth/session.service.js';
import type { SkillsController } from './skills.controller.js';

export function createSkillCatalogRouter(controller: SkillsController): Router {
  const router = Router();
  router.get('/', controller.listCatalog);
  return router;
}

export function createStudentSkillsRouter(
  controller: SkillsController,
  sessionService: SessionService,
): Router {
  const router = Router();

  router.get(
    '/',
    requireAuth(sessionService),
    requireRole(UserRole.STUDENT),
    controller.listMine,
  );
  router.post(
    '/',
    requireAuth(sessionService),
    requireRole(UserRole.STUDENT),
    controller.addMine,
  );
  router.patch(
    '/:studentSkillId',
    requireAuth(sessionService),
    requireRole(UserRole.STUDENT),
    controller.updateMine,
  );
  router.delete(
    '/:studentSkillId',
    requireAuth(sessionService),
    requireRole(UserRole.STUDENT),
    controller.removeMine,
  );

  return router;
}
