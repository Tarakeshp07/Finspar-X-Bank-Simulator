'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Stepper } from '@/components/ui/Stepper';
import { PageHeader } from '@/components/PageHeader';
import { api, apiError } from '@/lib/api';

const RAILS = ['IFT', 'RTGS', 'NEFT', 'IMPS'] as const;
type Rail = (typeof RAILS)[number];

interface Form {
  code: string;
  name: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifsc: string;
  state: string;
  city: string;
  email: string;
  phone: string;
}

const EMPTY: Form = {
  code: '', name: '', accountNumber: '', confirmAccountNumber: '',
  ifsc: '', state: '', city: '', email: '', phone: '',
};

export default function BeneficiaryMaintenancePage() {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [rails, setRails] = useState<Set<Rail>>(new Set());
  const [form, setForm] = useState<Form>(EMPTY);
  const [fetchedName, setFetchedName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const nonIft = rails.has('RTGS') || rails.has('NEFT') || rails.has('IMPS');
  const set = (k: keyof Form, v: string): void => setForm((f) => ({ ...f, [k]: v }));
  const toggleRail = (r: Rail): void =>
    setRails((s) => {
      const next = new Set(s);
      next.has(r) ? next.delete(r) : next.add(r);
      return next;
    });

  const mismatch = fetchedName && form.name && fetchedName.toLowerCase() !== form.name.toLowerCase();

  const fetchBeneficiary = async (): Promise<void> => {
    if (!form.accountNumber) return void toast.error('Enter an account number first');
    try {
      const { data } = await api.post('/beneficiaries/fetch-name', {
        accountNumber: form.accountNumber,
        ifsc: form.ifsc,
      });
      setFetchedName(data.nameAsFetched);
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const validateAndNext = (): void => {
    if (!form.code || !form.name || !form.accountNumber) return void toast.error('Fill required fields');
    if (rails.size === 0) return void toast.error('Select at least one Beneficiary Type');
    if (nonIft && form.accountNumber !== form.confirmAccountNumber)
      return void toast.error('Account numbers do not match');
    if (nonIft && !form.ifsc) return void toast.error('IFSC is required for non-IFT types');
    setStep(1);
  };

  const submit = async (): Promise<void> => {
    setSubmitting(true);
    try {
      await api.post('/beneficiaries', {
        code: form.code,
        name: form.name,
        accountNumber: form.accountNumber,
        ifsc: form.ifsc || undefined,
        isOwnBank: rails.has('IFT') && !nonIft,
        allowIFT: rails.has('IFT'),
        allowRTGS: rails.has('RTGS'),
        allowNEFT: rails.has('NEFT'),
        allowIMPS: rails.has('IMPS'),
        state: form.state || undefined,
        city: form.city || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        nameAsFetched: fetchedName || undefined,
      });
      qc.invalidateQueries({ queryKey: ['beneficiaries'] });
      toast.success('Beneficiary added — pending activation');
      setStep(0);
      setForm(EMPTY);
      setRails(new Set());
      setFetchedName(null);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Beneficiary Maintenance" description="Add a payee. New beneficiaries need activation before use." />

      <div className="mb-6">
        <Stepper steps={['Initiate', 'Confirmation']} current={step} />
      </div>

      {step === 0 ? (
        <div className="space-y-6">
          <Card title="Beneficiary Details">
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Beneficiary Code" required value={form.code} onChange={(e) => set('code', e.target.value)} />
              <Input label="Beneficiary Name" required value={form.name} onChange={(e) => set('name', e.target.value)} />
              <Input label="State" value={form.state} onChange={(e) => set('state', e.target.value)} />
              <Input label="City" value={form.city} onChange={(e) => set('city', e.target.value)} />
              <Input label="Email ID" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
              <Input label="Phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
          </Card>

          <Card title="Transaction Type">
            <div className="flex flex-wrap gap-4">
              {RAILS.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm text-text">
                  <input type="checkbox" checked={rails.has(r)} onChange={() => toggleRail(r)} className="accent-primary" />
                  {r}
                </label>
              ))}
            </div>
          </Card>

          {nonIft && (
            <Card title="Bank Details" actions={<Button variant="outline" size="sm" onClick={fetchBeneficiary}><Search className="h-4 w-4" /> Fetch Beneficiary</Button>}>
              <div className="grid gap-4 md:grid-cols-2">
                <Input label="Account Number" required value={form.accountNumber} onChange={(e) => set('accountNumber', e.target.value)} />
                <Input label="Confirm Account Number" required value={form.confirmAccountNumber} onChange={(e) => set('confirmAccountNumber', e.target.value)} />
                <Input label="IFSC Code" required value={form.ifsc} onChange={(e) => set('ifsc', e.target.value.toUpperCase())} />
                {fetchedName && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-text">Beneficiary Name as Fetched</span>
                    <div className="flex h-10 items-center gap-2 rounded-[var(--radius-input)] border border-border bg-bg px-3 text-sm">
                      {fetchedName}
                      {mismatch && <Badge tone="danger"><AlertTriangle className="h-3 w-3" /> mismatch</Badge>}
                    </div>
                  </div>
                )}
              </div>
              {mismatch && (
                <p className="mt-3 text-xs text-risk-critical">
                  Fetched name differs from the entered name — this is flagged as a fraud signal.
                </p>
              )}
            </Card>
          )}

          {rails.has('IFT') && !nonIft && (
            <Card title="Own-bank Account">
              <div className="grid gap-4 md:grid-cols-2">
                <Input label="Account Number" required value={form.accountNumber} onChange={(e) => set('accountNumber', e.target.value)} />
                <Input label="Confirm Account Number" value={form.confirmAccountNumber} onChange={(e) => set('confirmAccountNumber', e.target.value)} />
              </div>
            </Card>
          )}

          <div className="flex gap-2">
            <Button onClick={validateAndNext}>Next</Button>
            <Button variant="ghost" onClick={() => { setForm(EMPTY); setRails(new Set()); setFetchedName(null); }}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Card title="Confirm beneficiary">
          <dl className="grid gap-3 text-sm md:grid-cols-2">
            <Detail label="Code" value={form.code} />
            <Detail label="Name" value={form.name} />
            <Detail label="Account Number" value={form.accountNumber} />
            <Detail label="IFSC" value={form.ifsc || '—'} />
            <Detail label="Rails" value={[...rails].join(', ')} />
            <Detail label="Name as Fetched" value={fetchedName || '—'} />
          </dl>
          <div className="mt-6 flex gap-2">
            <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
            <Button onClick={submit} disabled={submitting}>{submitting ? 'Saving…' : 'Confirm & Add'}</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-text-muted">{label}</dt>
      <dd className="font-medium text-text">{value}</dd>
    </div>
  );
}
