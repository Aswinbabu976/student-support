import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/require-auth.js';
import type { SessionService } from '../auth/session.service.js';
import type { PaymentController } from './payment.controller.js';

export function createPaymentRouter(
  controller: PaymentController,
  sessionService: SessionService,
): Router {
  const router = Router();
  router.get(
    '/:bookingId/payment-timeline',
    requireAuth(sessionService),
    requireRole(UserRole.STUDENT),
    controller.getTimeline,
  );
  router.get(
    '/:bookingId/payment',
    requireAuth(sessionService),
    requireRole(UserRole.HELP_SEEKER),
    controller.getByBooking,
  );
  router.post(
    '/:bookingId/payment/authorization',
    requireAuth(sessionService),
    requireRole(UserRole.HELP_SEEKER),
    controller.authorize,
  );
  return router;
}
