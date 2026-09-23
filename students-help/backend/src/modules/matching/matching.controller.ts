import type { Request, Response } from 'express';
import type { MatchingService } from './matching.service.js';
import { parseTaskId } from './matching.validation.js';

export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const taskId = parseTaskId(String(req.params.taskId));
    const payload = await this.matchingService.listForTask(req.auth!.id, taskId);
    res.status(200).json(payload);
  };
}
