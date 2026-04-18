export function bytesToSize(bytesAsString: string | number): string {
  const bytes = typeof bytesAsString === 'string' ? Number(bytesAsString) : bytesAsString;
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / 1024 ** i;

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${sizes[i]}`;
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}
