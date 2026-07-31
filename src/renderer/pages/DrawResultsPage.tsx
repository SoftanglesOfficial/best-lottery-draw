import { FormEvent, useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatResultTxt, PRIZE_LABELS, parseResultTxt } from '../../shared/parseDrawResults';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { Button, Input, PageHeader } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useActiveCompany } from '../lib/useActiveCompany';
import { isAtLeastRole, isAdminOrOwner } from '../lib/roles';
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
  const { user } = useAuth();
  const { companyId } = useActiveCompany();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { id } = useParams();
  const drawId = id != null && Number.isFinite(Number(id)) ? Number(id) : null;
  const encryptedImportRef = useRef<HTMLInputElement>(null);

  const [draw, setDraw] = useState<DrawRecord | null>(null);
  const [manualRows, setManualRows] = useState<ManualRow[]>(defaultManualRows());
  const [fileContent, setFileContent] = useState('');
  const [hasResultKey, setHasResultKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmReimport, setConfirmReimport] = useState(false);
  const [confirmRotateKey, setConfirmRotateKey] = useState(false);
  const [pendingResults, setPendingResults] = useState<DrawResultInput[]>([]);
  const [pendingEncryptedImport, setPendingEncryptedImport] = useState<string | null>(null);
  const [lastGeneratedKey, setLastGeneratedKey] = useState('');
  const [existingKeyInput, setExistingKeyInput] = useState('');
  const canManageResultKey = user != null && isAtLeastRole(user.role, 'owner');
  const canImportEncrypted = user != null && isAtLeastRole(user.role, 'manager');
  const canPlainImport = user != null && isAdminOrOwner(user.role);

  const load = useCallback(async () => {
    if (companyId == null || drawId == null) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [drawsResult, resultsResult, keyStatus] = await Promise.all([
        api.drawsList(companyId),
        api.drawResultsList(drawId),
        api.resultKeyGetStatus(),
      ]);
      if (keyStatus.success) {
        setHasResultKey(keyStatus.hasKey);
      }
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
    if (!canPlainImport) {
      showToast('Plain import requires owner or admin. Use encrypted import.', 'error');
      return;
    }
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

  const resolvePlaintextForExport = (): string | null => {
    let results = manualRowsToResults(manualRows);
    if (results.length === 0 && fileContent) {
      results = parseResultTxt(fileContent);
    }
    if (results.length === 0) return null;
    return formatResultTxt(results);
  };

  const requireResultKey = () => {
    if (hasResultKey) return true;
    showToast('Company result key is not set. Ask an owner to set the key first.', 'error');
    return false;
  };

  const handleGenerateResultKey = async () => {
    setSaving(true);
    try {
      const result = await api.resultKeySet({ generate: true });
      if (result.success) {
        setHasResultKey(true);
        setLastGeneratedKey(result.keyBase64);
        setExistingKeyInput('');
        showToast('Result encryption key generated. Copy and share it with stockist installs.', 'success');
      } else {
        showToast(result.error, 'error');
      }
    } catch {
      showToast('Failed to set result key.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSetExistingKey = async () => {
    const keyBase64 = existingKeyInput.trim();
    if (!keyBase64) {
      showToast('Paste a base64 result key first.', 'error');
      return;
    }
    setSaving(true);
    try {
      const result = await api.resultKeySet({ keyBase64 });
      if (result.success) {
        setHasResultKey(true);
        setLastGeneratedKey(result.keyBase64);
        showToast('Result encryption key applied for this company.', 'success');
      } else {
        showToast(result.error, 'error');
      }
    } catch {
      showToast('Failed to set result key.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const copyResultKey = async () => {
    if (!lastGeneratedKey) return;
    try {
      await navigator.clipboard.writeText(lastGeneratedKey);
      showToast('Result key copied to clipboard.', 'success');
    } catch {
      showToast('Failed to copy result key.', 'error');
    }
  };

  const handleExportEncrypted = async () => {
    if (drawId == null || !requireResultKey()) return;
    const plainText = resolvePlaintextForExport();
    if (!plainText) {
      showToast('Enter at least one winning number before export.', 'error');
      return;
    }
    setSaving(true);
    try {
      const result = await api.drawResultsExportEncrypted(drawId, plainText);
      if (!result.success) {
        showToast(result.error, 'error');
        return;
      }
      const blob = new Blob([JSON.stringify(result.envelope, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `draw-${drawId}-results.b12r`;
      anchor.click();
      URL.revokeObjectURL(url);
      showToast('Encrypted result file downloaded.', 'success');
    } catch {
      showToast('Failed to export encrypted results.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const runEncryptedImport = async (envelopeJson: string) => {
    if (drawId == null) return;
    setSaving(true);
    try {
      const result = await api.drawResultsImportEncrypted(drawId, envelopeJson);
      if (result.success) {
        showToast('Encrypted results imported. Draw is now locked.', 'success');
        navigate('/draws');
      } else {
        showToast(result.error, 'error');
      }
    } catch {
      showToast('Failed to import encrypted results.', 'error');
    } finally {
      setSaving(false);
      setConfirmReimport(false);
      setPendingEncryptedImport(null);
    }
  };

  const handleEncryptedFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || drawId == null || draw == null) return;
    if (!requireResultKey()) return;
    try {
      const envelopeJson = await file.text();
      if (draw.resultImported) {
        setPendingEncryptedImport(envelopeJson);
        setConfirmReimport(true);
        return;
      }
      await runEncryptedImport(envelopeJson);
    } catch {
      showToast('Failed to read encrypted result file.', 'error');
    }
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

        {canManageResultKey || canImportEncrypted ? (
          <section className="rounded-cyber-lg border border-line bg-surface-raised p-4">
            <h2 className="font-display font-bold text-content">Encrypted results (.b12r)</h2>
            <p className="mb-3 mt-1 text-sm text-content-subtle">
              Export or import AES-256-GCM encrypted result files for distribution to stockists.
              {!hasResultKey ? ' A company result key must be set first.' : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              {canManageResultKey ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={formDisabled}
                  onClick={() => {
                    if (hasResultKey) {
                      setConfirmRotateKey(true);
                    } else {
                      void handleGenerateResultKey();
                    }
                  }}
                >
                  {hasResultKey ? 'Rotate result key' : 'Set result key'}
                </Button>
              ) : null}
              {canManageResultKey ? (
                <Button type="button" variant="secondary" disabled={formDisabled} onClick={() => void handleExportEncrypted()}>
                  Export encrypted (.b12r)
                </Button>
              ) : null}
              {canImportEncrypted ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={formDisabled}
                  onClick={() => encryptedImportRef.current?.click()}
                >
                  Import encrypted (.b12r)
                </Button>
              ) : null}
            </div>
            {canImportEncrypted ? (
              <input
                ref={encryptedImportRef}
                type="file"
                accept=".b12r,application/json"
                className="hidden"
                onChange={handleEncryptedFileChange}
              />
            ) : null}
            {canManageResultKey && lastGeneratedKey ? (
              <div className="mt-4 space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-content-subtle">
                  Company result key (base64)
                </p>
                <div className="flex flex-wrap items-end gap-2">
                  <input
                    type="text"
                    readOnly
                    value={lastGeneratedKey}
                    aria-label="Company result key"
                    className="min-w-0 flex-1 rounded-cyber border border-line-control bg-canvas px-3 py-2 font-mono text-xs text-content outline-none"
                  />
                  <Button type="button" variant="secondary" disabled={formDisabled} onClick={() => void copyResultKey()}>
                    Copy key
                  </Button>
                </div>
                <p className="text-xs text-content-subtle">
                  Share this key with stockist installs before sending encrypted .b12r files.
                </p>
              </div>
            ) : null}
            {canManageResultKey ? (
              <div className="mt-4 flex flex-wrap items-end gap-2">
                <div className="min-w-[280px] flex-1">
                  <Input
                    label="Set key from existing (base64)"
                    value={existingKeyInput}
                    onChange={(event) => setExistingKeyInput(event.target.value)}
                    placeholder="Paste shared key from owner install"
                    disabled={formDisabled}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={formDisabled || !existingKeyInput.trim()}
                  onClick={() => void handleSetExistingKey()}
                >
                  Apply existing key
                </Button>
              </div>
            ) : null}
          </section>
        ) : null}

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
          {canPlainImport ? (
            <Button type="submit" disabled={formDisabled}>
              {saving ? 'Importing…' : 'Import Results (owner)'}
            </Button>
          ) : (
            <p className="font-mono text-xs text-content-muted">
              Plain import is owner/admin only. Managers import encrypted .b12r files.
            </p>
          )}
        </div>
      </form>

      {confirmReimport ? (
        <ConfirmDialog
          message="This draw already has imported results. Importing again will replace them and re-lock the draw."
          confirmLabel="Re-import"
          onConfirm={() => {
            if (pendingEncryptedImport) {
              void runEncryptedImport(pendingEncryptedImport);
            } else {
              void runImport(pendingResults);
            }
          }}
          onCancel={() => {
            setConfirmReimport(false);
            setPendingResults([]);
            setPendingEncryptedImport(null);
          }}
        />
      ) : null}
      {confirmRotateKey ? (
        <ConfirmDialog
          message="Rotating the result key overwrites the current key. Any .b12r files exported under the old key (and not yet imported elsewhere) will become permanently undecryptable. Continue?"
          confirmLabel="Rotate key"
          onConfirm={() => {
            setConfirmRotateKey(false);
            void handleGenerateResultKey();
          }}
          onCancel={() => setConfirmRotateKey(false)}
        />
      ) : null}
    </div>
  );
}
