import { FormEvent, useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PRIZE_LABELS, parseResultTxt } from '../../shared/parseDrawResults';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { Button } from '../components/ui';
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
    return <p className="text-sm text-gray-500">Loading…</p>;
  }

  if (drawId == null || draw == null) {
    return (
      <div>
        <div className="mb-6">
          <Button variant="secondary" onClick={() => navigate('/draws')}>
            ← Back to Draws
          </Button>
        </div>
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Import Draw Results</h1>
        <p className="text-sm text-gray-600">Draw not found or invalid draw ID.</p>
      </div>
    );
  }

  const formDisabled = saving;

  return (
    <div>
      <div className="mb-6">
        <Button variant="secondary" onClick={() => navigate('/draws')}>
          ← Back to Draws
        </Button>
      </div>

      <h1 className="mb-2 text-2xl font-bold text-gray-900">Import Draw Results</h1>
      {draw && (
        <div className="mb-6 rounded border border-gray-200 bg-white p-4 text-sm text-gray-700">
          <p>
            <span className="font-medium">Draw:</span> {draw.name}
          </p>
          <p>
            <span className="font-medium">Date:</span> {formatDate(draw.drawDate)}
          </p>
          <p>
            <span className="font-medium">Item:</span> {draw.itemName ?? '—'}
          </p>
        </div>
      )}

      <form onSubmit={handleImport} className="space-y-6">
        <div className="rounded border border-gray-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-gray-900">Upload result.txt</h2>
          <input
            type="file"
            accept=".txt,text/plain"
            onChange={handleFileChange}
            className="text-sm"
          />
        </div>

        <div className="rounded border border-gray-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-gray-900">Manual Entry</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-600">
                  <th className="px-2 py-2">Prize Level</th>
                  <th className="px-2 py-2">Prize Label</th>
                  <th className="px-2 py-2">Winning Numbers</th>
                  <th className="px-2 py-2">Prize Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {manualRows.map((row, index) => (
                  <tr key={row.prizeLevel} className="border-b align-top">
                    <td className="px-2 py-2">{row.prizeLevel}</td>
                    <td className="px-2 py-2">{PRIZE_LABELS[row.prizeLevel]}</td>
                    <td className="px-2 py-2">
                      <textarea
                        rows={3}
                        value={row.numbers}
                        onChange={(event) => {
                          const next = [...manualRows];
                          next[index] = { ...row, numbers: event.target.value };
                          setManualRows(next);
                        }}
                        placeholder="One number per line"
                        className="w-full min-w-[180px] rounded border border-gray-300 px-2 py-1 font-mono text-sm"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        step="0.01"
                        value={row.prizeAmount}
                        onChange={(event) => {
                          const next = [...manualRows];
                          next[index] = { ...row, prizeAmount: event.target.value };
                          setManualRows(next);
                        }}
                        className="w-28 rounded border border-gray-300 px-2 py-1 text-left text-sm"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <Button type="submit" disabled={formDisabled}>
          {saving ? 'Importing…' : 'Import Results'}
        </Button>
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
