import type { Request, Response } from 'express';
import type { BookingExecutionService } from './booking.execution.service.js';
import type { BookingService } from './booking.service.js';
import {
  parseAcceptBooking,
  parseBookingId,
  parseConfirmCompletion,
  parseCreateBooking,
  parseMarkDone,
  parseRejectBooking,
  parseStartBooking,
  parseTaskId,
} from './booking.validation.js';

export class BookingController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly executionService: BookingExecutionService,
  ) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const taskId = parseTaskId(String(req.params.taskId));
    const input = parseCreateBooking(req.body);
    const booking = await this.bookingService.createRequest(req.auth!.id, taskId, input.studentId);
    res.status(201).json({
      booking,
      message: 'Booking request sent.',
    });
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const bookingId = parseBookingId(String(req.params.bookingId));
    const booking = await this.bookingService.getById(req.auth!.id, bookingId);
    res.status(200).json({ booking });
  };

  accept = async (req: Request, res: Response): Promise<void> => {
    parseAcceptBooking(req.body);
    const bookingId = parseBookingId(String(req.params.bookingId));
    const booking = await this.bookingService.accept(req.auth!.id, bookingId);
    res.status(200).json({
      booking,
      message: 'Booking accepted.',
    });
  };

  reject = async (req: Request, res: Response): Promise<void> => {
    const input = parseRejectBooking(req.body);
    const bookingId = parseBookingId(String(req.params.bookingId));
    const booking = await this.bookingService.reject(req.auth!.id, bookingId, input.reason);
    res.status(200).json({
      booking,
      message: 'Booking rejected.',
    });
  };

  start = async (req: Request, res: Response): Promise<void> => {
    parseStartBooking(req.body);
    const bookingId = parseBookingId(String(req.params.bookingId));
    const booking = await this.executionService.start(req.auth!.id, bookingId);
    res.status(200).json({
      booking,
      message: 'Task started.',
    });
  };

  markDone = async (req: Request, res: Response): Promise<void> => {
    parseMarkDone(req.body);
    const bookingId = parseBookingId(String(req.params.bookingId));
    const booking = await this.executionService.markDone(req.auth!.id, bookingId);
    res.status(200).json({
      booking,
      message: 'Task submitted for confirmation.',
    });
  };

  confirmCompletion = async (req: Request, res: Response): Promise<void> => {
    parseConfirmCompletion(req.body);
    const bookingId = parseBookingId(String(req.params.bookingId));
    const booking = await this.executionService.confirmCompletion(req.auth!.id, bookingId);
    res.status(200).json({
      booking,
      message: 'Task completion confirmed.',
    });
  };
}
