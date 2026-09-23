import type { TasksService } from '../tasks/tasks.service.js';
import type { PricingService } from './pricing.service.js';
import type { CostEstimate } from './pricing.types.js';

export class TaskPricingService {
  constructor(
    private readonly tasksService: TasksService,
    private readonly pricingService: PricingService,
  ) {}

  async estimateForOwnedTask(userId: string, taskId: string): Promise<CostEstimate> {
    const task = await this.tasksService.getOwned(userId, taskId);
    return this.pricingService.estimateFromDurationMinutes(task.estimatedDurationMinutes);
  }
}
