/**
 * Core UI primitives — buttons, badges, cards, states, form controls.
 * Every CRUD page composes these for a consistent look.
 */
import { AlertTriangle, Inbox, Loader2, RefreshCw, type LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import type { BadgeTone } from '../../lib/constants';

// ── Button ───────────────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
type ButtonSize = 'sm' | 'md' | 'icon';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-glow hover:from-violet-500 hover:to-fuchsia-500 focus-visible:ring-violet-500/50',
  secondary: 'bg-white/5 text-zinc-200 hover:bg-white/10 focus-visible:ring-white/20',
  danger: 'bg-rose-600/90 text-white hover:bg-rose-500 focus-visible:ring-rose-500/50',
  ghost: 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100 focus-visible:ring-white/10',
  outline: 'border border-white/10 bg-transparent text-zinc-300 hover:border-violet-500/40 hover:text-white focus-visible:ring-violet-500/30',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
  icon: 'h-8 w-8',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({ variant = 'secondary', size = 'md', loading, className = '', children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      className={`inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition
        focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50
        ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

// ── Badge ────────────────────────────────────────────────────────────────────
const BADGE_TONES: Record<BadgeTone, string> = {
  violet: 'bg-violet-500/15 text-violet-300 ring-violet-500/30',
  emerald: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  amber: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  rose: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
  sky: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  zinc: 'bg-zinc-500/15 text-zinc-400 ring-zinc-500/30',
  fuchsia: 'bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-500/30',
};

export function Badge({ tone = 'zinc', children, className = '' }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${BADGE_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

// ── Spinner / loading ────────────────────────────────────────────────────────
export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 size={18} className={`animate-spin text-zinc-500 ${className}`} />;
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-white/5" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3.5">
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              className="h-4 animate-pulse rounded bg-white/5"
              style={{ width: c === 0 ? '18%' : `${Math.max(10, 60 / cols)}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rj-card h-24 animate-pulse" />
      ))}
    </div>
  );
}

// ── Empty / error states ─────────────────────────────────────────────────────
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10">
        <Icon size={24} className="text-zinc-500" />
      </div>
      <h3 className="font-display text-base font-semibold text-zinc-200">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-zinc-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 ring-1 ring-rose-500/30">
        <AlertTriangle size={22} className="text-rose-400" />
      </div>
      <h3 className="font-display text-base font-semibold text-zinc-200">Something went wrong</h3>
      <p className="mt-1 max-w-md text-sm text-zinc-500">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCw size={13} /> Try again
        </Button>
      )}
    </div>
  );
}

// ── Page header ──────────────────────────────────────────────────────────────
export function PageHeader({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-xl font-bold tracking-tight text-white md:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// ── Form controls ────────────────────────────────────────────────────────────
export function FormField({
  label,
  error,
  help,
  required,
  children,
  className = '',
}: {
  label?: string;
  error?: string;
  help?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <label className="rj-label">
          {label}
          {required && <span className="ml-0.5 text-rose-400">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-rose-400">{error}</p>
      ) : help ? (
        <p className="mt-1.5 text-xs text-zinc-600">{help}</p>
      ) : null}
    </div>
  );
}

export function Input({ invalid, className = '', ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input className={`rj-input ${invalid ? 'rj-input-error' : ''} ${className}`} {...rest} />;
}

export function Textarea({ invalid, className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea className={`rj-input ${invalid ? 'rj-input-error' : ''} ${className}`} {...rest} />;
}

export function Select({ invalid, className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select className={`rj-input ${invalid ? 'rj-input-error' : ''} ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
        checked ? 'bg-violet-600' : 'bg-zinc-800'
      }`}
    >
      <span
        className={`inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow transition ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
        style={{ height: 18, width: 18 }}
      />
    </button>
  );
}
