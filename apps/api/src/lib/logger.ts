/**
 * Structured logging.
 *
 * Every line carries request_id, user_id (opaque id only), route, status and
 * latency (`docs/08-engineering/observability.md` — Logs).
 *
 * Every line passes through `redact()` first. That is not optional and not
 * configurable: it is the enforcement point for SEC-2 and SEC-9.
 */
import { redact } from './redact.js';

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

const LEVEL_ORDER: Record<LogLevel, number> = {
  fatal: 60,
  error: 50,
  warn: 40,
  info: 30,
  debug: 20,
  trace: 10,
};

export type LogFields = Record<string, unknown>;

export interface Logger {
  fatal(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  debug(msg: string, fields?: LogFields): void;
  trace(msg: string, fields?: LogFields): void;
  /** Derive a logger that carries correlation fields on every line. */
  child(fields: LogFields): Logger;
}

export type LogSink = (line: Record<string, unknown>) => void;

const defaultSink: LogSink = (line) => {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(line));
};

export function createLogger(options: {
  level?: LogLevel;
  base?: LogFields;
  sink?: LogSink;
}): Logger {
  const level = options.level ?? 'info';
  const base = options.base ?? {};
  const sink = options.sink ?? defaultSink;
  const threshold = LEVEL_ORDER[level];

  const emit = (lvl: LogLevel, msg: string, fields?: LogFields) => {
    if (LEVEL_ORDER[lvl] < threshold) return;
    // Redaction happens here, once, for everything. Callers cannot skip it.
    const safe = redact({ ...base, ...fields }) as Record<string, unknown>;
    sink({ level: lvl, time: new Date().toISOString(), msg, ...safe });
  };

  return {
    fatal: (m, f) => emit('fatal', m, f),
    error: (m, f) => emit('error', m, f),
    warn: (m, f) => emit('warn', m, f),
    info: (m, f) => emit('info', m, f),
    debug: (m, f) => emit('debug', m, f),
    trace: (m, f) => emit('trace', m, f),
    child: (fields) =>
      createLogger({ level, base: { ...base, ...fields }, ...(options.sink ? { sink } : {}) }),
  };
}
