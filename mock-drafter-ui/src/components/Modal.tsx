import React from 'react'
import { Button } from './Card'

export default function Modal({ open, title, children, onClose }: { open: boolean, title: string, children: React.ReactNode, onClose: ()=>void }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-soft w-full max-w-xl">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
