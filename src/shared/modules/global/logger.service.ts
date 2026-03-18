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
  private static readonly SENSITIVE_VALUE_PATTERN =
    /\b([A-Za-z0-9_-]*(?:api[_-]?key|client[_-]?secret|cookie|pass(?:word)?|private[_-]?key|secret|session|token)[A-Za-z0-9_-]*\b\s*[:=]\s*)([^,\s;]+)/gi;
  private static readonly SENSITIVE_JSON_VALUE_PATTERN =
    /("(?:[A-Za-z0-9_-]*(?:api[_-]?key|client[_-]?secret|cookie|pass(?:word)?|private[_-]?key|secret|session|token)[A-Za-z0-9_-]*)"\s*:\s*")([^"]+)(")/gi;
  private static readonly AUTHORIZATION_HEADER_PATTERN =
    /\b(Authorization\s*:\s*)(?:Bearer|Basic)\s+[^,\s;]+/gi;
  private static readonly BEARER_TOKEN_PATTERN =
    /\b(Bearer\s+)[A-Za-z0-9\-._~+/]+=*\b/gi;
  private context?: string;
  private readonly logger: Logger;

  // TODO (quality): Each LoggerService instance creates its own Winston logger instance. For high-throughput services, consider sharing a single Winston logger instance and passing context as metadata to reduce overhead.
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
        `${this.serializeMessage(message)} | trace=${this.sanitizeString(trace)}`,
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
   * Converts message payloads into a safe string form for logging.
   *
   * Primitive values are stringified, string content is sanitized for common
   * secret patterns, and object/array payloads are replaced with a fixed
   * placeholder to avoid leaking environment/configuration data to logs.
   *
   * @param {any} message Message payload.
   * @returns {string} Serialized message.
   */
  private serializeMessage(message: any): string {
    if (typeof message === 'string') {
      return this.sanitizeString(message);
    }

    if (
      typeof message === 'number' ||
      typeof message === 'bigint' ||
      typeof message === 'boolean'
    ) {
      return String(message);
    }

    if (message instanceof Error) {
      return this.serializeError(message);
    }

    if (Array.isArray(message)) {
      return '[redacted array payload]';
    }

    if (message && typeof message === 'object') {
      return '[redacted object payload]';
    }

    return this.sanitizeString(String(message));
  }

  /**
   * Converts an error object into a single sanitized log string.
   *
   * @param {Error} error Error instance being logged.
   * @returns {string} Sanitized error summary.
   */
  private serializeError(error: Error): string {
    return `${error.name}: ${this.sanitizeString(error.message)}`;
  }

  /**
   * Masks common secret/token formats embedded in string log messages.
   *
   * @param {string} value Raw string message or stack trace.
   * @returns {string} Sanitized string with secret values redacted.
   */
  private sanitizeString(value: string): string {
    return value
      .replace(
        LoggerService.AUTHORIZATION_HEADER_PATTERN,
        '$1[REDACTED]',
      )
      .replace(LoggerService.BEARER_TOKEN_PATTERN, '$1[REDACTED]')
      .replace(LoggerService.SENSITIVE_JSON_VALUE_PATTERN, '$1[REDACTED]$3')
      .replace(LoggerService.SENSITIVE_VALUE_PATTERN, '$1[REDACTED]');
  }
}
