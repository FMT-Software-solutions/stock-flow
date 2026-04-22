export interface SmsBalance {
  organization_id: string;
  credit_balance: number;
  bonus_credits_received: number;
  updated_at: string;
}

export interface SmsTransaction {
  id: string;
  organization_id: string;
  type: 'purchase' | 'usage' | 'bonus';
  amount: number;
  description: string;
  metadata: any;
  created_at: string;
}

export interface SmsPurchaseTier {
  amountGhs: number;
  credits: number;
}

// Fixed Purchase Tiers
export const SMS_PURCHASE_TIERS: SmsPurchaseTier[] = [
  { amountGhs: 20, credits: Math.floor(20 / 0.048) },
  { amountGhs: 40, credits: Math.floor(40 / 0.048) },
  { amountGhs: 50, credits: Math.floor(50 / 0.048) },
  { amountGhs: 60, credits: Math.floor(60 / 0.048) },
  { amountGhs: 80, credits: Math.floor(80 / 0.048) },
  { amountGhs: 100, credits: Math.floor(100 / 0.048) },
  { amountGhs: 150, credits: Math.floor(150 / 0.048) },
  { amountGhs: 200, credits: Math.floor(200 / 0.048) },
  { amountGhs: 500, credits: Math.floor(500 / 0.048) },
  { amountGhs: 1000, credits: Math.floor(1000 / 0.048) },
  { amountGhs: 2000, credits: Math.floor(2000 / 0.048) },
  { amountGhs: 5000, credits: Math.floor(5000 / 0.048) },
];