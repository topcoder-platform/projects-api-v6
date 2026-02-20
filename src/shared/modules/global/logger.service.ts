import {
  Injectable,
  LoggerService as NestLoggerService,
  LogLevel,
} from '@nestjs/common';
import { createLogger, format, Logger, transports } from 'winston';

/**
 * Winston-backed NestJS logger wrapper.
 *
 * Provides a `forRoot` factory pattern for contextual loggers and formats all
 * messages with timestamp, level, and optional context metadata.
 */
@Injectable()
/**
 * Global logger service implementing NestJS LoggerService contract.
 */
export class LoggerService implements NestLoggerService {
  private context?: string;
  private readonly logger: Logger;

  // TODO (quality): Each LoggerService instance creates its own Winston logger instance. For high-throughput services, consider sharing a single Winston logger instance and passing context as metadata to reduce overhead.
  // TODO (security): Log messages are not sanitized. Sensitive values (tokens, passwords, PII) passed as message arguments will appear in logs. Consider adding a sanitization step in serializeMessage().
  // TODO (quality): LOG_LEVEL from env is not validated against Winston's accepted levels. An invalid value will silently default to Winston's behaviour. Add validation on startup.
  /**
   * Creates a context-aware logger instance.
   *
   * Initializes the Winston logger transport and output format pipeline.
   *
   * @param {string} [context] Optional default context label.
   */
  constructor(context?: string) {
    this.context = context;
    this.logger = createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: format.combine(
        format.timestamp(),
        format.printf((entry) => {
          const timestamp =
            typeof entry.timestamp === 'string'
              ? entry.timestamp
              : new Date().toISOString();
          const level =
            typeof entry.level === 'string'
              ? entry.level.toUpperCase()
              : 'INFO';
          const contextText =
            typeof entry.context === 'string' ? entry.context : undefined;
          const messageText = this.serializeMessage(entry.message);

          return `[${timestamp}] [${level}] ${contextText ? `[${contextText}] ` : ''}${messageText}`;
        }),
      ),
      transports: [new transports.Console()],
    });
  }

  // TODO (quality): forRoot() creates a new instance (and a new Winston logger) on every call. Services that call LoggerService.forRoot() in their class body bypass the DI-provided singleton. Consider injecting LoggerService and using setContext() instead.
  /**
   * Factory method used by consumers to create a contextual logger.
   *
   * @param {string} context Context label for log messages.
   * @returns {LoggerService} New logger instance bound to the provided context.
   */
  static forRoot(context: string): LoggerService {
    return new LoggerService(context);
  }

  /**
   * Sets or overrides the logger context.
   *
   * @param {string} context Context label to include in log entries.
   * @returns {void}
   */
  setContext(context: string): void {
    this.context = context;
  }

  /**
   * Logs an informational message.
   *
   * @param {any} message Message payload.
   * @param {string} [context] Optional context override.
   * @returns {void}
   */
  log(message: any, context?: string): void {
    this.printMessage('log', message, context || this.context);
  }

  /**
   * Logs an error message.
   *
   * @param {any} message Message payload.
   * @param {string} [trace] Optional stack trace.
   * @param {string} [context] Optional context override.
   * @returns {void}
   */
  error(message: any, trace?: string, context?: string): void {
    if (trace) {
      this.printMessage(
        'error',
        `${this.serializeMessage(message)} | trace=${trace}`,
        context || this.context,
      );
      return;
    }
    this.printMessage('error', message, context || this.context);
  }

  /**
   * Logs a warning message.
   *
   * @param {any} message Message payload.
   * @param {string} [context] Optional context override.
   * @returns {void}
   */
  warn(message: any, context?: string): void {
    this.printMessage('warn', message, context || this.context);
  }

  /**
   * Logs a debug message.
   *
   * @param {any} message Message payload.
   * @param {string} [context] Optional context override.
   * @returns {void}
   */
  debug(message: any, context?: string): void {
    this.printMessage('debug', message, context || this.context);
  }

  /**
   * Logs a verbose message.
   *
   * @param {any} message Message payload.
   * @param {string} [context] Optional context override.
   * @returns {void}
   */
  verbose(message: any, context?: string): void {
    this.printMessage('verbose', message, context || this.context);
  }

  /**
   * Normalizes NestJS log levels and forwards entries to Winston.
   *
   * Maps NestJS `log` level to Winston `info`.
   *
   * @param {LogLevel} level NestJS log level.
   * @param {any} message Message payload.
   * @param {string} [context] Optional context override.
   * @returns {void}
   */
  private printMessage(level: LogLevel, message: any, context?: string): void {
    const normalizedMessage = this.serializeMessage(message);

    if (level === 'log') {
      this.logger.info(normalizedMessage, { context });
      return;
    }

    this.logger.log(level, normalizedMessage, { context });
  }

  /**
   * Converts non-string message payloads to string form.
   *
   * Uses JSON serialization when possible with `String(...)` fallback.
   *
   * @param {any} message Message payload.
   * @returns {string} Serialized message.
   */
  private serializeMessage(message: any): string {
    if (typeof message === 'string') {
      return message;
    }

    try {
      return JSON.stringify(message);
    } catch {
      return String(message);
    }
  }
}
