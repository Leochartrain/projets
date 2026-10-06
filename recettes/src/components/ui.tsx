import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { useId } from 'react';
import { Link, type LinkProps } from 'react-router';
import { initials } from '@/lib/format';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:brightness-110',
  secondary: 'bg-card text-ink border border-field hover:bg-paper',
  ghost: 'text-accent hover:bg-accent-soft',
  danger: 'bg-danger-soft text-danger hover:brightness-95',
};

/** Boutons de 48 px de haut au moins : faciles à toucher, même pour les grands-parents. */
const BASE =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 font-display text-base font-bold transition disabled:cursor-not-allowed disabled:opacity-50';

export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />;
}

export function ButtonLink({ variant = 'primary', className = '', ...props }: LinkProps & { variant?: Variant }) {
  return <Link className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />;
}

const FIELD = 'w-full rounded-xl border border-field bg-card px-4 text-base text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none';

export function TextField({ label, hint, error, className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const id = useId();
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <input id={id} className={`${FIELD} h-12`} aria-invalid={error ? true : undefined} {...props} />
      {hint && !error && <p className="text-sm text-muted">{hint}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

export function TextArea({ label, hint, className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <textarea id={id} className={`${FIELD} min-h-28 py-3 leading-relaxed`} {...props} />
      {hint && <p className="text-sm text-muted">{hint}</p>}
    </div>
  );
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-display font-bold text-accent"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function Spinner({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-12 text-muted">
      <span className="size-5 animate-spin rounded-full border-2 border-line border-t-accent" />
      {label}
    </div>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
      {children}
    </p>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-field px-6 py-10 text-center">
      <p className="font-display text-lg font-bold">{title}</p>
      {children && <div className="text-muted">{children}</div>}
    </div>
  );
}
