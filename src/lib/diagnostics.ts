/**
 * Local error log (SPEC §11): no error-reporting service — uncaught errors are kept on this device only,
 * viewable and exportable in Settings › About › Diagnostics. A small ring buffer in localStorage.
 */
export interface LogEntry {
  at: string;
  kind: 'error' | 'unhandledrejection';
  message: string;
  stack?: string;
}

const KEY = 'kin.diagnostics';
const MAX = 100;

export function readLog(): LogEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(v) ? (v as LogEntry[]) : [];
  } catch {
    return [];
  }
}

export function logError(entry: Omit<LogEntry, 'at'>): void {
  try {
    const next = [...readLog(), { at: new Date().toISOString(), ...entry }].slice(-MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable — nothing else we can do without a server, by design.
  }
}

export function clearLog(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

const describe = (e: unknown) =>
  e instanceof Error
    ? { message: `${e.name}: ${e.message}`, stack: e.stack }
    : { message: String(e) };

/** Install once at start-up. */
export function captureErrors(): void {
  window.addEventListener('error', (e) =>
    logError({ kind: 'error', ...describe(e.error ?? e.message) }),
  );
  window.addEventListener('unhandledrejection', (e) =>
    logError({ kind: 'unhandledrejection', ...describe(e.reason) }),
  );
}

export function formatLog(entries: LogEntry[], meta: Record<string, string>): string {
  const head = Object.entries(meta).map(([k, v]) => `${k}: ${v}`);
  const body = entries.map(
    (e) => `[${e.at}] ${e.kind}: ${e.message}${e.stack ? `\n${e.stack}` : ''}`,
  );
  return [...head, '', ...(body.length ? body : ['(no errors recorded)'])].join('\n');
}
