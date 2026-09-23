import type { CookieOptions, Request, Response } from 'express';
import type { AuthService } from './auth.service.js';
import { parseEmailVerification, parseLogin, parseStudentRegistration } from './auth.validation.js';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from './session-cookie.js';
import type { SessionService } from './session.service.js';

type AuthControllerDeps = {
  authService: AuthService;
  sessionService: SessionService;
  sessionTtlHours: number;
  secureCookies: boolean;
};

export class AuthController {
  constructor(private readonly deps: AuthControllerDeps) {}

  getRegistrationConfig = (_req: Request, res: Response): void => {
    res.status(200).json(this.deps.authService.getRegistrationConfig());
  };

  registerStudent = async (req: Request, res: Response): Promise<void> => {
    const input = parseStudentRegistration(req.body);
    const result = await this.deps.authService.registerStudent(input);
    res.status(201).json(result);
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const input = parseLogin(req.body);
    const user = await this.deps.authService.verifyCredentials(input.email, input.password);
    const session = await this.deps.sessionService.createSession(user.id);
    this.setSessionCookie(res, session.token);
    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      session: { expiresAt: session.expiresAt.toISOString() },
    });
  };

  verifyEmail = async (req: Request, res: Response): Promise<void> => {
    const source = req.method === 'GET' ? req.query : req.body;
    const input = parseEmailVerification(source);
    const result = await this.deps.authService.verifyEmail(input.token);
    res.status(200).json(result);
  };

  private setSessionCookie(res: Response, token: string): void {
    const options: CookieOptions = sessionCookieOptions(
      this.deps.sessionTtlHours,
      this.deps.secureCookies,
    );
    res.cookie(SESSION_COOKIE_NAME, token, options);
  }
}
