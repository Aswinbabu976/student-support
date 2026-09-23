import { describe, expect, it } from 'vitest';
import { PricingService } from './pricing.service.js';
import { roundDiv } from './pricing.money.js';
import { ErrorCode } from '../../shared/errors.js';

const pricingService = new PricingService();

describe('roundDiv', () => {
  it('rounds halves away from zero for positive integers', () => {
    expect(roundDiv(5, 2)).toBe(3);
    expect(roundDiv(4, 2)).toBe(2);
    expect(roundDiv(1500, 60)).toBe(25);
  });
});

describe('PricingService', () => {
  it('uses estimated hours × base rate + platform fee in minor units', () => {
    const estimate = pricingService.estimateFromDurationMinutes(180);
    expect(estimate).toEqual({
      currency: 'EUR',
      estimatedDurationMinutes: 180,
      estimatedHours: 3,
      baseHourlyRate: { amountMinor: 1500 },
      subtotal: { amountMinor: 4500 },
      platformFee: { amountMinor: 450 },
      total: { amountMinor: 4950 },
    });
  });

  it('keeps money in integer cents for fractional hours', () => {
    const estimate = pricingService.estimateFromDurationMinutes(90);
    expect(estimate.subtotal.amountMinor).toBe(2250);
    expect(estimate.platformFee.amountMinor).toBe(225);
    expect(estimate.total.amountMinor).toBe(2475);
    expect(estimate.estimatedHours).toBe(1.5);
  });

  it('rejects an invalid duration', () => {
    try {
      pricingService.estimateFromDurationMinutes(0);
      throw new Error('expected invalid duration');
    } catch (error) {
      expect(error).toMatchObject({
        code: ErrorCode.INVALID_DURATION,
        message: 'Add a valid estimated duration before calculating cost.',
      });
    }
  });
});
