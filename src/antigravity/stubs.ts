export const logger = {
  info: (...args: any[]) => console.log('[INFO]', ...args),
  warn: (...args: any[]) => console.warn('[WARN]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args),
  debug: (...args: any[]) => console.debug('[DEBUG]', ...args),
};

export const FALLBACK_VERSION = '1.0.0';

export function buildUserAgent(version: string): string {
  return `AntigravityManagerTUI/${version}`;
}

export function resolveLocalInstalledVersion(): string | null {
  return null;
}
