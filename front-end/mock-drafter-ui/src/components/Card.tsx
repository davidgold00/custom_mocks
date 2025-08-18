import React from 'react'

export function Card({ children, className='' }: { children: React.ReactNode, className?: string }) {
  return <div className={`bg-white rounded-2xl shadow-soft border border-slate-200 ${className}`}>{children}</div>
}
export function CardHeader({ title, action }: { title: string, action?: React.ReactNode }) {
  return <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
    <h3 className="font-semibold">{title}</h3>
    {action}
  </div>
}
export function CardBody({ children, className='' }: { children: React.ReactNode, className?: string }) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>
}
export function Button({ children, onClick, variant='default', className='' }:
  { children: React.ReactNode, onClick?: ()=>void, variant?: 'default'|'ghost'|'outline'|'primary', className?: string }) {
  const styles = {
    default: 'bg-slate-900 text-white hover:bg-slate-800',
    ghost: 'hover:bg-slate-100',
    outline: 'border border-slate-300 hover:bg-slate-50',
    primary: 'bg-indigo-600 text-white hover:bg-indigo-500'
  }[variant]
  return <button onClick={onClick} className={`px-3 py-2 rounded-xl text-sm font-medium transition ${styles} ${className}`}>{children}</button>
}
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${props.className ?? ''}`} />
}
export function Select({ value, onChange, children, className='' }:
  { value: string|number, onChange: (e: React.ChangeEvent<HTMLSelectElement>)=>void, children: React.ReactNode, className?: string}) {
  return <select value={value} onChange={onChange} className={`px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${className}`}>{children}</select>
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
