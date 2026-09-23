import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '@prisma/client';
import { AppError, ErrorCode } from '../../shared/errors.js';
import { readCookie, SESSION_COOKIE_NAME } from './session-cookie.js';
import type { SessionService } from './session.service.js';

export function requireAuth(sessionService: SessionService) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = readCookie(req.headers.cookie, SESSION_COOKIE_NAME);
      const user = await sessionService.authenticate(token);
      if (!user) {
        next(unauthorized());
        return;
      }
      req.auth = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(unauthorized());
      return;
    }
    if (!roles.includes(req.auth.role)) {
      next(forbidden());
      return;
    }
    next();
  };
}

function unauthorized(): AppError {
  return new AppError(ErrorCode.UNAUTHORIZED, 'Authentication is required.', 401);
}

function forbidden(): AppError {
  return new AppError(ErrorCode.FORBIDDEN, 'You do not have access to this resource.', 403);
}
