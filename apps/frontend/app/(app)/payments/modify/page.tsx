'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, Trash2, Pencil } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge, RiskBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Table, THead, TBody, TR, TH, TD, EmptyState } from '@/components/ui/Table';
import { PageHeader } from '@/components/PageHeader';
import { api, apiError } from '@/lib/api';
import { formatPaise, formatDateDMY } from '@/lib/format';

interface PaymentRow {
  id: string;
  refNo: string;
  custRefNo: string;
  amount: string;
  rail: string;
  paymentMode: string;
  status: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
  beneficiaryName: string;
  transactionDate: string;
  editable: boolean;
}

const statusTone = (s: string) =>
  s === 'COMPLETED' ? 'success' : s === 'BLOCKED' ? 'danger' : s === 'HELD' ? 'warning' : 'neutral';

export default function ModifyPaymentsPage() {
  const qc = useQueryClient();
  const [rail, setRail] = useState('');
  const [refNo, setRefNo] = useState('');
  const [applied, setApplied] = useState(false);
  const [toDelete, setToDelete] = useState<PaymentRow | null>(null);

  const { data, refetch } = useQuery<PaymentRow[]>({
    queryKey: ['payments', rail, refNo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (rail) params.set('rail', rail);
      if (refNo) params.set('refNo', refNo);
      return (await api.get(`/payments?${params}`)).data;
    },
    enabled: applied,
  });

  const del = async (): Promise<void> => {
    if (!toDelete) return;
    try {
      await api.delete(`/payments/${toDelete.id}`);
      toast.success('Payment deleted');
      setToDelete(null);
      qc.invalidateQueries({ queryKey: ['payments'] });
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Modify Payments" description="Edit or delete payments that are still editable." />
      <Card title="Filters">
        <div className="grid gap-4 md:grid-cols-3">
          <Input label="Reference Number" value={refNo} onChange={(e) => setRefNo(e.target.value)} />
          <Select label="Payment Mode" value={rail} onChange={(e) => setRail(e.target.value)}
            options={[{ value: '', label: 'All' }, { value: 'IFT', label: 'IFT' }, { value: 'IMPS', label: 'IMPS' }, { value: 'NEFT', label: 'NEFT' }, { value: 'RTGS', label: 'RTGS' }]} />
        </div>
        <div className="mt-4">
          <Button onClick={() => { setApplied(true); refetch(); }}><Search className="h-4 w-4" /> Search</Button>
        </div>
      </Card>

      <div className="mt-6">
        {!applied ? (
          <EmptyState message="Set filters and click Search." />
        ) : !data?.length ? (
          <EmptyState message="No payments found." />
        ) : (
          <Table>
            <THead>
              <TH>Actions</TH>
              <TH>Reference Number</TH>
              <TH numeric>Amount</TH>
              <TH>Cust Ref</TH>
              <TH>Date</TH>
              <TH>Mode</TH>
              <TH>Status</TH>
              <TH numeric>Risk</TH>
            </THead>
            <TBody>
              {data.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <div className="flex gap-2">
                      <button disabled={!p.editable} className="text-accent enabled:hover:underline disabled:opacity-30" title="Edit"><Pencil className="h-4 w-4" /></button>
                      <button disabled={!p.editable} onClick={() => setToDelete(p)} className="text-risk-critical enabled:hover:underline disabled:opacity-30" title="Delete"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </TD>
                  <TD className="tabular">{p.refNo}</TD>
                  <TD numeric>{formatPaise(p.amount)}</TD>
                  <TD className="tabular text-xs">{p.custRefNo}</TD>
                  <TD className="tabular">{formatDateDMY(p.transactionDate)}</TD>
                  <TD className="text-xs">{p.rail}</TD>
                  <TD><Badge tone={statusTone(p.status)}>{p.status}</Badge></TD>
                  <TD numeric>{p.riskLevel ? <RiskBadge level={p.riskLevel} /> : '—'}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Delete payment?"
        footer={<><Button variant="ghost" onClick={() => setToDelete(null)}>Cancel</Button><Button variant="danger" onClick={del}>Delete</Button></>}>
        <p className="text-sm text-text-muted">Soft-delete {toDelete?.refNo}? The record is retained for audit.</p>
      </Modal>
    </div>
  );
}
