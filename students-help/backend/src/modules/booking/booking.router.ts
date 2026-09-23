import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/require-auth.js';
import type { SessionService } from '../auth/session.service.js';
import type { BookingController } from './booking.controller.js';

export function createTaskBookingsRouter(
  controller: BookingController,
  sessionService: SessionService,
): Router {
  const router = Router();
  router.post(
    '/:taskId/bookings',
    requireAuth(sessionService),
    requireRole(UserRole.HELP_SEEKER),
    controller.create,
  );
  return router;
}

export function createBookingsRouter(
  controller: BookingController,
  sessionService: SessionService,
): Router {
  const router = Router();
  router.post(
    '/:bookingId/accept',
    requireAuth(sessionService),
    requireRole(UserRole.STUDENT),
    controller.accept,
  );
  router.post(
    '/:bookingId/reject',
    requireAuth(sessionService),
    requireRole(UserRole.STUDENT),
    controller.reject,
  );
  router.post(
    '/:bookingId/start',
    requireAuth(sessionService),
    requireRole(UserRole.STUDENT),
    controller.start,
  );
  router.post(
    '/:bookingId/done',
    requireAuth(sessionService),
    requireRole(UserRole.STUDENT),
    controller.markDone,
  );
  router.post(
    '/:bookingId/confirm-completion',
    requireAuth(sessionService),
    requireRole(UserRole.HELP_SEEKER),
    controller.confirmCompletion,
  );
  router.get('/:bookingId', requireAuth(sessionService), controller.getById);
  return router;
}
