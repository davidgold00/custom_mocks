// src/lib/api.ts
export type Snapshot = any

const base = '' // same origin

export async function loadMock(id: string): Promise<Snapshot | null> {
  const res = await fetch(`${base}/api/mocks?id=${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  })
  if (!res.ok) return null
  try {
    const json = await res.json()
    if (!json || (typeof json === 'object' && Object.keys(json).length === 0)) return null
    return json
  } catch {
    return null
  }
}

export async function saveMock(id: string, data: Snapshot): Promise<boolean> {
  const res = await fetch(`${base}/api/mocks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, data }),
  })
  return res.ok
}

// simple debounce to avoid spamming writes
export function debounce<T extends (...a: any[]) => void>(fn: T, ms: number) {
  let t: any
  return (...args: Parameters<T>) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}
