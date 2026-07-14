export const MAX_BYTES: number
export function normalizeImportUrl(raw: string): { url: string } | { error: string }
export function classifyContent(
  contentType: string,
  url: string,
  buf: ArrayBuffer,
): 'csv' | 'xlsx' | 'html' | 'unknown'
