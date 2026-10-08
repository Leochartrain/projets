import { useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router';
import { OUTCOME_LABELS, STATUS_LABELS, type Outcome, type Status } from '@shared/domain';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-strong',
  secondary: 'border border-field bg-card text-ink hover:border-ink/40',
  ghost: 'text-muted hover:bg-grey-soft hover:text-ink',
  danger: 'bg-danger text-white hover:bg-danger/90',
};

function buttonClass(variant: Variant, size: 'sm' | 'md', className = '') {
  const sizes = size === 'sm' ? 'h-8 px-3 text-sm' : 'h-10 px-4';
  return `inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${sizes} ${VARIANTS[variant]} ${className}`;
}

export function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({ variant = 'secondary', size = 'md', className, ...props }: LinkProps & { variant?: Variant; size?: 'sm' | 'md' }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <section className={`rounded-2xl border border-line bg-card p-5 ${className}`}>{children}</section>;
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-3xl">{title}</h1>
        {subtitle && <p className="text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

// Champs de formulaire : libellé au-dessus, aide en dessous.

function FieldShell({ id, label, hint, children }: { id: string; label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

const fieldClass = 'w-full rounded-lg border border-field bg-white px-3 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20';

export function TextField({ label, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint}>
      <input id={id} className={`${fieldClass} h-10`} {...props} />
    </FieldShell>
  );
}

export function TextArea({ label, hint, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: ReactNode }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint}>
      <textarea id={id} rows={3} className={`${fieldClass} py-2`} {...props} />
    </FieldShell>
  );
}

export function SelectField({ label, hint, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: ReactNode }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint}>
      <select id={id} className={`${fieldClass} h-10`} {...props}>
        {children}
      </select>
    </FieldShell>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div className="relative min-w-0 flex-1">
      <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input type="search" aria-label={placeholder} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${fieldClass} h-10 pl-9`} />
    </div>
  );
}

// Pastilles

const STATUS_STYLES: Record<Status, string> = {
  booked: 'bg-blue-soft text-blue',
  waiting: 'bg-amber-soft text-amber',
  in_progress: 'bg-violet-soft text-violet',
  done: 'bg-accent-soft text-accent-strong',
  cancelled: 'bg-grey-soft text-muted line-through',
  no_show: 'bg-grey-soft text-muted',
};

const OUTCOME_STYLES: Record<Outcome, string> = {
  repaired: 'bg-accent-soft text-accent-strong',
  repairable: 'bg-amber-soft text-amber',
  not_repairable: 'bg-danger-soft text-danger',
  advice: 'bg-blue-soft text-blue',
};

const pill = 'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold';

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`${pill} ${STATUS_STYLES[status]}`}>{STATUS_LABELS[status]}</span>;
}

export function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  return <span className={`${pill} ${OUTCOME_STYLES[outcome]}`}>{OUTCOME_LABELS[outcome]}</span>;
}

/** La pastille la plus parlante : le résultat si c'est terminé, sinon l'étape. */
export function RepairBadge({ status, outcome }: { status: Status; outcome: Outcome | null }) {
  return status === 'done' && outcome ? <OutcomeBadge outcome={outcome} /> : <StatusBadge status={status} />;
}

export function Chip({ children }: { children: ReactNode }) {
  return <span className="inline-flex rounded-md bg-grey-soft px-2 py-0.5 text-xs text-ink/80">{children}</span>;
}

// États

export function Spinner() {
  return (
    <div className="flex justify-center p-10" role="status" aria-label="Chargement">
      <span className="size-6 animate-spin rounded-full border-2 border-line border-t-accent" />
    </div>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
      {children}
    </p>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-field px-6 py-10 text-center">
      <p className="font-display text-lg font-semibold">{title}</p>
      {children && <div className="max-w-md text-sm text-muted">{children}</div>}
    </div>
  );
}

/** Fenêtre modale native (<dialog>) : Échap et le fond la ferment. */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] rounded-2xl bg-card p-0 text-ink shadow-2xl ${wide ? 'max-w-2xl' : 'max-w-lg'}`}
    >
      {open && (
        <div className="flex flex-col gap-5 p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-xl">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Fermer" className="-m-1 rounded-lg p-1 text-muted hover:bg-grey-soft hover:text-ink">
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function Stat({ label, value, detail, tone = 'ink' }: { label: string; value: ReactNode; detail?: ReactNode; tone?: 'ink' | 'accent' }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-line bg-card p-4">
      <span className="label">{label}</span>
      <span className={`font-display text-3xl font-bold tabular-nums ${tone === 'accent' ? 'text-accent' : ''}`}>{value}</span>
      {detail && <span className="text-sm text-muted">{detail}</span>}
    </div>
  );
}
