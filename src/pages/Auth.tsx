import { useState } from 'react'
import { Trophy } from 'lucide-react'
import { Button, Input } from '@/components/Card'
import { useAuth } from '@/lib/authStore'

/** Full-screen login / signup. Shown until the user is signed in. */
export default function AuthPage() {
  const { login, signup, error } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLocalError(null)
    if (mode === 'signup' && password !== confirm) {
      setLocalError('Passwords don’t match.')
      return
    }
    setBusy(true)
    try {
      await (mode === 'login' ? login(username.trim(), password) : signup(username.trim(), password))
    } finally {
      setBusy(false)
    }
  }

  const err = localError ?? error

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-xl leading-tight">BoardRoom</div>
            <div className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider">
              Fantasy draft practice
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex rounded-lg bg-slate-100 p-1 text-sm font-medium">
            {(['login', 'signup'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 py-1.5 rounded-md transition ${
                  mode === m ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'
                }`}
              >
                {m === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Username</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
            {mode === 'signup' && (
              <p className="text-[11px] text-slate-400 mt-1">3–20 characters: letters, numbers, underscores.</p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={mode === 'signup' ? 8 : undefined}
            />
            {mode === 'signup' && <p className="text-[11px] text-slate-400 mt-1">At least 8 characters.</p>}
          </div>

          {mode === 'signup' && (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Confirm password</label>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
            </div>
          )}

          {err && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm px-3 py-2">{err}</div>
          )}

          <Button type="submit" variant="primary" className="w-full py-2" disabled={busy}>
            {busy ? 'One sec…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </Button>

          <p className="text-[11px] text-slate-400 text-center">
            Your rankings, bot setups, and past drafts are saved to your account.
          </p>
        </form>
      </div>
    </div>
  )
}
