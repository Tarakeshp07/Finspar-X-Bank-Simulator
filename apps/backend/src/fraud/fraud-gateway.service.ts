import { Injectable, Inject } from '@nestjs/common';
import { RiskLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SCORER, type Scorer, type UnifiedEvent, type RiskVerdict } from './scorer.interface';

export type Decision = 'EXECUTE' | 'CHALLENGE' | 'HOLD' | 'BLOCK';

export interface Assessment extends RiskVerdict {
  decision: Decision;
}

interface RequestContext {
  ip?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  sessionId?: string;
}

/**
 * Every state-changing money operation routes through here before the ledger is
 * touched (§9). Phase 1 wires a heuristic scorer behind the Scorer interface;
 * phase 2 swaps in HttpScorer -> FastAPI with no call-site changes.
 */
@Injectable()
export class FraudGateway {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SCORER) private readonly scorer: Scorer,
  ) {}

  private decide(level: RiskLevel): Decision {
    switch (level) {
      case RiskLevel.LOW:
        return 'EXECUTE';
      case RiskLevel.MEDIUM:
        return 'CHALLENGE';
      case RiskLevel.HIGH:
        return 'HOLD';
      case RiskLevel.CRITICAL:
        return 'BLOCK';
    }
  }

  /** Score a built event, persist a FraudEvent, return verdict + decision. */
  async assess(
    event: UnifiedEvent,
    ctx: { userId?: string; paymentId?: string; ip?: string; deviceFingerprint?: string },
  ): Promise<Assessment> {
    const verdict = await this.scorer.score(event);
    const decision = this.decide(verdict.riskLevel);

    await this.prisma.fraudEvent.create({
      data: {
        paymentId: ctx.paymentId,
        userId: ctx.userId,
        eventType: event.eventType,
        riskScore: verdict.riskScore,
        riskLevel: verdict.riskLevel,
        modelScores: verdict.modelScores ?? undefined,
        shapReasons: verdict.reasons,
        decision,
        ip: ctx.ip,
        deviceFingerprint: ctx.deviceFingerprint,
      },
    });

    return { ...verdict, decision };
  }

  /** Build a payment UnifiedEvent, pulling velocity / beneficiary-age / mean from the DB. */
  async buildPaymentEvent(params: {
    userId: string;
    customerId: string;
    paymentId?: string;
    amountPaise: bigint;
    rail: string;
    beneficiaryId: string;
    nameMismatch?: boolean;
    ctx: RequestContext;
    eventType?: 'PAYMENT_INITIATE' | 'PAYMENT_MODIFY';
  }): Promise<UnifiedEvent> {
    const amountRupees = Number(params.amountPaise) / 100;

    const [beneficiary, txnCountLastHour, agg] = await Promise.all([
      this.prisma.beneficiary.findUnique({ where: { id: params.beneficiaryId } }),
      this.prisma.payment.count({
        where: { customerId: params.customerId, createdAt: { gte: new Date(Date.now() - 3600_000) } },
      }),
      this.prisma.payment.aggregate({
        where: { customerId: params.customerId, status: 'COMPLETED' },
        _avg: { amount: true },
      }),
    ]);

    const meanRupees = agg._avg.amount ? Number(agg._avg.amount) / 100 : amountRupees;
    const beneficiaryAgeMinutes = beneficiary?.activatedAt
      ? (Date.now() - beneficiary.activatedAt.getTime()) / 60000
      : undefined;

    return {
      eventType: params.eventType ?? 'PAYMENT_INITIATE',
      userId: params.userId,
      paymentId: params.paymentId,
      ip: params.ctx.ip,
      deviceFingerprint: params.ctx.deviceFingerprint,
      userAgent: params.ctx.userAgent,
      sessionId: params.ctx.sessionId,
      timestamp: new Date().toISOString(),
      amount: amountRupees,
      rail: params.rail,
      beneficiaryAgeMinutes,
      isNewBeneficiary: beneficiaryAgeMinutes != null && beneficiaryAgeMinutes < 60,
      txnCountLastHour,
      amountVsUserMean: meanRupees > 0 ? amountRupees / meanRupees : 1,
      nameMismatch: params.nameMismatch,
    };
  }
}
