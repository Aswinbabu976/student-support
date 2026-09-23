import type { Request, Response } from 'express';
import { parseTaskId } from '../booking/booking.validation.js';
import type { TaskPricingService } from './task-pricing.service.js';

export class PricingController {
  constructor(private readonly taskPricingService: TaskPricingService) {}

  estimateForTask = async (req: Request, res: Response): Promise<void> => {
    const taskId = parseTaskId(String(req.params.taskId));
    const estimate = await this.taskPricingService.estimateForOwnedTask(req.auth!.id, taskId);
    res.status(200).json({ estimate });
  };
}
