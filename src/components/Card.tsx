// src/components/Card.tsx
import * as React from 'react'

/* ===================== Card Shells ===================== */
export function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`}>
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  action,
  className = '',
}: {
  title?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 border-b border-slate-200 ${className}`}>
      <div className="text-base font-semibold">{title}</div>
      {action ? <div className="shrink-0 flex items-center gap-2">{action}</div> : null}
    </div>
  )
}

export function CardBody({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`p-4 ${className}`}>{children}</div>
}

/* ===================== Button ===================== */
/**
 * Button now accepts *all* native button attributes (incl. disabled)
 * and forwards them to the underlying <button>. Variants ship with
 * sensible "disabled" visual states.
 */
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'outline' | 'ghost'
}

export function Button({
  variant = 'primary',
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed'
  const variants: Record<Required<ButtonProps>['variant'], string> = {
    primary:
      'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300 disabled:text-white',
    outline:
      'border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:hover:bg-transparent',
    ghost:
      'text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:hover:bg-transparent',
  }

  return (
    <button
      {...props}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

/* ===================== Inputs ===================== */
export type InputProps = React.InputHTMLAttributes<HTMLInputElement>
export function Input({ className = '', ...props }: InputProps) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-500 ${className}`}
    />
  )
}

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>
export function Select({ className = '', children, ...props }: SelectProps) {
  return (
    <select
      {...props}
      className={`rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-500 ${className}`}
    >
      {children}
    </select>
  )
}

/* ===================== Slider ===================== */
/**
 * Minimal slider wrapper used in settings pages.
 * Accepts value/onChange like a controlled input.
 */
export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  className = '',
  disabled,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  className?: string
  disabled?: boolean
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      disabled={disabled}
      className={`w-full accent-indigo-600 disabled:opacity-50 ${className}`}
    />
  )
}
