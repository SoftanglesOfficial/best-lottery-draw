import { FormEvent, useCallback, useEffect, useState } from 'react';
import ConfirmDialog from '../../components/ConfirmDialog';
import { FullPageLoading } from '../../components/LoadingSpinner';
import Modal from '../../components/Modal';
import Table, { type TableColumn } from '../../components/Table';
import { useToast } from '../../components/Toast';
import { Button, Input, PageHeader } from '../../components/ui';
import { useActiveCompany } from '../../lib/useActiveCompany';
import { useRoleGuard } from '../../lib/useRoleGuard';
import { api } from '../../lib/api';
import type {
  BuyerRecord,
  DrawRecord,
  ItemRecord,
  SaleQuotaInput,
  SaleQuotaRecord,
} from '../../../shared/types';

function emptyForm(companyId: number): SaleQuotaInput {
  return {
    companyId,
    buyerId: 0,
    drawId: 0,
    itemId: 0,
    maxQty: 0,
  };
}

function itemIdForDraw(draw: DrawRecord | undefined, items: ItemRecord[], fallback = 0): number {
  if (draw?.itemId != null) return draw.itemId;
  if (fallback && items.some((item) => item.id === fallback)) return fallback;
  return items[0]?.id ?? 0;
}

function itemOptionsForDraw(draw: DrawRecord | undefined, items: ItemRecord[]): ItemRecord[] {
  if (draw?.itemId != null) return items.filter((item) => item.id === draw.itemId);
  return items;
}

