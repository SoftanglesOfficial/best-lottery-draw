import { ArrowLeft, Clock3, Layers3 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ShiftGroupRecord, ShiftRecord } from '../../shared/types';
import { InlineSpinner } from '../components/LoadingSpinner';
import { Button, Card } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { isAtLeastRole } from '../lib/roles';

export default function OpenShiftPage() {
  const navigate = useNavigate();
  const { user, setActiveShift } = useAuth();
  const [groups, setGroups] = useState<ShiftGroupRecord[]>([]);
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [shiftId, setShiftId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');
  const shiftRequestId = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void api.shiftGroupsList()
      .then((result) => {
        if (cancelled) return;
        if (result.success) setGroups(result.groups);
        else setError(result.error);
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load shift groups. Check the database connection.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.activeCompanyId]);

  const chooseGroup = async (selectedGroupId: number) => {
    const requestId = ++shiftRequestId.current;
    setGroupId(selectedGroupId);
    setShiftId(null);
    setShifts([]);
    setError('');
    setLoadingShifts(true);
    try {
      const result = await api.shiftsList(selectedGroupId);
      if (requestId !== shiftRequestId.current) return;
      if (result.success) setShifts(result.shifts);
      else setError(result.error);
    } catch {
      if (requestId !== shiftRequestId.current) return;
      setError('Unable to load shifts. Check the database connection.');
    } finally {
      if (requestId === shiftRequestId.current) setLoadingShifts(false);
    }
  };

  const openShift = async () => {
    if (shiftId == null || opening) return;
    setOpening(true);
    setError('');
    try {
      const result = await api.shiftsSelect(shiftId);
      if (result.success) {
        setActiveShift(result.shift);
        navigate('/menu', { replace: true });
      } else {
        setShiftId(null);
        setError(result.error);
      }
    } catch {
      setError('Unable to open the shift. Check the database connection.');
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas p-4 text-content sm:p-6">
      <div aria-hidden="true" className="pointer-events-none absolute h-[30rem] w-[30rem] rounded-full bg-cyber/5 blur-3xl" />
      <Card className="relative w-full max-w-[640px] border-line-strong p-6 sm:p-10">
        <div className="mb-7">
          <div className="flex items-center gap-3">
            <Clock3 className="h-7 w-7 text-cyber" aria-hidden="true" />
            <h1 className="font-display text-2xl font-bold sm:text-[28px]">Open Shift</h1>
          </div>
          <p className="mt-3 text-content-muted">
            {groupId == null ? 'Select a shift group to continue.' : 'Select the shift to open.'}
          </p>
          <div className="mt-6 grid grid-cols-3 gap-2" aria-hidden="true">
            <span className="h-1.5 rounded-full bg-cyber" />
            <span className="h-1.5 rounded-full bg-cyber" />
            <span className={`h-1.5 rounded-full ${groupId == null ? 'bg-line' : 'bg-cyber'}`} />
          </div>
        </div>

        {error ? <p role="alert" className="mb-4 rounded-cyber border border-cyber-error/50 bg-cyber-error/10 px-3 py-2 text-sm text-cyber-error">{error}</p> : null}
        {loading ? <p className="flex items-center gap-2 text-content-muted"><InlineSpinner />Loading shift groups…</p> : null}

        {!loading && !error && groups.length === 0 ? (
          <div className="rounded-cyber border border-line bg-surface-low p-5">
            <p className="font-medium">No shift groups are configured for this company.</p>
            <p className="mt-1 text-sm text-content-muted">Create a shift group and at least one shift before continuing.</p>
            {user && isAtLeastRole(user.role, 'manager') ? (
              <Button className="mt-4" onClick={() => navigate('/master/shift-groups')}>Set up shift groups</Button>
            ) : null}
          </div>
        ) : null}

        {!loading && groups.length > 0 && groupId == null ? (
          <section>
            <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.08em] text-content-subtle">Shift group</h2>
            <div className="flex flex-col gap-2">
              {groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => void chooseGroup(group.id)}
                  className="flex min-h-14 items-center gap-3 rounded-cyber border border-line-strong bg-surface-high px-4 text-left text-content-muted hover:border-cyber focus-visible:border-cyber focus-visible:ring-2 focus-visible:ring-cyber/40"
                >
                  <Layers3 className="h-5 w-5 text-cyber" aria-hidden="true" />
                  {group.name}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {!loading && groupId != null ? (
          <section>
            <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.08em] text-content-subtle">Shift</h2>
            {loadingShifts ? <p className="flex items-center gap-2 text-content-muted"><InlineSpinner />Loading shifts…</p> : null}
            {!loadingShifts && !error && shifts.length === 0 ? <p className="rounded-cyber border border-line bg-surface-low p-4 text-sm text-content-muted">No shifts exist in this group. Add one in Master → Shifts.</p> : null}
            <div className="flex flex-col gap-2">
              {shifts.map((shift) => (
                <button
                  key={shift.id}
                  type="button"
                  aria-pressed={shiftId === shift.id}
                  onClick={() => setShiftId(shift.id)}
                  className={`min-h-14 rounded-cyber border px-4 text-left focus-visible:border-cyber focus-visible:ring-2 focus-visible:ring-cyber/40 ${
                    shiftId === shift.id
                      ? 'border-cyber bg-cyber-soft text-content'
                      : 'border-line-strong bg-surface-high text-content-muted hover:border-cyber'
                  }`}
                >
                  {shift.name}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <div className="mt-7 flex items-center justify-between border-t border-line pt-5">
          <Button
            type="button"
            variant="secondary"
            allowOffline
            onClick={() => {
              if (groupId == null) {
                navigate('/open-company');
                return;
              }
              shiftRequestId.current += 1;
              setGroupId(null);
              setShiftId(null);
              setShifts([]);
              setError('');
            }}
          >
            <span className="flex items-center gap-2"><ArrowLeft className="h-4 w-4" />Back</span>
          </Button>
          <Button type="button" disabled={shiftId == null || opening} onClick={() => void openShift()}>
            {opening ? 'Opening…' : 'Open'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
