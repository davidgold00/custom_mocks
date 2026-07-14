import { useRef, useState } from 'react'
import { Button, Input } from '@/components/Card'
import { useUI } from '@/store'
import { usePlayerMap, USER_SOURCE_PREFIX } from '@/lib/rankings'
import { parseRankingsSheet, base64ToArrayBuffer, type ImportReport } from '@/lib/importRankings'
import { Upload, Link2, X, CheckCircle2, AlertTriangle } from 'lucide-react'

/**
 * Import rankings from an Excel/CSV file or a pasted link.
 * On success the import is saved to the library and set as the active base.
 */
export function ImportRankingsModal({ onClose }: { onClose: () => void }) {
  const players = usePlayerMap()
  const { saveRanking, setBaseSource } = useUI()

  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<ImportReport | null>(null)
  const [name, setName] = useState('My rankings')
  const fileRef = useRef<HTMLInputElement>(null)

  function handleParse(data: ArrayBuffer | string, suggestedName?: string) {
    try {
      setReport(parseRankingsSheet(data, players))
      if (suggestedName) setName(suggestedName.replace(/\.(xlsx|xls|csv|tsv)$/i, ''))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not parse that file.')
      setReport(null)
    }
  }

  async function onFile(f: File) {
    if (!/\.(xlsx|xls|csv|tsv)$/i.test(f.name)) {
      setError('Unsupported file type — upload an Excel (.xlsx/.xls) or CSV file.')
      return
    }
    handleParse(await f.arrayBuffer(), f.name)
  }

  async function onFetchUrl() {
    setBusy(true)
    setError(null)
    setReport(null)
    try {
      const res = await fetch('/api/import-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = (await res.json()) as
        | { ok: true; kind: 'csv' | 'xlsx'; name: string; text?: string; base64?: string }
        | { ok: false; error?: string }
      if (!data.ok) {
        setError(data.error ?? 'Import failed.')
        return
      }
      handleParse(data.kind === 'csv' ? (data.text ?? '') : base64ToArrayBuffer(data.base64 ?? ''), data.name)
    } catch {
      setError('Could not reach the import service — are you offline?')
    } finally {
      setBusy(false)
    }
  }

  function onSave() {
    if (!report) return
    const saved = saveRanking(name.trim() || 'My rankings', report.order)
    setBaseSource(USER_SOURCE_PREFIX + saved.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-xl p-5 max-h-[85vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Import rankings</h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!report && (
          <div className="space-y-4">
            {/* file upload */}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void onFile(f) }}
              className="w-full rounded-xl border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/40 transition p-6 text-center"
            >
              <Upload className="w-6 h-6 mx-auto text-slate-400" />
              <div className="mt-2 text-sm font-medium">Upload Excel or CSV</div>
              <div className="text-xs text-slate-500 mt-0.5">Needs a “Player” column; “Rank” and “Pos” columns help</div>
            </button>
            <input
              ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.tsv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = '' }}
            />

            {/* url import */}
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Or paste a link</div>
              <div className="flex gap-2">
                <Input
                  placeholder="https://… (CSV, Excel, or public Google Sheet)"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && url) void onFetchUrl() }}
                />
                <Button variant="primary" onClick={onFetchUrl} disabled={!url || busy}>
                  <Link2 className="w-4 h-4 mr-1.5" /> {busy ? 'Fetching…' : 'Fetch'}
                </Button>
              </div>
            </div>

            {error && (
              <div className="flex gap-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm p-3">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {report && (
          <div className="space-y-4">
            <div className="flex gap-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm p-3">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Matched <b>{report.matched}</b> of {report.total} rows
                {report.rankColumn ? <> using “{report.rankColumn}” for order</> : <> in sheet order</>}.
              </span>
            </div>

            {report.duplicates.length > 0 && (
              <div className="text-xs text-slate-600">
                Skipped duplicates: {report.duplicates.slice(0, 6).join(', ')}{report.duplicates.length > 6 && '…'}
              </div>
            )}

            {report.unmatched.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="text-xs font-semibold text-amber-800 mb-1.5">
                  {report.unmatched.length} row{report.unmatched.length === 1 ? '' : 's'} not matched
                </div>
                <ul className="text-xs text-amber-800 space-y-1 max-h-32 overflow-auto">
                  {report.unmatched.slice(0, 20).map((u) => (
                    <li key={u.row}>Row {u.row}: <b>{u.name}</b> — {u.reason}</li>
                  ))}
                  {report.unmatched.length > 20 && <li>…and {report.unmatched.length - 20} more</li>}
                </ul>
              </div>
            )}

            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Save as</div>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setReport(null); setError(null) }}>Back</Button>
              <Button variant="primary" onClick={onSave}>Save &amp; use as my board</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
