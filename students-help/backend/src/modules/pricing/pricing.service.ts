import { invalidDuration, pricingConfigurationError } from '../../shared/errors.js';
import {
  BASE_HOURLY_RATE_MINOR,
  BPS_DENOMINATOR,
  PLATFORM_FEE_BPS,
  PRICING_CURRENCY,
  PRICING_DURATION_MAX_MINUTES,
  PRICING_DURATION_MIN_MINUTES,
} from './pricing.config.js';
import { roundDiv } from './pricing.money.js';
import type { CostEstimate } from './pricing.types.js';

export class PricingService {
  estimateFromDurationMinutes(estimatedDurationMinutes: number): CostEstimate {
    if (
      !Number.isInteger(estimatedDurationMinutes) ||
      estimatedDurationMinutes < PRICING_DURATION_MIN_MINUTES ||
      estimatedDurationMinutes > PRICING_DURATION_MAX_MINUTES
    ) {
      throw invalidDuration('Add a valid estimated duration before calculating cost.');
    }
    if (BASE_HOURLY_RATE_MINOR <= 0 || PLATFORM_FEE_BPS < 0) {
      throw pricingConfigurationError();
    }

    const subtotalMinor = roundDiv(estimatedDurationMinutes * BASE_HOURLY_RATE_MINOR, 60);
    const platformFeeMinor = roundDiv(subtotalMinor * PLATFORM_FEE_BPS, BPS_DENOMINATOR);
    const estimatedHours = roundDiv(estimatedDurationMinutes * 100, 60) / 100;

    return {
      currency: PRICING_CURRENCY,
      estimatedDurationMinutes,
      estimatedHours,
      baseHourlyRate: { amountMinor: BASE_HOURLY_RATE_MINOR },
      subtotal: { amountMinor: subtotalMinor },
      platformFee: { amountMinor: platformFeeMinor },
      total: { amountMinor: subtotalMinor + platformFeeMinor },
    };
  }
}
