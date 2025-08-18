import React from 'react'

export function Card({ children, className='' }: { children: React.ReactNode, className?: string }) {
  return <div className={`bg-white rounded-2xl shadow-soft border border-slate-200 ${className}`}>{children}</div>
}

export function CardHeader({ title, action }: { title: React.ReactNode, action?: React.ReactNode }) {
  return <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
    <div className="flex items-center gap-3">{title}</div>
    {action}
  </div>
}

export function CardBody({ children, className='' }: { children: React.ReactNode, className?: string }) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>
}

type ButtonVariant = 'default' | 'ghost' | 'outline' | 'primary' | 'danger'
export function Button({ children, onClick, variant='default', className='' }:
  { children: React.ReactNode, onClick?: ()=>void, variant?: ButtonVariant, className?: string }) {
  const base = 'inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-2'
  const styles: Record<ButtonVariant, string> = {
    default: 'bg-slate-100 hover:bg-slate-200 text-slate-900 focus:ring-slate-400',
    ghost: 'bg-transparent hover:bg-slate-100 text-slate-700 focus:ring-slate-300',
    outline: 'border border-slate-300 text-slate-800 hover:bg-slate-50 focus:ring-slate-400',
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-indigo-500',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500',
  }
  return <button onClick={onClick} className={`${base} ${styles[variant]} ${className}`}>{children}</button>
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${props.className ?? ''}`} />
}

export function Select({ value, onChange, children, className='' }:
  { value: string|number, onChange: (e: React.ChangeEvent<HTMLSelectElement>)=>void, children: React.ReactNode, className?: string}) {
  return <select value={value} onChange={onChange} className={`px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${className}`}>{children}</select>
}

export function Slider({ value, onChange, min=0, max=100, step=1 }:
  { value: number, onChange: (v:number)=>void, min?: number, max?: number, step?: number }) {
  return (
    <div className="flex items-center gap-3">
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e)=>onChange(parseInt(e.target.value))}
        className="w-full accent-indigo-600" />
      <div className="w-12 text-right text-xs font-mono">{value}</div>
    </div>
  )
}
