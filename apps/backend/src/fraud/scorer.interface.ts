import { RiskLevel } from '@prisma/client';

/**
 * The schema `sentinel_fusion_ai` expects. Built by UnifiedEventBuilder and
 * passed to a Scorer. `country` is a weak feature here (India-only) — device,
 * IP, velocity and beneficiary-age signals carry the load (§9).
 */
export interface UnifiedEvent {
  eventType:
    | 'LOGIN'
    | 'BENEFICIARY_ADD'
    | 'BENEFICIARY_ACTIVATE'
    | 'PAYMENT_INITIATE'
    | 'PAYMENT_MODIFY'
    | 'VELOCITY';
  userId?: string;
  paymentId?: string;
  ip?: string;
  deviceFingerprint?: string;
  userAgent?: string;
  sessionId?: string;
  timestamp: string;
  amount?: number; // rupees
  rail?: string;
  beneficiaryAgeMinutes?: number;
  isNewBeneficiary?: boolean;
  txnCountLastHour?: number;
  amountVsUserMean?: number; // ratio
  nameMismatch?: boolean;
}

export interface RiskVerdict {
  riskScore: number; // 0..1
  riskLevel: RiskLevel;
  reasons: string[];
  modelScores?: Record<string, number>;
}

export const SCORER = Symbol('SCORER');

export interface Scorer {
  score(event: UnifiedEvent): Promise<RiskVerdict>;
}
