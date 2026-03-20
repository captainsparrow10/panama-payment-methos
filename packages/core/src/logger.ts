/**
 * Logger interface accepted by all Panama payment SDK clients.
 *
 * Compatible with Winston, Pino, console, or any logger that implements
 * these four methods. Pass your existing logger to the SDK client constructor.
 *
 * @example
 * ```ts
 * // With Winston
 * import winston from 'winston';
 * const logger = winston.createLogger({ level: 'debug' });
 * new CMFClient({ ..., logger });
 *
 * // With Pino
 * import pino from 'pino';
 * new YappyClient({ ..., logger: pino() });
 *
 * // With built-in console logger
 * import { createConsoleLogger } from '@panama-payments/core';
 * new CyberSourceClient({ ..., logger: createConsoleLogger({ level: 'debug' }) });
 * ```
 */
export interface PaymentLogger {
  /** Log a debug-level message with optional structured metadata */
  debug(message: string, meta?: Record<string, unknown>): void;
  /** Log an info-level message with optional structured metadata */
  info(message: string, meta?: Record<string, unknown>): void;
  /** Log a warning-level message with optional structured metadata */
  warn(message: string, meta?: Record<string, unknown>): void;
  /** Log an error-level message with optional structured metadata */
  error(message: string, meta?: Record<string, unknown>): void;
}

/** Log level priority (lower number = more verbose) */
const LOG_LEVELS: Record<string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

/**
 * Silent logger that discards all messages. Used as default when no logger is provided.
 * This ensures SDK clients never crash due to a missing logger.
 *
 * @example
 * ```ts
 * const logger = options.logger ?? noopLogger;
 * logger.debug('This is silently discarded');
 * ```
 */
export const noopLogger: PaymentLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

/**
 * Creates a simple console-based logger with level filtering and timestamps.
 *
 * For production, prefer a structured logger like Winston or Pino.
 * This logger is provided as a zero-dependency convenience for development.
 *
 * @param opts - Logger options
 * @param opts.level - Minimum log level: 'debug' | 'info' | 'warn' | 'error' | 'silent' (default: 'info')
 * @param opts.prefix - Prefix for all log messages (default: '[panama-payments]')
 * @returns A PaymentLogger that writes to console
 *
 * @example
 * ```ts
 * const logger = createConsoleLogger({ level: 'debug', prefix: '[cmf]' });
 * logger.debug('Login attempt', { email: 'merchant@example.com' });
 * // Output: 2026-03-20T10:30:00.000Z [cmf] DEBUG Login attempt {"email":"merchant@example.com"}
 * ```
 */
export function createConsoleLogger(opts?: {
  level?: 'debug' | 'info' | 'warn' | 'error' | 'silent';
  prefix?: string;
}): PaymentLogger {
  const minLevel = LOG_LEVELS[opts?.level ?? 'info'] ?? 1;
  const prefix = opts?.prefix ?? '[panama-payments]';

  const log = (
    level: string,
    message: string,
    meta?: Record<string, unknown>,
  ) => {
    if (LOG_LEVELS[level]! < minLevel) return;
    const timestamp = new Date().toISOString();
    const metaStr =
      meta && Object.keys(meta).length > 0 ? ' ' + JSON.stringify(meta) : '';
    const method =
      level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    console[method](
      `${timestamp} ${prefix} ${level.toUpperCase()} ${message}${metaStr}`,
    );
  };

  return {
    debug: (msg, meta) => log('debug', msg, meta),
    info: (msg, meta) => log('info', msg, meta),
    warn: (msg, meta) => log('warn', msg, meta),
    error: (msg, meta) => log('error', msg, meta),
  };
}
