import type { Request, Response } from 'express';
import type { AvailabilityService } from './availability.service.js';
import {
  parseReplaceWeeklyAvailability,
  parseUnavailablePeriod,
  parseUpdateUnavailablePeriod,
} from './availability.validation.js';

export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  getMine = async (req: Request, res: Response): Promise<void> => {
    const availability = await this.availabilityService.getMine(req.auth!.id);
    res.status(200).json(availability);
  };

  replaceWeekly = async (req: Request, res: Response): Promise<void> => {
    const input = parseReplaceWeeklyAvailability(req.body);
    const availability = await this.availabilityService.replaceWeekly(req.auth!.id, input);
    res.status(200).json(availability);
  };

  addUnavailable = async (req: Request, res: Response): Promise<void> => {
    const input = parseUnavailablePeriod(req.body);
    const period = await this.availabilityService.addUnavailable(req.auth!.id, input);
    res.status(201).json({ period });
  };

  updateUnavailable = async (req: Request, res: Response): Promise<void> => {
    const availability = await this.availabilityService.getMine(req.auth!.id);
    const current = availability.unavailable.find(
      (period) => period.id === String(req.params.periodId),
    );
    const input = parseUpdateUnavailablePeriod(
      req.body,
      current ?? { startDate: '1970-01-01', endDate: '1970-01-01', reason: null },
    );
    const period = await this.availabilityService.updateUnavailable(
      req.auth!.id,
      String(req.params.periodId),
      input,
    );
    res.status(200).json({ period });
  };

  removeUnavailable = async (req: Request, res: Response): Promise<void> => {
    await this.availabilityService.removeUnavailable(
      req.auth!.id,
      String(req.params.periodId),
    );
    res.status(204).send();
  };
}
