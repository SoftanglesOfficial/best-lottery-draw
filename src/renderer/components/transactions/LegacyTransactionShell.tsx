import { FormEvent, ReactNode, RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import type { DrawRecord } from '../../../shared/types';

export type LegacyPartyOption = { id: number; name: string; detail?: string };

const actionBtn =
  'cursor-pointer border border-[#ffdf63] bg-[#f1b900] px-4 py-2 text-[11px] font-extrabold uppercase tracking-wide text-[#10275e] shadow-[0_2px_0_#745600] hover:bg-[#ffd447] focus:outline-none focus:ring-2 focus:ring-[#ffd447] disabled:cursor-not-allowed disabled:opacity-60';

export type LegacyShellAccent = 'blue' | 'orange';

type LegacyTransactionShellProps = {
  formRef: RefObject<HTMLFormElement | null>;
  pageTitle: string;
  centerTitle: string;
  contextLabel?: string;
  partyLabel?: string;
  accent?: LegacyShellAccent;
  memoId: number | null;
  entryDate: string;
  onEntryDateChange: (value: string) => void;
  voucherNo?: string;
  onVoucherNoChange?: (value: string) => void;
  partyId: number | null;
  onPartyIdChange: (value: number | null) => void;
  parties: LegacyPartyOption[];
  drawId: number | null;
  onDrawIdChange: (value: number | null) => void;
  draws: DrawRecord[];
  alerts?: ReactNode;
  statusBanner?: ReactNode;
  children: ReactNode;
  rowCount: number;
  activeRowIndex: number;
  totalQty: number;
  totalAmount?: number | null;
  saving: boolean;
  saveLabel: string;
  disabled?: boolean;
  shortcuts?: string[];
  extraActions?: { label: string; onClick: () => void; shortcut?: string }[];
  onSubmit: (event: FormEvent) => void;
  onDeleteRow: () => void;
  onClear: () => void;
  onSearch?: () => void;
  printShortcut?: string;
  partyFocusRequest?: number;
  partyListOpenRef?: RefObject<boolean>;
  drawFocusRequest?: number;
  onRequestCreateParty?: (name: string) => void;
};

function filterParties(parties: LegacyPartyOption[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return parties;
  const starts = parties.filter((party) => party.name.toLowerCase().startsWith(q));
  const contains = parties.filter(
    (party) =>
      !party.name.toLowerCase().startsWith(q) && party.name.toLowerCase().includes(q),
  );
  return [...starts, ...contains];
}

export default function LegacyTransactionShell({
  formRef,
  pageTitle,
  centerTitle,
  contextLabel,
  partyLabel = 'Party Name *',
  accent = 'blue',
  memoId,
  entryDate,
  onEntryDateChange,
  voucherNo,
  onVoucherNoChange,
  partyId,
  onPartyIdChange,
  parties,
  drawId,
  onDrawIdChange,
  draws,
  alerts,
  statusBanner,
  children,
  rowCount,
  activeRowIndex,
  totalQty,
  totalAmount = null,
  saving,
  saveLabel,
  disabled = false,
  shortcuts,
  extraActions = [],
  onSubmit,
  onDeleteRow,
  onClear,
  onSearch,
  printShortcut = 'F12',
  partyFocusRequest = 0,
  partyListOpenRef,
  drawFocusRequest = 0,
  onRequestCreateParty,
}: LegacyTransactionShellProps) {
  const navigate = useNavigate();
  const { activeShift, activeCompanyName } = useAuth();
  const partyInputRef = useRef<HTMLInputElement>(null);
  const drawSelectRef = useRef<HTMLSelectElement>(null);
  const [partyQuery, setPartyQuery] = useState('');
  const [partyOpen, setPartyOpen] = useState(false);
  const [partyHighlight, setPartyHighlight] = useState(0);

  const selectedParty = parties.find((party) => party.id === partyId) ?? null;
  const filteredParties = useMemo(
    () => filterParties(parties, partyQuery),
    [parties, partyQuery],
  );

  useEffect(() => {
    if (selectedParty) setPartyQuery(selectedParty.name);
  }, [selectedParty?.id, selectedParty?.name]);

  useEffect(() => {
    if (partyListOpenRef) partyListOpenRef.current = partyOpen;
  }, [partyOpen, partyListOpenRef]);

  useEffect(() => {
    if (partyFocusRequest > 0) {
      partyInputRef.current?.focus();
      partyInputRef.current?.select();
    }
  }, [partyFocusRequest]);

  useEffect(() => {
    if (drawFocusRequest > 0) {
      drawSelectRef.current?.focus();
    }
  }, [drawFocusRequest]);

  const now = new Date();
  const clockLabel = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
  const dateLabel = now.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
  const footerDate = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const subBarClass =
    accent === 'orange'
      ? 'border-b border-[#ff8f63] bg-gradient-to-b from-[#c2410c] to-[#9a3412]'
      : 'border-b border-[#5e8ddd] bg-[#0b2e83]';
  const centerTitleClass =
    accent === 'orange'
      ? 'px-4 text-sm font-extrabold uppercase tracking-[0.08em] text-[#ffedd5]'
      : 'px-4 text-sm font-extrabold uppercase tracking-[0.08em] text-white';
  const defaultShortcuts = [
    'F2 Save',
    'F5 Delete Row',
    'F7 Search',
    'F8 Clear',
    'Enter Add Row',
    'Esc Exit',
    `${printShortcut} Print`,
  ];

  const pickParty = (party: LegacyPartyOption) => {
    onPartyIdChange(party.id);
    setPartyQuery(party.name);
    setPartyOpen(false);
  };

  const requestCreateIfUnmatched = () => {
    const name = partyQuery.trim();
    if (!name || partyId != null || filteredParties.length > 0) return false;
    if (!onRequestCreateParty) return false;
    setPartyOpen(false);
    onRequestCreateParty(name);
    return true;
  };

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        if (partyOpen) {
          event.preventDefault();
          return;
        }
        onSubmit(event);
      }}
      className="flex h-full min-h-[720px] flex-col overflow-hidden bg-[#06154d] font-sans text-white"
    >
      <header className="flex h-14 shrink-0 items-center justify-between border-b-2 border-[#78a5f2] bg-gradient-to-b from-[#2462d4] to-[#0e3d9e] px-4 shadow-[inset_0_-1px_0_#082969]">
        <div className="flex min-w-0 items-center gap-3">
          <div className="shrink-0 border-r border-[#75a2ef] pr-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#c8dcff]">
              {activeCompanyName ?? 'Best-12'} · Morning Booking
            </p>
            <h1 className="text-lg font-extrabold uppercase tracking-[0.04em] text-white">{pageTitle}</h1>
          </div>
          {contextLabel ? (
            <p className="truncate text-xs font-semibold text-[#d9e7ff]">{contextLabel}</p>
          ) : null}
        </div>
        <p className="hidden font-mono text-sm font-bold tabular-nums text-[#ffe16a] lg:block">{clockLabel}</p>
        <nav className="flex shrink-0 items-center gap-2" aria-label="Transaction entry navigation">
          <button
            type="button"
            onClick={() => navigate('/menu')}
            className="cursor-pointer border border-[#9bbcf5] bg-[#123b92] px-3 py-1 text-[11px] font-bold uppercase text-white hover:bg-[#1a4aaa] focus:ring-2 focus:ring-[#ffd447]"
          >
            Menu
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="cursor-pointer border border-[#9bbcf5] bg-[#123b92] px-3 py-1 text-[11px] font-bold uppercase text-white hover:bg-[#1a4aaa] focus:ring-2 focus:ring-[#ffd447]"
          >
            Exit
          </button>
        </nav>
      </header>

      <div className={`grid h-9 shrink-0 grid-cols-[1fr_auto_1fr] items-center px-4 ${subBarClass}`}>
        <p className="truncate text-xs font-semibold text-[#c7dcff]">
          {draws.find((draw) => draw.id === drawId)?.name ?? 'Select draw'}
        </p>
        <p className={centerTitleClass}>{centerTitle}</p>
        <p className="text-right font-mono text-xs tabular-nums text-[#d9e7ff]">
          {dateLabel} {clockLabel}
        </p>
      </div>

      <div
        className="flex h-7 shrink-0 items-center gap-4 overflow-x-auto border-b border-[#416db9] bg-[#08266f] px-4 font-mono text-[10px] uppercase tracking-[0.06em] text-[#bcd5ff] whitespace-nowrap"
        aria-label="Keyboard shortcuts"
      >
        {(shortcuts ?? defaultShortcuts).map((shortcut) => (
          <span key={shortcut}>{shortcut}</span>
        ))}
      </div>

      <section className="shrink-0 border-b border-[#5e8ddd] bg-[#0b2e83] px-4 py-2" aria-label="Entry details">
        <div
          className={`grid gap-3 ${
            onVoucherNoChange
              ? 'grid-cols-[120px_minmax(160px,auto)_minmax(140px,auto)_minmax(200px,1fr)_minmax(220px,1.2fr)]'
              : 'grid-cols-[120px_minmax(160px,auto)_minmax(200px,1fr)_minmax(220px,1.2fr)]'
          }`}
        >
          <label className="flex items-center gap-2">
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-[#c7dcff]">Memo No.</span>
            <input
              value={memoId ?? ''}
              readOnly
              aria-label="Memo ID"
              className="h-8 min-w-0 flex-1 border border-[#6f96d7] bg-[#bcd1f1] px-2 font-mono text-xs font-bold text-[#15366f]"
            />
          </label>
          <label className="flex min-w-[160px] items-center gap-2">
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-[#c7dcff]">Date</span>
            <input
              type="date"
              value={entryDate}
              onChange={(event) => onEntryDateChange(event.target.value)}
              aria-label="Date"
              className="h-8 min-w-[9.5rem] flex-1 border border-[#8fb3ec] bg-[#f6faff] px-2 text-xs font-semibold text-[#071b4d] outline-none focus:border-[#ffd447] focus:ring-1 focus:ring-[#ffd447]"
            />
          </label>
          {onVoucherNoChange ? (
            <label className="flex min-w-[140px] items-center gap-2">
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-[#c7dcff]">
                Voucher No
              </span>
              <input
                value={voucherNo ?? ''}
                onChange={(event) => onVoucherNoChange(event.target.value)}
                aria-label="Voucher No"
                className="h-8 min-w-0 flex-1 border border-[#8fb3ec] bg-[#f6faff] px-2 text-xs font-semibold text-[#071b4d] outline-none focus:border-[#ffd447] focus:ring-1 focus:ring-[#ffd447]"
              />
            </label>
          ) : null}
          <label className="relative flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-[#c7dcff]">
              {partyLabel}
            </span>
            <input
              ref={partyInputRef}
              value={partyQuery}
              onChange={(event) => {
                setPartyQuery(event.target.value);
                setPartyOpen(true);
                setPartyHighlight(0);
                if (!event.target.value.trim()) onPartyIdChange(null);
              }}
              onFocus={() => setPartyOpen(true)}
              onBlur={() => {
                window.setTimeout(() => setPartyOpen(false), 150);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setPartyOpen(true);
                  setPartyHighlight((current) =>
                    Math.min(current + 1, Math.max(0, filteredParties.length - 1)),
                  );
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  setPartyHighlight((current) => Math.max(0, current - 1));
                } else if (event.key === 'Enter') {
                  if (partyOpen && filteredParties[partyHighlight]) {
                    event.preventDefault();
                    pickParty(filteredParties[partyHighlight]);
                    return;
                  }
                  if (requestCreateIfUnmatched()) {
                    event.preventDefault();
                  }
                } else if (event.key === 'Tab') {
                  if (requestCreateIfUnmatched()) {
                    event.preventDefault();
                  }
                } else if (event.key === 'Escape' && partyOpen) {
                  event.preventDefault();
                  event.stopPropagation();
                  setPartyOpen(false);
                }
              }}
              aria-label={partyLabel}
              aria-expanded={partyOpen}
              aria-autocomplete="list"
              role="combobox"
              className="h-8 min-w-0 flex-1 border border-[#8fb3ec] bg-[#f6faff] px-2 text-xs font-semibold text-[#071b4d] outline-none focus:border-[#ffd447] focus:ring-1 focus:ring-[#ffd447]"
              required={!partyId}
              autoComplete="off"
            />
            {partyOpen ? (
              <ul
                role="listbox"
                className="absolute left-[88px] right-0 top-full z-30 mt-1 max-h-48 overflow-auto border border-[#8fb3ec] bg-white text-[#071b4d] shadow-lg"
              >
                {filteredParties.length === 0 ? (
                  <li className="px-2 py-1.5 text-xs text-[#6b7280]">No matches</li>
                ) : (
                  filteredParties.map((party, index) => (
                    <li key={party.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={index === partyHighlight}
                        className={`flex w-full cursor-pointer px-2 py-1.5 text-left text-xs font-semibold ${
                          index === partyHighlight ? 'bg-[#ffd447] text-[#071b4d]' : 'hover:bg-[#e8f0ff]'
                        }`}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          pickParty(party);
                        }}
                      >
                        {party.name}
                        {party.detail ? ` (${party.detail})` : ''}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </label>
          <label className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-[#c7dcff]">Draw *</span>
            <select
              ref={drawSelectRef}
              value={drawId ?? ''}
              onChange={(event) => onDrawIdChange(Number(event.target.value) || null)}
              aria-label="Draw *"
              className="h-8 min-w-0 flex-1 border border-[#8fb3ec] bg-[#f6faff] px-2 text-xs font-semibold text-[#071b4d] outline-none focus:border-[#ffd447] focus:ring-1 focus:ring-[#ffd447]"
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
        </div>
      </section>

      {alerts}
      {statusBanner}

      <section className="flex min-h-0 flex-1 flex-col bg-[#06154d] p-2" aria-label="Entry worksheet">
        {children}
      </section>

      <div className="shrink-0 border-t border-[#6d98e4] bg-[#08266f]">
        <div
          className={`grid h-9 items-center border-b border-[#416db9] px-4 text-xs ${
            totalAmount == null ? 'grid-cols-[1fr_180px]' : 'grid-cols-[1fr_180px_180px]'
          }`}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#bcd5ff]">
            {rowCount} item row{rowCount === 1 ? '' : 's'} · row {activeRowIndex + 1} active
          </p>
          <p className="border-l border-[#416db9] px-4 text-right font-bold uppercase">
            Item Qty <span className="ml-2 font-mono text-[#ffe16a]">{totalQty}</span>
          </p>
          {totalAmount != null ? (
            <p className="border-l border-[#416db9] px-4 text-right font-bold uppercase">
              Item Amt <span className="ml-2 font-mono text-[#ffe16a]">{totalAmount.toFixed(2)}</span>
            </p>
          ) : null}
        </div>
        <div className="flex min-h-11 items-center justify-between gap-3 bg-[#0e3b99] px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={saving || disabled} className={actionBtn}>
              {saving ? 'Saving…' : saveLabel}
            </button>
            <button type="button" onClick={onDeleteRow} className={actionBtn}>
              Delete (F5)
            </button>
            <button type="button" onClick={onClear} className={actionBtn}>
              Clear (F8)
            </button>
            {onSearch ? (
              <button type="button" onClick={onSearch} className={actionBtn}>
                Search (F7)
              </button>
            ) : null}
            {extraActions.map((action) => (
              <button key={action.label} type="button" onClick={action.onClick} className={actionBtn}>
                {action.label}
              </button>
            ))}
            <button type="button" onClick={() => navigate(-1)} className={actionBtn}>
              Exit (Esc)
            </button>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="cursor-pointer border-2 border-[#ff8f63] bg-[#e85d04] px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-white shadow-[0_2px_0_#8a3400] hover:bg-[#f97316] focus:outline-none focus:ring-2 focus:ring-[#ffd447]"
          >
            Print ({printShortcut})
          </button>
        </div>
        <footer className="flex h-6 items-center justify-between border-t border-[#416db9] bg-[#06154d] px-4 font-mono text-[10px] uppercase tracking-[0.06em] text-[#8fb3ec]">
          <span>{footerDate}</span>
          <span>Shift: {activeShift ? `${activeShift.shiftGroupName} · ${activeShift.name}` : 'None'}</span>
        </footer>
      </div>
    </form>
  );
}