export default function SaleQuotasPage() {
  const allowed = useRoleGuard(['admin', 'owner', 'manager']);
  const { companyId } = useActiveCompany();
  const { showToast } = useToast();
  const [quotas, setQuotas] = useState<SaleQuotaRecord[]>([]);
  const [buyers, setBuyers] = useState<BuyerRecord[]>([]);
  const [draws, setDraws] = useState<DrawRecord[]>([]);
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SaleQuotaRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SaleQuotaRecord | null>(null);
  const [form, setForm] = useState<SaleQuotaInput | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (companyId == null) {
      setQuotas([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [quotasResult, buyersResult, drawsResult, itemsResult] = await Promise.all([
        api.saleQuotasList(companyId),
        api.buyersList(companyId),
        api.drawsList(companyId),
        api.itemsList(companyId),
      ]);
      if (quotasResult.success) setQuotas(quotasResult.quotas);
      else showToast(quotasResult.error, 'error');
      if (buyersResult.success) setBuyers(buyersResult.buyers);
      if (drawsResult.success) setDraws(drawsResult.draws);
      if (itemsResult.success) setItems(itemsResult.items);
    } catch {
      showToast('Failed to load sale quotas.', 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    if (companyId == null) return;
    setEditing(null);
    const next = emptyForm(companyId);
    const firstDraw = draws[0];
    next.buyerId = buyers[0]?.id ?? 0;
    next.drawId = firstDraw?.id ?? 0;
    next.itemId = itemIdForDraw(firstDraw, items);
    setForm(next);
    setModalOpen(true);
  };

  const openEdit = (quota: SaleQuotaRecord) => {
    setEditing(quota);
    setForm({
      companyId: quota.companyId,
      buyerId: quota.buyerId,
      drawId: quota.drawId,
      itemId: quota.itemId,
      maxQty: quota.maxQty,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form || companyId == null) return;
    if (!form.buyerId || !form.drawId || !form.itemId) {
      showToast('Select buyer, draw, and item.', 'error');
      return;
    }
    if (form.maxQty < 0) {
      showToast('Max quantity cannot be negative.', 'error');
      return;
    }

    setSaving(true);
    try {
      const result = editing
        ? await api.saleQuotasUpdate(editing.id, form)
        : await api.saleQuotasCreate(form);
      if (result.success) {
        showToast(editing ? 'Quota updated' : 'Quota created');
        setModalOpen(false);
        void load();
      } else {
        showToast(result.error, 'error');
      }
    } catch {
      showToast('Failed to save quota.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const result = await api.saleQuotasDelete(deleteTarget.id);
      if (result.success) {
        showToast('Quota deleted');
        setDeleteTarget(null);
        void load();
      } else {
        showToast(result.error, 'error');
      }
    } catch {
      showToast('Failed to delete quota.', 'error');
    }
  };

  const columns: TableColumn<SaleQuotaRecord>[] = [
    { key: 'buyerName', header: 'Buyer', render: (row) => row.buyerName ?? '—' },
    { key: 'drawName', header: 'Draw', render: (row) => row.drawName ?? '—' },
    { key: 'itemName', header: 'Item', render: (row) => row.itemName ?? '—' },
    { key: 'maxQty', header: 'Max Qty', render: (row) => String(row.maxQty) },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-cyber px-1.5 py-1 text-cyber-hover outline-none hover:bg-cyber/10 focus-visible:ring-2 focus-visible:ring-cyber/40"
            onClick={() => openEdit(row)}
          >
            Edit
          </button>
          <button
            type="button"
            className="rounded-cyber px-1.5 py-1 text-cyber-error outline-none hover:bg-cyber-error/10 focus-visible:ring-2 focus-visible:ring-cyber-error/40"
            onClick={() => setDeleteTarget(row)}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  const selectedDraw = form ? draws.find((draw) => draw.id === form.drawId) : undefined;
  const itemOptions = itemOptionsForDraw(selectedDraw, items);

  if (!allowed) return null;

  if (companyId == null) {
    return (
      <div className="space-y-4">
        <PageHeader
          eyebrow="Master data"
          title="Sale Quotas"
          subtitle="Limit sale and booking quantity per buyer, draw, and item."
        />
        <div className="rounded-cyber-lg border border-dashed border-line-strong bg-surface-low px-6 py-12 text-center text-sm text-content-subtle">
          Select an active company to manage sale quotas.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Master data"
        title="Sale Quotas"
        subtitle="Limit sale and booking quantity per buyer, draw, and item. No row means unlimited."
        actions={
          <Button type="button" onClick={openCreate}>
            Add Quota
          </Button>
        }
      />

      {loading ? (
        <FullPageLoading message="Loading sale quotas…" />
      ) : (
        <Table columns={columns} data={quotas} rowKey={(row) => row.id} />
      )}

      {modalOpen && form ? (
        <Modal title={editing ? 'Edit Sale Quota' : 'Add Sale Quota'} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">
                Buyer
              </span>
              <select
                className="w-full rounded-cyber border border-line-control bg-canvas px-3 py-2 text-sm text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
                value={form.buyerId || ''}
                onChange={(e) => setForm({ ...form, buyerId: Number(e.target.value) })}
                required
              >
                <option value="">Select buyer</option>
                {buyers.map((buyer) => (
                  <option key={buyer.id} value={buyer.id}>
                    {buyer.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">
                Draw
              </span>
              <select
                className="w-full rounded-cyber border border-line-control bg-canvas px-3 py-2 text-sm text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
                value={form.drawId || ''}
                onChange={(e) => {
                  const drawId = Number(e.target.value);
                  const draw = draws.find((d) => d.id === drawId);
                  setForm({
                    ...form,
                    drawId,
                    itemId: itemIdForDraw(draw, items, form.itemId),
                  });
                }}
                required
              >
                <option value="">Select draw</option>
                {draws.map((draw) => (
                  <option key={draw.id} value={draw.id}>
                    {draw.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">
                Item
              </span>
              <select
                className="w-full rounded-cyber border border-line-control bg-canvas px-3 py-2 text-sm text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
                value={form.itemId || ''}
                onChange={(e) => setForm({ ...form, itemId: Number(e.target.value) })}
                required
              >
                <option value="">Select item</option>
                {itemOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Max quantity"
              type="number"
              min={0}
              value={form.maxQty}
              onChange={(e) => setForm({ ...form, maxQty: Number(e.target.value) })}
              required
            />
            <div className="mt-2 flex flex-wrap justify-end gap-3 border-t border-line pt-4">
              <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          message={`Delete quota for ${deleteTarget.buyerName ?? 'buyer'} / ${deleteTarget.drawName ?? 'draw'}?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          confirmLabel="Delete"
        />
      ) : null}
    </div>
  );
}
