'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Step = 'idle' | 'block' | 'delete';

const button =
  'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50';
const neutral = 'border-white/15 text-white/85 hover:border-accent/50 hover:text-white';
const danger = 'border-red-400/40 text-red-300 hover:border-red-400/70 hover:bg-red-500/10';

/**
 * Account actions for one user. Destructive steps confirm inline instead of
 * in a dialog; protected accounts (yourself, owners) explain why instead.
 */
export default function UserActions({
  userId,
  name,
  banned,
  role,
  protectedReason,
}: {
  userId: string;
  name: string;
  banned: boolean;
  role: string | null;
  protectedReason: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('idle');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const run = async (label: string, init: RequestInit, after?: () => void) => {
    setBusy(label);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        ...init,
        headers: { 'Content-Type': 'application/json' },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
      setStep('idle');
      setReason('');
      if (after) after();
      else router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };
  const post = (label: string, payload: object) =>
    run(label, { method: 'POST', body: JSON.stringify(payload) });
  const spinner = (label: string) =>
    busy === label ? <Loader2 size={14} aria-hidden className="animate-spin" /> : null;

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0d130e] p-4">
      <div className="flex flex-wrap gap-2">
        {banned ? (
          <button type="button" disabled={!!busy} onClick={() => post('unban', { action: 'unban' })} className={cn(button, neutral)}>
            {spinner('unban')} Unblock
          </button>
        ) : (
          <button
            type="button"
            disabled={!!busy || !!protectedReason}
            onClick={() => setStep(step === 'block' ? 'idle' : 'block')}
            aria-expanded={step === 'block'}
            className={cn(button, danger)}
          >
            Block…
          </button>
        )}
        {role === 'admin' ? (
          <button
            type="button"
            disabled={!!busy || !!protectedReason}
            onClick={() => post('role', { action: 'set-role', role: 'user' })}
            className={cn(button, neutral)}
          >
            {spinner('role')} Remove admin
          </button>
        ) : (
          <button
            type="button"
            disabled={!!busy || banned}
            onClick={() => post('role', { action: 'set-role', role: 'admin' })}
            className={cn(button, neutral)}
          >
            {spinner('role')} Make admin
          </button>
        )}
        <button
          type="button"
          disabled={!!busy}
          onClick={() => post('sessions', { action: 'revoke-sessions' })}
          className={cn(button, neutral)}
        >
          {spinner('sessions')} Sign out everywhere
        </button>
        <button
          type="button"
          disabled={!!busy || !!protectedReason}
          onClick={() => setStep(step === 'delete' ? 'idle' : 'delete')}
          aria-expanded={step === 'delete'}
          className={cn(button, danger, 'sm:ml-auto')}
        >
          Delete account…
        </button>
      </div>

      {protectedReason ? <p className="mt-3 text-xs text-white/60">{protectedReason}</p> : null}

      {step === 'block' ? (
        <form
          className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            post('ban', { action: 'ban', reason: reason.trim() || undefined });
          }}
        >
          <label className="min-w-[14rem] flex-1">
            <span className="sr-only">Reason (optional, kept with the account)</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={200}
              placeholder="Reason (optional)"
              className="h-9 w-full rounded-full border border-white/10 bg-black/40 px-4 text-sm outline-none transition-colors placeholder:text-white/50 focus:border-accent/60"
            />
          </label>
          <button type="submit" disabled={!!busy} className={cn(button, danger)}>
            {spinner('ban')} Block {name} and sign them out
          </button>
          <button type="button" onClick={() => setStep('idle')} className={cn(button, neutral)}>
            Cancel
          </button>
        </form>
      ) : null}

      {step === 'delete' ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
          <p className="min-w-0 flex-1 text-sm text-red-200">
            Deletes the account, its sign-ins, taste, watchlist and full watch history.
            This can&apos;t be undone.
          </p>
          <button
            type="button"
            disabled={!!busy}
            onClick={() =>
              run('delete', { method: 'DELETE' }, () => {
                router.push('/admin/users');
                router.refresh();
              })
            }
            className={cn(button, 'border-red-500 bg-red-500/90 text-white hover:bg-red-500')}
          >
            {spinner('delete')} Delete everything
          </button>
          <button type="button" onClick={() => setStep('idle')} className={cn(button, neutral)}>
            Cancel
          </button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
