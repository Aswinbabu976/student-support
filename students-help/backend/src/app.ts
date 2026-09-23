import cors from 'cors';
import express from 'express';
import type { PrismaClient } from '@prisma/client';
import type { AppEnv } from './config/env.js';
import { parseUniversityDomains } from './config/env.js';
import { prisma as defaultPrisma } from './database/prisma.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { AuthController } from './modules/auth/auth.controller.js';
import { createAuthRouter } from './modules/auth/auth.router.js';
import { AuthService } from './modules/auth/auth.service.js';
import { createRoleProbeRouter } from './modules/auth/role-probe.router.js';
import { SessionService } from './modules/auth/session.service.js';
import { UniversityEmailValidator } from './modules/auth/university-email.js';
import { HelpSeekerController } from './modules/help-seeker/help-seeker.controller.js';
import { createHelpSeekerRouter } from './modules/help-seeker/help-seeker.router.js';
import { HelpSeekerService } from './modules/help-seeker/help-seeker.service.js';
import { AvailabilityController } from './modules/availability/availability.controller.js';
import { createAvailabilityRouter } from './modules/availability/availability.router.js';
import { AvailabilityService } from './modules/availability/availability.service.js';
import { SkillsController } from './modules/skills/skills.controller.js';
import { createSkillCatalogRouter, createStudentSkillsRouter } from './modules/skills/skills.router.js';
import { SkillsService } from './modules/skills/skills.service.js';
import { TasksController } from './modules/tasks/tasks.controller.js';
import { createTasksRouter } from './modules/tasks/tasks.router.js';
import { TasksService } from './modules/tasks/tasks.service.js';
import { MatchingController } from './modules/matching/matching.controller.js';
import { createMatchingRouter } from './modules/matching/matching.router.js';
import { MatchingService } from './modules/matching/matching.service.js';
import { BookingController } from './modules/booking/booking.controller.js';
import { BookingExecutionService } from './modules/booking/booking.execution.service.js';
import { createBookingsRouter, createTaskBookingsRouter } from './modules/booking/booking.router.js';
import { BookingService } from './modules/booking/booking.service.js';
import { PricingController } from './modules/pricing/pricing.controller.js';
import { createTaskPricingRouter } from './modules/pricing/pricing.router.js';
import { PricingService } from './modules/pricing/pricing.service.js';
import { TaskPricingService } from './modules/pricing/task-pricing.service.js';
import { createPaymentGateway } from './modules/payment/payment.config.js';
import { PaymentController } from './modules/payment/payment.controller.js';
import { createPaymentRouter } from './modules/payment/payment.router.js';
import { PaymentService } from './modules/payment/payment.service.js';
import { PaymentTimelineService } from './modules/payment/payment.timeline.service.js';
import type { PaymentGateway } from './modules/payment/gateways/payment-gateway.interface.js';
import type { EmailService } from './services/email/email.service.js';
import { LoggingEmailAdapter } from './services/email/logging-email.adapter.js';
import { PasswordHasher } from './services/password-hasher.js';

export type CreateAppOptions = {
  env: AppEnv;
  emailService?: EmailService;
  prisma?: PrismaClient;
  paymentGateway?: PaymentGateway;
};

export function createApp(options: CreateAppOptions) {
  const { env } = options;
  const prisma = options.prisma ?? defaultPrisma;
  const emailService = options.emailService ?? new LoggingEmailAdapter(env.LOG_VERIFICATION_LINKS);
  const passwordHasher = new PasswordHasher(env.BCRYPT_COST);
  const sessionService = new SessionService(prisma, env.SESSION_TTL_HOURS);
  const authService = new AuthService({
    prisma,
    passwordHasher,
    universityEmailValidator: new UniversityEmailValidator(
      parseUniversityDomains(env.UNIVERSITY_EMAIL_DOMAINS),
    ),
    emailService,
    appPublicUrl: env.APP_PUBLIC_URL,
    verificationTokenTtlHours: env.VERIFICATION_TOKEN_TTL_HOURS,
  });
  const helpSeekerService = new HelpSeekerService({
    prisma,
    passwordHasher,
    sessionService,
  });
  const authController = new AuthController({
    authService,
    sessionService,
    sessionTtlHours: env.SESSION_TTL_HOURS,
    secureCookies: env.NODE_ENV === 'production',
  });
  const helpSeekerController = new HelpSeekerController({
    helpSeekerService,
    sessionTtlHours: env.SESSION_TTL_HOURS,
    secureCookies: env.NODE_ENV === 'production',
  });
  const skillsController = new SkillsController(new SkillsService({ prisma }));
  const availabilityService = new AvailabilityService({ prisma });
  const availabilityController = new AvailabilityController(availabilityService);
  const tasksService = new TasksService({ prisma });
  const tasksController = new TasksController(tasksService);
  const matchingController = new MatchingController(new MatchingService({ prisma }));
  const bookingService = new BookingService({ prisma });
  const pricingService = new PricingService();
  const pricingController = new PricingController(
    new TaskPricingService(tasksService, pricingService),
  );
  const paymentGateway = options.paymentGateway ?? createPaymentGateway(env);
  const paymentService = new PaymentService({
    prisma,
    pricingService,
    gateway: paymentGateway,
  });
  const bookingController = new BookingController(
    bookingService,
    new BookingExecutionService({
      prisma,
      paymentService,
      bookingService,
    }),
  );
  const paymentTimelineService = new PaymentTimelineService({
    prisma,
    pricingService,
  });
  const paymentController = new PaymentController(paymentService, paymentTimelineService);

  const app = express();
  app.disable('x-powered-by');
  app.use(
    cors({
      origin: env.FRONTEND_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '32kb' }));
  app.use('/auth', createAuthRouter(authController, helpSeekerController));
  app.use('/help-seeker', createHelpSeekerRouter(helpSeekerController, sessionService));
  app.use('/skills', createSkillCatalogRouter(skillsController));
  app.use('/students/me/skills', createStudentSkillsRouter(skillsController, sessionService));
  app.use('/students/me/availability', createAvailabilityRouter(availabilityController, sessionService));
  app.use('/tasks', createTasksRouter(tasksController, sessionService));
  app.use('/tasks', createMatchingRouter(matchingController, sessionService));
  app.use('/tasks', createTaskPricingRouter(pricingController, sessionService));
  app.use('/tasks', createTaskBookingsRouter(bookingController, sessionService));
  app.use('/bookings', createPaymentRouter(paymentController, sessionService));
  app.use('/bookings', createBookingsRouter(bookingController, sessionService));
  app.use(createRoleProbeRouter(sessionService));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
