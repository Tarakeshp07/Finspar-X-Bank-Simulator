'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, ShieldX, PauseCircle, FolderOpen } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { RiskBadge, Badge } from '@/components/ui/Badge';
import { Table, THead, TBody, TR, TH, TD, EmptyState } from '@/components/ui/Table';
import { PageHeader } from '@/components/PageHeader';
import { api } from '@/lib/api';
import { formatPaise, formatDateTimeDMY } from '@/lib/format';

interface Stats {
  totalEvents: number; openCases: number;
  byLevel: Record<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', number>;
  heldCount: number; heldAmount: string; blockedCount: number; blockedAmount: string;
}
interface FeedRow {
  id: string; createdAt: string; eventType: string; riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; decision: string;
  reasons: string[]; refNo: string | null; amount: string | null; rail: string | null; beneficiaryName: string | null;
}

export default function AnalystDashboardPage() {
  const { data: stats } = useQuery<Stats>({
    queryKey: ['analyst-stats'],
    queryFn: async () => (await api.get('/analyst/stats')).data,
    refetchInterval: 4000,
  });
  const { data: feed } = useQuery<FeedRow[]>({
    queryKey: ['analyst-feed'],
    queryFn: async () => (await api.get('/analyst/feed')).data,
    refetchInterval: 4000,
  });
  const { data: cases } = useQuery<any[]>({
    queryKey: ['analyst-cases'],
    queryFn: async () => (await api.get('/analyst/cases')).data,
    refetchInterval: 8000,
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Analyst Dashboard"
        description="Live fraud signals from the decision gateway."
        actions={<Badge tone="info"><Activity className="h-3 w-3" /> live</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<Activity className="h-5 w-5 text-accent" />} label="Total events" value={stats?.totalEvents ?? 0} />
        <Stat icon={<FolderOpen className="h-5 w-5 text-risk-medium" />} label="Open cases" value={stats?.openCases ?? 0} />
        <Stat icon={<PauseCircle className="h-5 w-5 text-risk-high" />} label="Held" value={stats?.heldCount ?? 0} sub={stats ? formatPaise(stats.heldAmount) : ''} />
        <Stat icon={<ShieldX className="h-5 w-5 text-risk-critical" />} label="Blocked" value={stats?.blockedCount ?? 0} sub={stats ? formatPaise(stats.blockedAmount) : ''} />
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((lvl) => (
          <div key={lvl} className="rounded-[var(--radius-card)] border border-border bg-surface p-3 text-center">
            <RiskBadge level={lvl} />
            <p className="mt-2 text-xl font-semibold tabular text-text">{stats?.byLevel?.[lvl] ?? 0}</p>
          </div>
        ))}
      </div>

      <Card title="Live transaction feed" className="mt-6">
        {!feed?.length ? (
          <EmptyState message="No fraud events yet. Initiate a payment to see scoring stream in." />
        ) : (
          <div className="space-y-2">
            {feed.map((e) => (
              <div key={e.id} className="flex items-start gap-3 rounded-[var(--radius-input)] border border-border p-3">
                <RiskBadge level={e.riskLevel} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium text-text">{e.beneficiaryName ?? e.eventType}</span>
                    {e.amount && <span className="tabular text-text-muted">{formatPaise(e.amount)}</span>}
                    {e.rail && <Badge>{e.rail}</Badge>}
                    <Badge tone={e.decision === 'BLOCK' ? 'danger' : e.decision === 'HOLD' ? 'warning' : 'neutral'}>{e.decision}</Badge>
                    <span className="ml-auto tabular text-xs text-text-muted">{formatDateTimeDMY(e.createdAt)}</span>
                  </div>
                  {e.reasons?.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {e.reasons.map((r, i) => (
                        <span key={i} className="rounded-full border border-border px-2 py-0.5 text-xs text-text-muted">{r}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Cases" className="mt-6">
        {!cases?.length ? (
          <EmptyState message="No cases raised." />
        ) : (
          <Table>
            <THead>
              <TH>Tracking Ref</TH>
              <TH>Source</TH>
              <TH>Type</TH>
              <TH numeric>Amount</TH>
              <TH>Status</TH>
              <TH>Created</TH>
            </THead>
            <TBody>
              {cases.map((c) => (
                <TR key={c.trackingRef}>
                  <TD className="tabular">{c.trackingRef}</TD>
                  <TD><Badge tone={c.source === 'AI_FLAGGED' ? 'info' : 'neutral'}>{c.source}</Badge></TD>
                  <TD className="text-xs">{c.fraudType ?? '—'}</TD>
                  <TD numeric>{c.amount ? formatPaise(c.amount) : '—'}</TD>
                  <TD><Badge tone={c.status === 'OPEN' ? 'warning' : 'success'}>{c.status}</Badge></TD>
                  <TD className="tabular">{formatDateTimeDMY(c.createdAt)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-sm text-text-muted">{icon}{label}</div>
      <p className="mt-2 text-2xl font-semibold tabular text-text">{value}</p>
      {sub && <p className="text-xs tabular text-text-muted">{sub}</p>}
    </div>
  );
}
