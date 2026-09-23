import type { CookieOptions, Request, Response } from 'express';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '../auth/session-cookie.js';
import type { HelpSeekerService } from './help-seeker.service.js';
import { parseHelpSeekerRegistration } from './help-seeker.validation.js';

type HelpSeekerControllerDeps = {
  helpSeekerService: HelpSeekerService;
  sessionTtlHours: number;
  secureCookies: boolean;
};

export class HelpSeekerController {
  constructor(private readonly deps: HelpSeekerControllerDeps) {}

  register = async (req: Request, res: Response): Promise<void> => {
    const input = parseHelpSeekerRegistration(req.body);
    const result = await this.deps.helpSeekerService.register(input);
    const options: CookieOptions = sessionCookieOptions(
      this.deps.sessionTtlHours,
      this.deps.secureCookies,
    );
    res.cookie(SESSION_COOKIE_NAME, result.sessionToken, options);
    res.status(201).json({
      user: result.user,
      profile: result.profile,
      session: result.session,
      message: result.message,
    });
  };

  getAccount = async (req: Request, res: Response): Promise<void> => {
    const account = await this.deps.helpSeekerService.getAccount(req.auth!.id);
    res.status(200).json(account);
  };
}
