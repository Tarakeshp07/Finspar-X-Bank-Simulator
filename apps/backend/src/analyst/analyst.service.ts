import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Analyst dashboard data (§14). Reads whatever the scorer wrote to FraudEvent. */
@Injectable()
export class AnalystService {
  constructor(private readonly prisma: PrismaService) {}

  async stats() {
    const byLevel = await this.prisma.fraudEvent.groupBy({
      by: ['riskLevel'],
      _count: true,
    });
    const [totalEvents, openCases, held, blocked] = await Promise.all([
      this.prisma.fraudEvent.count(),
      this.prisma.case.count({ where: { status: 'OPEN' } }),
      this.prisma.payment.aggregate({ where: { status: 'HELD' }, _sum: { amount: true }, _count: true }),
      this.prisma.payment.aggregate({ where: { status: 'BLOCKED' }, _sum: { amount: true }, _count: true }),
    ]);
    const counts: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    for (const g of byLevel) counts[g.riskLevel] = g._count;
    return {
      totalEvents,
      openCases,
      byLevel: counts,
      heldCount: held._count,
      heldAmount: held._sum.amount ?? 0n,
      blockedCount: blocked._count,
      blockedAmount: blocked._sum.amount ?? 0n,
    };
  }

  async feed(limit = 30) {
    const events = await this.prisma.fraudEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        payment: { select: { refNo: true, amount: true, rail: true, beneficiary: { select: { name: true } } } },
      },
    });
    return events.map((e) => ({
      id: e.id,
      createdAt: e.createdAt,
      eventType: e.eventType,
      riskScore: e.riskScore,
      riskLevel: e.riskLevel,
      decision: e.decision,
      reasons: e.shapReasons ?? [],
      refNo: e.payment?.refNo ?? null,
      amount: e.payment?.amount ?? null,
      rail: e.payment?.rail ?? null,
      beneficiaryName: e.payment?.beneficiary?.name ?? null,
    }));
  }

  async cases() {
    const cases = await this.prisma.case.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return cases.map((c) => ({
      trackingRef: c.trackingRef,
      source: c.source,
      fraudType: c.fraudType,
      amount: c.amount,
      status: c.status,
      createdAt: c.createdAt,
    }));
  }
}
