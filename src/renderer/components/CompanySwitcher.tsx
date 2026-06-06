import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/auth';
import { userGetCompanies, userSetActiveCompany } from '../lib/api';
import { ROLE_BADGE_CLASSES, ROLE_LABELS } from '../lib/roles';
import type { CompanySummary } from '../../shared/types';
import { InlineSpinner } from './LoadingSpinner';

export default function CompanySwitcher() {
  const { user, activeCompanyName, setActiveCompany } = useAuth();
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    userGetCompanies(user.id)
      .then((result) => {
        if (result.success) setCompanies(result.companies);
      })
      .catch(() => undefined);
  }, [user]);

  useEffect(() => {
    if (!user?.activeCompanyId || activeCompanyName) return;
    userSetActiveCompany(user.id, user.activeCompanyId)
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
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleSelect = useCallback(
    async (companyId: number) => {
      if (!user || user.activeCompanyId === companyId) {
        setOpen(false);
        return;
      }
      setSwitching(true);
      try {
        const result = await userSetActiveCompany(user.id, companyId);
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
        type="button"
        className="flex w-full items-center gap-1 truncate text-left text-sm text-gray-400 hover:text-gray-200"
        onClick={() => hasMultiple && setOpen((v) => !v)}
        disabled={!hasMultiple || switching}
      >
        <span className="truncate">{displayName}</span>
        {hasMultiple ? <ChevronDown className="h-3 w-3 shrink-0" /> : null}
        {switching ? <InlineSpinner /> : null}
      </button>
      {open && hasMultiple ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded border border-gray-700 bg-gray-800 py-1 shadow-lg">
          {companies.map((company) => (
            <button
              key={company.id}
              type="button"
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-gray-700 ${
                company.id === user.activeCompanyId ? 'text-indigo-300' : 'text-gray-200'
              }`}
              onClick={() => void handleSelect(company.id)}
            >
              {company.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
