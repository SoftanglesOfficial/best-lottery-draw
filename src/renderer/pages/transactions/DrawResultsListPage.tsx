import { useCallback, useEffect, useMemo, useState } from 'react';
import Badge from '../../components/Badge';
import { useToast } from '../../components/Toast';
import { Button } from '../../components/ui';
import { useActiveCompany } from '../../lib/useActiveCompany';
import { useRoleGuard } from '../../lib/useRoleGuard';
import { api } from '../../lib/api';
import type { DrawRecord, DrawResultRecord } from '../../../shared/types';

const PRIZE_LABELS: Record<number, string> = {
  1: '1st Prize',
  2: '2nd Prize',
  3: '3rd Prize',
  4: '4th Prize',
  5: '5th Prize',
};

function formatAmount(value: string | null | undefined) {
  if (value == null || value === '') return '—';
  return `₹${value}`;
}

export default function DrawResultsListPage() {
  const allowed = useRoleGuard(['admin', 'owner', 'manager', 'supervisor', 'data_entry']);
  const { companyId } = useActiveCompany();
  const { showToast } = useToast();

  const [draws, setDraws] = useState<DrawRecord[]>([]);
  const [selectedDrawId, setSelectedDrawId] = useState<number | null>(null);
  const [results, setResults] = useState<DrawResultRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [finding, setFinding] = useState(false);

  const loadDraws = useCallback(async () => {
    if (companyId == null) {
      setDraws([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await api.drawsList(companyId);
      if (result.success) {
        setDraws(result.draws);
        setSelectedDrawId((current) => {
          if (current && result.draws.some((draw) => draw.id === current)) return current;
          return result.draws[0]?.id ?? null;
        });
      } else {
        showToast(result.error, 'error');
      }
    } catch {
      showToast('Failed to load draws.', 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, showToast]);

  const loadResults = useCallback(async () => {
    if (selectedDrawId == null) {
      setResults([]);
      return;
    }
    try {
      const result = await api.drawResultsList(selectedDrawId);
      if (result.success) setResults(result.results);
      else showToast(result.error, 'error');
    } catch {
      showToast('Failed to load results.', 'error');
    }
  }, [selectedDrawId, showToast]);

  useEffect(() => {
    if (allowed) void loadDraws();
  }, [allowed, loadDraws]);

  useEffect(() => {
    if (allowed && selectedDrawId != null) void loadResults();
  }, [allowed, selectedDrawId, loadResults]);

  const grouped = useMemo(() => {
    const map = new Map<number, DrawResultRecord[]>();
    for (const result of results) {
      const list = map.get(result.prizeLevel) ?? [];
      list.push(result);
      map.set(result.prizeLevel, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [results]);

  const selectedDraw = draws.find((draw) => draw.id === selectedDrawId) ?? null;

  const handleFindWinners = async () => {
    if (selectedDrawId == null) {
      showToast('Select a draw first.', 'error');
      return;
    }
    if (!selectedDraw?.resultImported) {
      showToast('Import results for this draw on the Draws page first.', 'error');
      return;
    }
    setFinding(true);
    try {
      const result = await api.winningTicketsFindWinners(selectedDrawId);
      if (result.success) {
        showToast(`Found ${result.count} winning ticket(s).`, 'success');
      } else {
        showToast(result.error, 'error');
      }
    } catch {
      showToast('Failed to find winners.', 'error');
    } finally {
      setFinding(false);
    }
  };

  if (!allowed) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-cyber-hover">Result register</p>
          <h1 className="font-display text-2xl font-bold text-content">Draw Results</h1>
          <p className="mt-1 text-sm text-content-subtle">Review imported prize numbers by draw.</p>
        </div>
        <Button onClick={() => void handleFindWinners()} disabled={finding}>
          {finding ? 'Finding…' : 'Find Winners'}
        </Button>
      </div>

      <section className="rounded-cyber-lg border border-line bg-surface-raised p-4">
        <label className="flex max-w-md flex-col gap-1">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">Select Draw</span>
          <select
            value={selectedDrawId ?? ''}
            onChange={(event) => setSelectedDrawId(Number(event.target.value) || null)}
            className="rounded-cyber border border-line-control bg-canvas px-3 py-2 text-sm text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
            disabled={loading}
          >
            <option value="">Select a draw</option>
            {draws.map((draw) => (
              <option key={draw.id} value={draw.id}>
                {draw.name}
                {draw.resultImported ? '' : ' (no results imported)'}
              </option>
            ))}
          </select>
        </label>
      </section>

      {loading ? (
        <div className="rounded-cyber-lg border border-dashed border-line-strong bg-surface-low py-12 text-center font-mono text-xs uppercase tracking-[0.05em] text-content-subtle" role="status">Loading results…</div>
      ) : draws.length === 0 ? (
        <div className="rounded-cyber-lg border border-dashed border-line-strong bg-surface-low py-12 text-center text-sm text-content-subtle">No draws found. Create draws on the Draws page.</div>
      ) : selectedDrawId == null ? (
        <div className="rounded-cyber-lg border border-dashed border-line-strong bg-surface-low py-12 text-center text-sm text-content-subtle">Select a draw.</div>
      ) : !selectedDraw?.resultImported ? (
        <p className="rounded-cyber border border-cyber-warning/40 bg-cyber-warning/10 px-4 py-3 text-sm text-cyber-warning">
          Results not imported for this draw. Go to Draws and use Import Results.
        </p>
      ) : grouped.length === 0 ? (
        <div className="rounded-cyber-lg border border-dashed border-line-strong bg-surface-low py-12 text-center text-sm text-content-subtle">No results for this draw.</div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {grouped.map(([level, levelResults]) => (
            <section key={level} className="overflow-hidden rounded-cyber-lg border border-line bg-surface-raised">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 className="font-display font-bold text-content">{PRIZE_LABELS[level] ?? `Prize ${level}`}</h2>
                <Badge label={`Level ${level}`} color="blue" />
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[520px] w-full text-sm">
                  <thead className="bg-surface-high">
                    <tr className="border-b border-line text-left">
                      <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.05em] text-content-muted">Prize Level</th>
                      <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.05em] text-content-muted">Winning Number</th>
                      <th className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-[0.05em] text-content-muted">Prize Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {levelResults.map((result) => (
                      <tr key={result.id} className="even:bg-surface-low hover:bg-surface-high">
                        <td className="px-3 py-2 text-content-muted">{result.prizeLevel}</td>
                        <td className="px-3 py-2 font-mono font-medium text-cyber-hover">{result.winningNumber}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-content">{formatAmount(result.prizeAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
