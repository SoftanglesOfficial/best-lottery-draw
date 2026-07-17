import { Building2, Check, ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import type { CompanySummary } from '../../shared/types';
import { InlineSpinner } from './LoadingSpinner';

export default function CompanySwitcher() {
  const { user, activeCompanyName, setActiveCompany } = useAuth();
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupId = useId();

  useEffect(() => {
    if (!user) return;
    api.userGetCompanies(user.id)
      .then((result) => {
        if (result.success) setCompanies(result.companies);
      })
      .catch(() => undefined);
  }, [user]);

  useEffect(() => {
    if (!user?.activeCompanyId || activeCompanyName) return;
    api.userSetActiveCompany(user.id, user.activeCompanyId)
      .then((result) => {
        if (result.success) {
          setActiveCompany(result.user, result.companyName);
        }
      })
      .catch(() => undefined);
  }, [user, activeCompanyName, setActiveCompany]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', onClick);
    if (open) {
      document.addEventListener('keydown', onKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleSelect = useCallback(
    async (companyId: number) => {
      if (!user || user.activeCompanyId === companyId) {
        setOpen(false);
        return;
      }
      setSwitching(true);
      try {
        const result = await api.userSetActiveCompany(user.id, companyId);
        if (result.success) {
          setActiveCompany(result.user, result.companyName);
          window.location.reload();
        }
      } finally {
        setSwitching(false);
        setOpen(false);
      }
    },
    [user, setActiveCompany],
  );

  if (!user) return null;

  const hasMultiple = companies.length > 1;
  const displayName =
    activeCompanyName ??
    companies.find((company) => company.id === user.activeCompanyId)?.name ??
    'No company selected';

  return (
    <div ref={ref} className="relative">
      <button
        ref={triggerRef}
        type="button"
        className="flex w-full items-center gap-2 truncate rounded-sm text-left text-sm text-content-muted hover:text-content disabled:cursor-default disabled:opacity-80"
        onClick={() => hasMultiple && setOpen((v) => !v)}
        disabled={!hasMultiple || switching}
        aria-expanded={hasMultiple ? open : undefined}
        aria-controls={hasMultiple ? popupId : undefined}
      >
        <Building2 className="h-4 w-4 shrink-0 text-cyber" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{displayName}</span>
        {hasMultiple ? (
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        ) : null}
        {switching ? <InlineSpinner /> : null}
      </button>
      {hasMultiple ? (
        <div
          id={popupId}
          hidden={!open}
          className="absolute left-0 top-full z-50 mt-2 min-w-full overflow-hidden rounded-cyber border border-line-strong bg-surface-raised py-1 shadow-2xl shadow-black/40"
        >
          {companies.map((company) => (
            <button
              key={company.id}
              type="button"
              aria-current={company.id === user.activeCompanyId ? 'true' : undefined}
              className={`flex w-full items-center gap-2 whitespace-nowrap px-3 py-2 text-left text-sm hover:bg-surface-high ${
                company.id === user.activeCompanyId ? 'text-cyber-hover' : 'text-content-muted'
              }`}
              onClick={() => void handleSelect(company.id)}
            >
              <span className="min-w-0 flex-1 truncate">{company.name}</span>
              {company.id === user.activeCompanyId ? (
                <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-[0.05em]">
                  Current
                  <Check className="h-4 w-4" aria-hidden="true" />
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
