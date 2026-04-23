export interface Logger {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
}

export function createLogger(): Logger {
  const emit =
    (level: string) =>
    (msg: string, meta?: Record<string, unknown>): void => {
      const line = { level, ts: new Date().toISOString(), msg, ...(meta ?? {}) };
      console.log(JSON.stringify(line));
    };
  return { info: emit('info'), warn: emit('warn'), error: emit('error') };
}
