import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { requireAuth, requireRole } from './require-auth.js';
import type { SessionService } from './session.service.js';

export function createRoleProbeRouter(sessionService: SessionService): Router {
  const router = Router();
  const auth = requireAuth(sessionService);

  router.get('/student/account', auth, requireRole(UserRole.STUDENT), (_req, res) => {
    res.status(200).json({ role: UserRole.STUDENT });
  });

  router.get('/admin/account', auth, requireRole(UserRole.ADMIN), (_req, res) => {
    res.status(200).json({ role: UserRole.ADMIN });
  });

  return router;
}
