import type { Request, Response } from 'express';
import type { TasksService } from './tasks.service.js';
import { parseCreateTask } from './tasks.validation.js';

export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const input = parseCreateTask(req.body);
    const task = await this.tasksService.create(req.auth!.id, input);
    res.status(201).json({ task });
  };

  getOwned = async (req: Request, res: Response): Promise<void> => {
    const task = await this.tasksService.getOwned(req.auth!.id, String(req.params.taskId));
    res.status(200).json({ task });
  };
}
