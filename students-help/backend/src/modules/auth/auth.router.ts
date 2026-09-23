import { Router } from 'express';
import type { AuthController } from './auth.controller.js';
import type { HelpSeekerController } from '../help-seeker/help-seeker.controller.js';

export function createAuthRouter(
  controller: AuthController,
  helpSeekerController: HelpSeekerController,
): Router {
  const router = Router();

  router.get('/registration-config', controller.getRegistrationConfig);
  router.post('/register/student', controller.registerStudent);
  router.post('/register/help-seeker', helpSeekerController.register);
  router.post('/login', controller.login);
  router.post('/verify-email', controller.verifyEmail);
  router.get('/verify-email', controller.verifyEmail);

  return router;
}
