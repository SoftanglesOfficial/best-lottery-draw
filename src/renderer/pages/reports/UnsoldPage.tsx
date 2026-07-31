import { useCallback, useEffect, useState } from 'react';
import ConfirmDialog from '../../components/ConfirmDialog';
import Table, { type TableColumn } from '../../components/Table';
import { useToast } from '../../components/Toast';
import { Button, PageHeader } from '../../components/ui';
import { api } from '../../lib/api';
import { useActiveCompany } from '../../lib/useActiveCompany';
import { useRoleGuard } from '../../lib/useRoleGuard';
import type { DrawRecord, ProviderRecord, UnsoldProviderPreview } from '../../../shared/types';

type FlatRow = UnsoldProviderPreview & {
  from: string;
  to: string;
  qty: number;
};

const selectClass =
  'rounded-cyber border border-line-control bg-canvas px-3 py-2 text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20';

export default function UnsoldPage() {
  const allowed = useRoleGuard(['admin', 'owner', 'manager', 'supervisor']);
  const { companyId } = useActiveCompany();
  const { showToast } = useToast();

  const [draws, setDraws] = useState<DrawRecord[]>([]);
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [drawId, setDrawId] = useState<number | ''>('');
  const [providerId, setProviderId] = useState<number | ''>('');
  const [rows, setRows] = useState<FlatRow[]>([]);
  const [totalTickets, setTotalTickets] = useState(0);
  const [loading, setLoading] = useState(false);
  const [returning, setReturning] = useState(false);
  const [confirmReturn, setConfirmReturn] = useState(false);

  useEffect(() => {
    if (!allowed || companyId == null) return;
    void (async () => {
      const [drawResult, providerResult] = await Promise.all([
        api.drawsList(companyId),
        api.providersList(companyId),
      ]);
      if (drawResult.success) {
        const open = drawResult.draws.filter((draw) => draw.status === 'open');
        setDraws(open);
        if (open.length === 1) setDrawId(open[0].id);
      }
      if (providerResult.success) setProviders(providerResult.providers);
    })();
  }, [allowed, companyId]);

  const loadPreview = useCallback(async () => {
    if (companyId == null || drawId === '') return;
    setLoading(true);
    try {
      const result = await api.transactionsUnsoldPreview(
        companyId,
        drawId,
        providerId === '' ? undefined : providerId,
      );
      if (!result.success) {
        showToast(result.error, 'error');
        setRows([]);
        setTotalTickets(0);
        return;
      }
      const flat: FlatRow[] = [];
      for (const provider of result.preview.providers) {
        for (const range of provider.ranges) {
          flat.push({ ...provider, ...range });
        }
      }
      setRows(flat);
      setTotalTickets(result.preview.totalTicketCount);
    } catch {
      showToast('Failed to load unsold preview.', 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, drawId, providerId, showToast]);

  useEffect(() => {
    if (allowed && companyId != null && drawId !== '') void loadPreview();
  }, [allowed, companyId, drawId, providerId, loadPreview]);

  const columns: TableColumn<FlatRow>[] = [
    { key: 'provider', header: 'Provider', render: (row) => row.providerName ?? `#${row.providerId}` },
    { key: 'from', header: 'From', render: (row) => row.from },
    { key: 'to', header: 'To', render: (row) => row.to },
    { key: 'qty', header: 'Qty', render: (row) => row.qty },
  ];

  const handleReturn = async () => {
    if (companyId == null || drawId === '') return;
    setReturning(true);
    try {
      const result = await api.transactionsUnsoldReturn(
        companyId,
        drawId,
        providerId === '' ? undefined : providerId,
      );
      if (result.success) {
        showToast(`Created ${result.count} purchase return memo(s).`, 'success');
        await loadPreview();
      } else {
        showToast(result.error, 'error');
        if (result.partialCount != null && result.partialCount > 0) {
          await loadPreview();
        }
      }
    } catch {
      showToast('Failed to return unsold tickets.', 'error');
    } finally {
      setReturning(false);
      setConfirmReturn(false);
    }
  };

  if (!allowed) return null;

  return (
    <div className="mx-auto max-w-6xl space-y-4 text-content">
      <PageHeader
        eyebrow="Reports"
        title="Unsold Tickets"
        subtitle="Preview purchased stock not covered by sales or bookings, then return in one step."
      />

      <div className="flex flex-wrap items-end gap-4 rounded-cyber-lg border border-line bg-surface-raised p-4">
        <label className="flex min-w-[220px] flex-col gap-1 text-sm">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">
            Draw
          </span>
          <select
            value={drawId}
            onChange={(event) => setDrawId(event.target.value ? Number(event.target.value) : '')}
            className={selectClass}
          >
            <option value="">Select draw…</option>
            {draws.map((draw) => (
              <option key={draw.id} value={draw.id}>
                {draw.name ?? 'Draw'} ({new Date(draw.drawDate).toLocaleDateString()})
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[200px] flex-col gap-1 text-sm">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">
            Provider
          </span>
          <select
            value={providerId}
            onChange={(event) =>
              setProviderId(event.target.value ? Number(event.target.value) : '')
            }
            className={selectClass}
          >
            <option value="">All providers</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void loadPreview()}
          disabled={loading || drawId === ''}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
        <Button
          type="button"
          onClick={() => setConfirmReturn(true)}
          disabled={returning || totalTickets <= 0 || drawId === ''}
        >
          Return unsold
        </Button>
      </div>

      <p className="text-sm text-content-muted">
        {totalTickets > 0
          ? `${totalTickets} unsold ticket(s) across ${new Set(rows.map((row) => row.providerId)).size} provider(s).`
          : drawId === ''
            ? 'Select a draw to preview unsold tickets.'
            : 'No unsold tickets for the selected scope.'}
      </p>

      <Table
        columns={columns}
        data={rows}
        rowKey={(row) => `${row.providerId}-${row.from}-${row.to}`}
      />

      {confirmReturn ? (
        <ConfirmDialog
          message={`Create purchase return memo(s) for ${totalTickets} ticket(s)?`}
          confirmLabel="Return"
          onConfirm={() => void handleReturn()}
          onCancel={() => setConfirmReturn(false)}
        />
      ) : null}
    </div>
  );
}
