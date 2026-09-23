export type MoneyMinor = {
  amountMinor: number;
};

export type CostEstimate = {
  currency: string;
  estimatedDurationMinutes: number;
  estimatedHours: number;
  baseHourlyRate: MoneyMinor;
  subtotal: MoneyMinor;
  platformFee: MoneyMinor;
  total: MoneyMinor;
};

export type CostEstimateResponse = {
  estimate: CostEstimate;
};
