import { useCallback, useEffect, useMemo, useState } from 'react';
import Badge from '../../components/Badge';
import { useToast } from '../../components/Toast';
import { Button } from '../../components/ui';
import { useActiveCompany } from '../../lib/useActiveCompany';
import { useRoleGuard } from '../../lib/useRoleGuard';
import {
  drawResultsList,
  drawsList,
  winningTicketsFindWinners,
} from '../../lib/api';
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
      const result = await drawsList(companyId);
      if (result.success) {
        const imported = result.draws.filter((draw) => draw.resultImported);
        setDraws(imported);
        setSelectedDrawId((current) => {
          if (current && imported.some((draw) => draw.id === current)) return current;
          return imported[0]?.id ?? null;
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
      const result = await drawResultsList(selectedDrawId);
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

  const handleFindWinners = async () => {
    if (selectedDrawId == null) {
      showToast('Select a draw with imported results first.', 'error');
      return;
    }
    setFinding(true);
    try {
      const result = await winningTicketsFindWinners(selectedDrawId);
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
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Draw Results</h1>
        <Button onClick={() => void handleFindWinners()} disabled={finding}>
          {finding ? 'Finding…' : 'Find Winners'}
        </Button>
      </div>

      <label className="mb-6 flex max-w-md flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">Select Draw</span>
        <select
          value={selectedDrawId ?? ''}
          onChange={(event) => setSelectedDrawId(Number(event.target.value) || null)}
          className="rounded border border-gray-300 bg-white px-3 py-2 text-sm"
          disabled={loading}
        >
          <option value="">Select a draw</option>
          {draws.map((draw) => (
            <option key={draw.id} value={draw.id}>
              {draw.name}
            </option>
          ))}
        </select>
      </label>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : selectedDrawId == null ? (
        <p className="text-sm text-gray-500">Select a draw with imported results.</p>
      ) : grouped.length === 0 ? (
        <p className="text-sm text-gray-500">No results for this draw.</p>
      ) : (
        <div className="space-y-6">
          {grouped.map(([level, levelResults]) => (
            <div key={level} className="rounded border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <h2 className="font-semibold text-gray-900">{PRIZE_LABELS[level] ?? `Prize ${level}`}</h2>
                <Badge label={`Level ${level}`} color="blue" />
              </div>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-600">
                    <th className="px-2 py-2">Prize Level</th>
                    <th className="px-2 py-2">Winning Number</th>
                    <th className="px-2 py-2">Prize Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {levelResults.map((result) => (
                    <tr key={result.id} className="border-b">
                      <td className="px-2 py-2">{result.prizeLevel}</td>
                      <td className="px-2 py-2 font-mono">{result.winningNumber}</td>
                      <td className="px-2 py-2 text-right">{formatAmount(result.prizeAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
