import type { Request, Response } from 'express';
import { parseBookingId } from '../booking/booking.validation.js';
import type { PaymentService } from './payment.service.js';
import type { PaymentTimelineService } from './payment.timeline.service.js';
import { parseAuthorizePayment } from './payment.validation.js';

export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly paymentTimelineService: PaymentTimelineService,
  ) {}

  getByBooking = async (req: Request, res: Response): Promise<void> => {
    const bookingId = parseBookingId(String(req.params.bookingId));
    const payment = await this.paymentService.getForHelpSeeker(req.auth!.id, bookingId);
    res.status(200).json({ payment });
  };

  getTimeline = async (req: Request, res: Response): Promise<void> => {
    const bookingId = parseBookingId(String(req.params.bookingId));
    const paymentTimeline = await this.paymentTimelineService.getForStudent(
      req.auth!.id,
      bookingId,
    );
    res.status(200).json({ paymentTimeline });
  };

  authorize = async (req: Request, res: Response): Promise<void> => {
    const bookingId = parseBookingId(String(req.params.bookingId));
    const input = parseAuthorizePayment(req.body);
    const payment = await this.paymentService.authorizeForHelpSeeker(
      req.auth!.id,
      bookingId,
      input,
    );
    res.status(200).json({ payment });
  };
}
