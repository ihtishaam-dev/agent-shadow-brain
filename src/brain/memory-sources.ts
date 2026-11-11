interface MemorySourceOptions {
  limit?: number;
  maxChars?: number;
}

function bound(value: number | undefined, fallback: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(1, Math.min(max, Math.trunc(value))) : fallback;
}

/** Normalize source references already recorded in a memory without opening their targets. */
export function normalizeMemorySources(
  metadata: Record<string, unknown> | undefined,
  options: MemorySourceOptions = {},
): string[] {
  if (!metadata) return [];
  const limit = bound(options.limit, 8, 32);
  const maxChars = bound(options.maxChars, 240, 2000);
  const refs = Array.isArray(metadata.sources) ? metadata.sources.slice(0, 64) : [];
  const seen = new Set<string>();
  for (const value of [...refs, metadata.source, metadata.sourceFile, metadata.filePath]) {
    if (typeof value !== 'string') continue;
    const cleaned = value.replace(/[\u0000-\u0020\u007f-\u009f\s]+/g, ' ').trim();
    if (!cleaned) continue;
    const clipped = cleaned.length > maxChars
      ? cleaned.slice(0, maxChars - 1).replace(/[\ud800-\udbff]$/, '').trimEnd() + '…'
      : cleaned;
    seen.add(clipped);
    if (seen.size === limit) break;
  }
  return [...seen];
}
