import { FormEvent, useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PRIZE_LABELS, parseResultTxt } from '../../shared/parseDrawResults';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { Button, PageHeader } from '../components/ui';
import { api } from '../lib/api';
import { useActiveCompany } from '../lib/useActiveCompany';
import { useRoleGuard } from '../lib/useRoleGuard';
import type { DrawRecord, DrawResultInput } from '../../shared/types';

type ManualRow = {
  prizeLevel: number;
  numbers: string;
  prizeAmount: string;
};

function defaultManualRows(): ManualRow[] {
  return [1, 2, 3, 4, 5].map((level) => ({
    prizeLevel: level,
    numbers: '',
    prizeAmount: '',
  }));
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB');
}

function manualRowsToResults(rows: ManualRow[]): DrawResultInput[] {
  const results: DrawResultInput[] = [];
  for (const row of rows) {
    const numbers = row.numbers
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    for (const winningNumber of numbers) {
      results.push({
        prizeLevel: row.prizeLevel,
        winningNumber,
        prizeAmount: row.prizeAmount ? Number(row.prizeAmount) : null,
      });
    }
  }
  return results;
}

export default function DrawResultsPage() {
  const allowed = useRoleGuard(['admin', 'owner', 'manager', 'supervisor']);
  const { companyId } = useActiveCompany();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { id } = useParams();
  const drawId = id != null && Number.isFinite(Number(id)) ? Number(id) : null;

  const [draw, setDraw] = useState<DrawRecord | null>(null);
  const [manualRows, setManualRows] = useState<ManualRow[]>(defaultManualRows());
  const [fileContent, setFileContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmReimport, setConfirmReimport] = useState(false);
  const [pendingResults, setPendingResults] = useState<DrawResultInput[]>([]);

  const load = useCallback(async () => {
    if (companyId == null || drawId == null) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [drawsResult, resultsResult] = await Promise.all([
        api.drawsList(companyId),
        api.drawResultsList(drawId),
      ]);
      if (drawsResult.success) {
        const found = drawsResult.draws.find((entry) => entry.id === drawId) ?? null;
        setDraw(found);
        if (!found) showToast('Draw not found.', 'error');
      } else {
        showToast(drawsResult.error, 'error');
      }
      if (resultsResult.success && resultsResult.results.length > 0) {
        const grouped = defaultManualRows().map((row) => {
          const levelResults = resultsResult.results.filter((r) => r.prizeLevel === row.prizeLevel);
          return {
            prizeLevel: row.prizeLevel,
            numbers: levelResults.map((r) => r.winningNumber).join('\n'),
            prizeAmount: levelResults[0]?.prizeAmount ?? '',
          };
        });
        setManualRows(grouped);
      }
    } catch {
      showToast('Failed to load draw.', 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, drawId, showToast]);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setFileContent(text);
      const parsed = parseResultTxt(text);
      if (parsed.length === 0) {
        showToast('No results found in file.', 'error');
        return;
      }
      const grouped = defaultManualRows().map((row) => ({
        ...row,
        numbers: parsed
          .filter((entry) => entry.prizeLevel === row.prizeLevel)
          .map((entry) => entry.winningNumber)
          .join('\n'),
      }));
      setManualRows(grouped);
      showToast(`Parsed ${parsed.length} winning number(s) from file.`, 'success');
    } catch {
      showToast('Failed to read file.', 'error');
    }
  };

  const runImport = async (results: DrawResultInput[]) => {
    if (drawId == null) return;
    setSaving(true);
    try {
      const result = await api.drawResultsCreate(drawId, results);
      if (result.success) {
        showToast('Results imported. Draw is now locked.', 'success');
        navigate('/draws');
      } else {
        showToast(result.error, 'error');
      }
    } catch {
      showToast('Failed to import results.', 'error');
    } finally {
      setSaving(false);
      setConfirmReimport(false);
      setPendingResults([]);
    }
  };

  const handleImport = async (event: FormEvent) => {
    event.preventDefault();
    if (drawId == null || draw == null) {
      showToast('Draw not found.', 'error');
      return;
    }

    let results = manualRowsToResults(manualRows);
    if (results.length === 0 && fileContent) {
      results = parseResultTxt(fileContent);
    }
    if (results.length === 0) {
      showToast('Enter at least one winning number.', 'error');
      return;
    }

    if (draw.resultImported) {
      setPendingResults(results);
      setConfirmReimport(true);
      return;
    }

    await runImport(results);
  };

  if (!allowed) return null;

  if (loading) {
    return (
      <div className="rounded-cyber-lg border border-dashed border-line-strong bg-surface-low py-12 text-center font-mono text-xs uppercase tracking-[0.05em] text-content-subtle" role="status">
        Loading draw…
      </div>
    );
  }

  if (drawId == null || draw == null) {
    return (
      <div className="space-y-4">
        <PageHeader
          eyebrow="Result processing"
          title="Import Draw Results"
          subtitle="Upload a result file or enter winning numbers manually."
          actions={
            <Button variant="secondary" onClick={() => navigate('/draws')}>
              ← Back to Draws
            </Button>
          }
        />
        <p className="rounded-cyber border border-cyber-error/40 bg-cyber-error/10 px-4 py-3 text-sm text-cyber-error">
          Draw not found or invalid draw ID.
        </p>
      </div>
    );
  }

  const formDisabled = saving;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Result processing"
        title="Import Draw Results"
        subtitle="Upload a result file or enter winning numbers manually."
        actions={
          <Button variant="secondary" onClick={() => navigate('/draws')}>
            ← Back to Draws
          </Button>
        }
      />
      {draw && (
        <div className="grid gap-px overflow-hidden rounded-cyber-lg border border-line bg-line sm:grid-cols-3">
          <div className="bg-surface-raised p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-content-subtle">Draw</p>
            <p className="mt-1 font-semibold text-content">{draw.name}</p>
          </div>
          <div className="bg-surface-raised p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-content-subtle">Date</p>
            <p className="mt-1 font-semibold text-content">{formatDate(draw.drawDate)}</p>
          </div>
          <div className="bg-surface-raised p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-content-subtle">Item</p>
            <p className="mt-1 font-semibold text-content">{draw.itemName ?? '—'}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleImport} className="space-y-4">
        <section className="rounded-cyber-lg border border-line bg-surface-raised p-4">
          <h2 className="font-display font-bold text-content">Upload result.txt</h2>
          <p className="mb-3 mt-1 text-sm text-content-subtle">Plain-text result files are parsed into the manual-entry grid.</p>
          <label htmlFor="draw-result-file" className="sr-only">Result text file</label>
          <input
            id="draw-result-file"
            type="file"
            accept=".txt,text/plain"
            onChange={handleFileChange}
            className="block w-full rounded-cyber border border-dashed border-line-control bg-canvas px-3 py-3 text-sm text-content file:mr-3 file:rounded-cyber file:border-0 file:bg-cyber-soft file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-content hover:border-cyber"
          />
        </section>

        <section className="rounded-cyber-lg border border-line bg-surface-raised p-4">
          <div className="mb-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-content-subtle">Five prize levels</p>
            <h2 className="font-display font-bold text-content">Manual Entry</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[720px] text-sm">
              <thead className="bg-surface-high">
                <tr className="border-b border-line text-left">
                  <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.05em] text-content-muted">Prize Level</th>
                  <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.05em] text-content-muted">Prize Label</th>
                  <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.05em] text-content-muted">Winning Numbers</th>
                  <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.05em] text-content-muted">Prize Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {manualRows.map((row, index) => (
                  <tr key={row.prizeLevel} className="border-b border-line align-top even:bg-surface-low">
                    <td className="px-3 py-3 font-mono text-cyber-hover">{row.prizeLevel}</td>
                    <td className="px-3 py-3 text-content-muted">{PRIZE_LABELS[row.prizeLevel]}</td>
                    <td className="px-3 py-3">
                      <textarea
                        rows={3}
                        value={row.numbers}
                        onChange={(event) => {
                          const next = [...manualRows];
                          next[index] = { ...row, numbers: event.target.value };
                          setManualRows(next);
                        }}
                        placeholder="One number per line"
                        aria-label={`Winning numbers for ${PRIZE_LABELS[row.prizeLevel]}`}
                        className="w-full min-w-[240px] rounded-cyber border border-line-control bg-canvas px-3 py-2 font-mono text-sm text-content outline-none placeholder:text-content-subtle focus:border-cyber focus:ring-2 focus:ring-cyber/20"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="number"
                        step="0.01"
                        value={row.prizeAmount}
                        onChange={(event) => {
                          const next = [...manualRows];
                          next[index] = { ...row, prizeAmount: event.target.value };
                          setManualRows(next);
                        }}
                        aria-label={`Prize amount for ${PRIZE_LABELS[row.prizeLevel]}`}
                        className="w-32 rounded-cyber border border-line-control bg-canvas px-3 py-2 text-left text-sm text-content outline-none focus:border-cyber focus:ring-2 focus:ring-cyber/20"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="flex justify-end border-t border-line pt-4">
          <Button type="submit" disabled={formDisabled}>
            {saving ? 'Importing…' : 'Import Results'}
          </Button>
        </div>
      </form>

      {confirmReimport ? (
        <ConfirmDialog
          message="This draw already has imported results. Importing again will replace them and re-lock the draw."
          confirmLabel="Re-import"
          onConfirm={() => void runImport(pendingResults)}
          onCancel={() => {
            setConfirmReimport(false);
            setPendingResults([]);
          }}
        />
      ) : null}
    </div>
  );
}
